"use client";

import type { RefObject } from "react";
import { Eye, EyeOff, Loader2, PersonStanding, RotateCcw, ScanFace, VideoOff } from "lucide-react";
import type { LiveState } from "@/lib/usePosture";
import { Pill } from "./ui";

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  ready: boolean;
  error: string | null;
  live: LiveState;
  onRecalibrate?: () => void;
  compact?: boolean;
};

export default function CameraPanel({ videoRef, canvasRef, ready, error, live, onRecalibrate, compact }: Props) {
  const posture = {
    good: { tone: "good" as const, text: "Good posture" },
    slouch: { tone: "bad" as const, text: "Sit up straight" },
    tilt: { tone: "warn" as const, text: "Level your shoulders" },
    none: { tone: "neutral" as const, text: "Shoulders not visible" },
  }[live.posture];
  const eyes = {
    open: { tone: "good" as const, text: "Good eye contact" },
    closed: { tone: "bad" as const, text: "Eyes closed" },
    away: { tone: "bad" as const, text: "Looking away" },
    hidden: { tone: "bad" as const, text: "Eyes not visible" },
  }[live.eyes];

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-black/[0.07] bg-zinc-200/70 ${compact ? "aspect-video" : "aspect-[4/3]"}`}>
      <video ref={videoRef} muted playsInline className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100 object-cover" />

      {(error || !ready) && (
        <div className="absolute inset-0 grid place-items-center bg-zinc-100/90 text-sm text-zinc-500">
          {error ? (
            <div className="flex max-w-xs flex-col items-center gap-2 px-6 text-center">
              <VideoOff className="h-6 w-6 text-rose-500" />
              Camera unavailable: {error}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading posture tracking…
            </div>
          )}
        </div>
      )}

      {ready && !error && (
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 border-t border-white/40 bg-white/70 p-3 backdrop-blur-md">
          {live.calibrating ? (
            <Pill tone="accent">
              <ScanFace className="h-3.5 w-3.5" /> Calibrating posture — sit up straight
            </Pill>
          ) : (
            <Pill tone={posture.tone}>
              <PersonStanding className="h-3.5 w-3.5" /> {posture.text}
            </Pill>
          )}
          <Pill tone={eyes.tone}>
            {live.eyes === "open" ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {eyes.text}
          </Pill>
          {onRecalibrate && !compact && (
            <button
              onClick={onRecalibrate}
              className="ml-auto inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-white/80 px-2.5 py-1 text-xs text-zinc-700 hover:bg-white"
            >
              <RotateCcw className="h-3 w-3" /> Recalibrate
            </button>
          )}
        </div>
      )}
    </div>
  );
}
