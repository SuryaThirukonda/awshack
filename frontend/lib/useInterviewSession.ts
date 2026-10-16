"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConversation } from "@elevenlabs/react";
import { analyze, getToken, saveReport, saveSessionReport, type PresenceSummary, type Report, type TranscriptLine } from "./api";
import { emit } from "./bus";
import { useRecorder } from "./useRecorder";

export type Phase = "idle" | "connecting" | "live" | "ended" | "analyzing";

type Options = {
  mode: Report["mode"];
  role: string;
  stopTracking: () => PresenceSummary;
  startTracking: () => void;
};

const errorText = (e: unknown) => {
  if (e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError")) {
    return "microphone access is blocked. Allow the mic for localhost in your browser's site settings and try again";
  }
  if (e instanceof DOMException && e.name === "NotFoundError") return "no microphone was found";
  return e instanceof Error ? e.message : typeof e === "string" ? e : "something went wrong";
};

/** Voice interviewer (ElevenLabs) + mic recording + analysis hand-off. Must be inside <ConversationProvider>. */
export function useInterviewSession({ mode, role, startTracking, stopTracking }: Options) {
  const router = useRouter();
  const recorder = useRecorder();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [seconds, setSeconds] = useState(0);
  const agentSpeakingRef = useRef<number[][]>([]);
  const speakingRef = useRef(false);
  const phaseRef = useRef<Phase>("idle");
  const transcriptRef = useRef<TranscriptLine[]>([]);

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);
  useEffect(() => {
    emit({ type: "interview-phase", phase });
  }, [phase]);
  // Make sure the voice guide re-appears if this page unmounts mid-session.
  useEffect(() => () => emit({ type: "interview-phase", phase: "idle" }), []);

  const conversation = useConversation({
    onMessage: ({ message, role }) => {
      if (!message?.trim()) return;
      const line = { role, text: message, t: recorder.elapsed() };
      transcriptRef.current = [...transcriptRef.current, line];
      setTranscript(transcriptRef.current);
    },
    onModeChange: ({ mode }) => {
      speakingRef.current = mode === "speaking";
      const t = recorder.elapsed();
      const spans = agentSpeakingRef.current;
      if (mode === "speaking") spans.push([t, t]);
      else if (spans.length) spans[spans.length - 1][1] = t;
    },
    onConnect: () => setPhaseBoth("live"),
    onDisconnect: () => {
      if (phaseRef.current === "live" || phaseRef.current === "connecting") setPhaseBoth("ended");
    },
    onError: (message) => {
      setError(typeof message === "string" ? message : "Voice connection error");
      if (phaseRef.current === "connecting") {
        recorder.stop();
        stopTracking();
        setPhaseBoth("idle");
      }
    },
  });

  // useConversation returns a fresh object every render, so effects/timers read it through a ref.
  const convRef = useRef(conversation);
  useEffect(() => {
    convRef.current = conversation;
  });

  /** Guarded senders: the SDK throws if there is no active conversation, so never let that reach React. */
  const send = useMemo(() => {
    const guard = (fn: (c: typeof conversation) => void) => {
      const c = convRef.current;
      if (phaseRef.current !== "live" || c.status !== "connected") return false;
      try {
        fn(c);
        return true;
      } catch {
        return false;
      }
    };
    return {
      contextual: (text: string) => guard((c) => c.sendContextualUpdate(text)),
      userMessage: (text: string) => guard((c) => c.sendUserMessage(text)),
      activity: () => guard((c) => c.sendUserActivity()),
      isAgentSpeaking: () => speakingRef.current,
    };
  }, []);

  useEffect(() => {
    if (phase !== "live" && phase !== "ended") return;
    const id = setInterval(() => setSeconds(Math.round(recorder.elapsed())), 1000);
    return () => clearInterval(id);
  }, [phase, recorder]);

  const start = useCallback(
    async (dynamicVariables: Record<string, string> = {}) => {
      if (phaseRef.current !== "idle") return;
      setError(null);
      transcriptRef.current = [];
      setTranscript([]);
      setSeconds(0);
      agentSpeakingRef.current = [];
      speakingRef.current = false;
      setPhaseBoth("connecting");
      emit({ type: "interview-starting" }); // voice guide hangs up so the mic is free
      try {
        const { token } = await getToken();
        await recorder.start();
        startTracking();
        convRef.current.startSession({
          conversationToken: token,
          connectionType: "webrtc",
          dynamicVariables: { mode, role, problem: "none", ...dynamicVariables },
        });
      } catch (e) {
        await recorder.stop();
        setError(`Could not start the interview: ${errorText(e)}`);
        setPhaseBoth("idle");
      }
    },
    [mode, role, recorder, startTracking, setPhaseBoth],
  );

  const finish = useCallback(
    async (extra: Partial<Report> & Record<string, unknown> = {}) => {
      if (phaseRef.current === "analyzing" || phaseRef.current === "idle") return;
      setPhaseBoth("analyzing");
      try {
        convRef.current.endSession();
      } catch {}
      const durationS = Math.round(recorder.elapsed());
      const audio = await recorder.stop();
      const presence = stopTracking();
      const spans = agentSpeakingRef.current.map(([s, e]) => [s, e > s ? e : durationS]);
      const lines = transcriptRef.current;
      try {
        const { problem, code, tests } = extra;
        const res = await analyze(
          {
            mode,
            role,
            duration_s: durationS,
            transcript: lines.map(({ role, text }) => ({ role: role === "agent" ? "interviewer" : "candidate", text })),
            presence: {
              posture_pct: presence.posture_pct,
              eye_contact_pct: presence.eye_contact_pct,
              slouch_events: presence.slouch_events,
              eyes_closed_pct: presence.eyes_closed_pct,
              looking_away_pct: presence.looking_away_pct,
            },
            agent_speaking: spans,
            ...(mode !== "behavioral"
              ? { problem: problem?.prompt, code, tests: tests && { passed: tests.passed, total: tests.total, error: tests.error } }
              : {}),
          },
          audio,
        );
        const report: Report = {
          sessionId: res.session_id,
          mode,
          role,
          createdAt: Date.now(),
          durationS,
          transcript: lines,
          presence,
          voice: res.voice,
          voiceError: res.voice_error,
          feedback: res.feedback,
          ...extra,
        };
        saveReport(report);
        await saveSessionReport(res.session_id, report);
        router.push("/report");
      } catch (e) {
        setError(`Analysis failed: ${errorText(e)}. Is the backend running on :8000?`);
        setPhaseBoth("ended");
      }
    },
    [mode, role, recorder, router, stopTracking, setPhaseBoth],
  );

  return { phase, error, transcript, seconds, conversation, send, start, finish };
}

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
