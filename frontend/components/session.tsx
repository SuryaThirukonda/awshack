import type { ReactNode } from "react";
import { Clock, Loader2 } from "lucide-react";
import { fmtTime } from "@/lib/useInterviewSession";
import { Card, Pill } from "./ui";

export function SessionHeader({
  icon,
  title,
  subtitle,
  seconds,
  phase,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  seconds: number;
  phase: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5">{icon}</span>
        <div>
          <h1 className="text-lg font-semibold text-white">{title}</h1>
          <p className="text-sm text-zinc-400">{subtitle}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(phase === "live" || phase === "ended") && (
          <Pill tone={phase === "live" ? "bad" : "neutral"}>
            {phase === "live" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" />}
            <Clock className="h-3.5 w-3.5" /> {fmtTime(seconds)}
          </Pill>
        )}
        {children}
      </div>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{message}</div>;
}

export function AnalyzingOverlay() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm">
      <Card className="flex w-80 flex-col items-center gap-4 p-8 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-300" />
        <div>
          <div className="font-medium text-white">Analyzing your interview…</div>
          <div className="mt-1 text-sm text-zinc-400">Transcribing your voice, scoring delivery and generating feedback.</div>
        </div>
      </Card>
    </div>
  );
}
