"use client";

import { useRef } from "react";
import { ConversationProvider } from "@elevenlabs/react";
import { MessagesSquare, Mic, MicOff, Play, Square } from "lucide-react";
import CameraPanel from "@/components/CameraPanel";
import Transcript from "@/components/Transcript";
import VoiceOrb from "@/components/VoiceOrb";
import { AnalyzingOverlay, ErrorBanner, SessionHeader } from "@/components/session";
import { Button, Card, CardHeader } from "@/components/ui";
import { useCommand, usePageContext } from "@/lib/bus";
import { useInterviewSession } from "@/lib/useInterviewSession";
import { useRole } from "@/lib/useStored";
import { usePosture } from "@/lib/usePosture";

export default function InterviewPage() {
  return (
    <ConversationProvider>
      <BehavioralSession />
    </ConversationProvider>
  );
}

function BehavioralSession() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const posture = usePosture(videoRef, canvasRef);
  const role = useRole();

  const session = useInterviewSession({
    mode: "behavioral",
    role,
    startTracking: posture.startTracking,
    stopTracking: posture.stopTracking,
  });
  const { phase, conversation } = session;
  const active = phase === "live" || phase === "connecting";

  usePageContext({ page: "interview", mode: "behavioral", phase });
  useCommand((cmd) => {
    if (cmd.type === "start-interview" && phase === "idle") return void session.start(), true;
    if (cmd.type === "end-interview" && (phase === "live" || phase === "ended")) return void session.finish(), true;
  });

  return (
    <div className="flex flex-1 flex-col gap-5 pt-6">
      <SessionHeader
        icon={<MessagesSquare className="h-5 w-5 text-indigo-600" />}
        title="Regular interview"
        subtitle={`Behavioral · ${role}`}
        seconds={session.seconds}
        phase={phase}
      >
        {phase === "idle" && (
          <Button onClick={() => session.start()} disabled={!posture.ready && !posture.error}>
            <Play className="h-4 w-4" /> Start interview
          </Button>
        )}
        {active && (
          <>
            <Button tone="ghost" onClick={() => conversation.setMuted(!conversation.isMuted)}>
              {conversation.isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              {conversation.isMuted ? "Unmute" : "Mute"}
            </Button>
            <Button tone="danger" onClick={() => session.finish()}>
              <Square className="h-4 w-4" /> End & get report
            </Button>
          </>
        )}
        {phase === "ended" && (
          <Button onClick={() => session.finish()}>
            <Square className="h-4 w-4" /> Get report
          </Button>
        )}
      </SessionHeader>

      {session.error && <ErrorBanner message={session.error} />}

      <div className="grid flex-1 gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-7">
          <CameraPanel
            videoRef={videoRef}
            canvasRef={canvasRef}
            ready={posture.ready}
            error={posture.error}
            live={posture.live}
            onRecalibrate={posture.recalibrate}
          />
          <Card className="grid grid-cols-3 divide-x divide-black/[0.06]">
            <Tip title="Sit tall" body="Keep your head stacked over your shoulders." />
            <Tip title="Eyes on the lens" body="Look at the camera, not your own video." />
            <Tip title="Use STAR" body="Situation, Task, Action, Result — end with impact." />
          </Card>
        </div>

        <div className="flex flex-col gap-5 lg:col-span-5">
          <Card className="flex flex-col items-center justify-center gap-2 py-8">
            <VoiceOrb phase={phase} isSpeaking={conversation.isSpeaking} />
            {phase === "idle" && <p className="mt-2 max-w-xs text-center text-sm text-zinc-500">Alex will ask four behavioral questions with follow-ups. Answer out loud as you would in a real interview.</p>}
          </Card>
          <Card className="flex min-h-[280px] flex-1 flex-col">
            <CardHeader title="Live transcript" icon={<MessagesSquare className="h-4 w-4" />} />
            <div className="scrollbar-thin max-h-[420px] flex-1 overflow-y-auto">
              <Transcript lines={session.transcript} empty="Live captions appear here. A verbatim transcript with your stutters and pauses is saved with your report." />
            </div>
          </Card>
        </div>
      </div>

      {phase === "analyzing" && <AnalyzingOverlay />}
    </div>
  );
}

function Tip({ title, body }: { title: string; body: string }) {
  return (
    <div className="p-4">
      <div className="text-sm font-medium text-zinc-900">{title}</div>
      <div className="mt-1 text-xs leading-relaxed text-zinc-500">{body}</div>
    </div>
  );
}
