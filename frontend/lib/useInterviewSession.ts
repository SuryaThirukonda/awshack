"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useConversation } from "@elevenlabs/react";
import { analyze, getToken, saveReport, type PresenceSummary, type Report, type TranscriptLine } from "./api";
import { emit } from "./bus";
import { useRecorder } from "./useRecorder";

export type Phase = "idle" | "connecting" | "live" | "ended" | "analyzing";

type Options = {
  mode: Report["mode"];
  role: string;
  stopTracking: () => PresenceSummary;
  startTracking: () => void;
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
  const phaseRef = useRef<Phase>("idle");
  useEffect(() => {
    phaseRef.current = phase;
    emit({ type: "interview-phase", phase });
  }, [phase]);

  const conversation = useConversation({
    onMessage: ({ message, role }) => {
      if (!message?.trim()) return;
      setTranscript((t) => [...t, { role, text: message, t: recorder.elapsed() }]);
    },
    onModeChange: ({ mode }) => {
      const t = recorder.elapsed();
      const spans = agentSpeakingRef.current;
      if (mode === "speaking") spans.push([t, t]);
      else if (spans.length) spans[spans.length - 1][1] = t;
    },
    onConnect: () => setPhase("live"),
    onDisconnect: () => {
      if (phaseRef.current === "live" || phaseRef.current === "connecting") setPhase("ended");
    },
    onError: (message) => setError(typeof message === "string" ? message : "Voice connection error"),
  });

  useEffect(() => {
    if (phase !== "live" && phase !== "ended") return;
    const id = setInterval(() => setSeconds(Math.round(recorder.elapsed())), 1000);
    return () => clearInterval(id);
  }, [phase, recorder]);

  const start = useCallback(
    async (dynamicVariables: Record<string, string> = {}) => {
      setError(null);
      setTranscript([]);
      setSeconds(0);
      agentSpeakingRef.current = [];
      setPhase("connecting");
      try {
        emit({ type: "interview-starting" }); // voice guide hangs up so the mic is free
        const { token } = await getToken();
        await recorder.start();
        startTracking();
        conversation.startSession({
          conversationToken: token,
          connectionType: "webrtc",
          dynamicVariables: { mode, role, problem: "none", ...dynamicVariables },
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase("idle");
      }
    },
    [conversation, mode, role, recorder, startTracking],
  );

  const finish = useCallback(
    async (extra: Partial<Report> & Record<string, unknown> = {}) => {
      setPhase("analyzing");
      if (conversation.status === "connected" || conversation.status === "connecting") conversation.endSession();
      const durationS = Math.round(recorder.elapsed());
      const audio = await recorder.stop();
      const presence = stopTracking();
      const spans = agentSpeakingRef.current.map(([s, e]) => [s, e > s ? e : durationS]);
      try {
        const { problem, code, tests } = extra;
        const res = await analyze(
          {
            mode,
            role,
            duration_s: durationS,
            transcript: transcript.map(({ role, text }) => ({ role: role === "agent" ? "interviewer" : "candidate", text })),
            presence: { posture_pct: presence.posture_pct, eye_contact_pct: presence.eye_contact_pct, slouch_events: presence.slouch_events },
            agent_speaking: spans,
            ...(mode !== "behavioral" ? { problem: problem?.prompt, code, tests: tests && { passed: tests.passed, total: tests.total, error: tests.error } } : {}),
          },
          audio,
        );
        const report: Report = {
          mode,
          role,
          createdAt: Date.now(),
          durationS,
          transcript,
          presence,
          voice: res.voice,
          voiceError: res.voice_error,
          feedback: res.feedback,
          ...extra,
        };
        saveReport(report);
        router.push("/report");
      } catch (e) {
        setError(`Analysis failed: ${e instanceof Error ? e.message : String(e)}`);
        setPhase("ended");
      }
    },
    [conversation, mode, role, recorder, router, stopTracking, transcript],
  );

  return { phase, error, transcript, seconds, conversation, start, finish };
}

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
