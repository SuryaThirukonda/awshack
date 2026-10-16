import type { Phase } from "@/lib/useInterviewSession";

export default function VoiceOrb({ phase, isSpeaking, size = 160 }: { phase: Phase; isSpeaking: boolean; size?: number }) {
  const live = phase === "live";
  const label =
    phase === "connecting"
      ? "Connecting…"
      : phase === "analyzing"
        ? "Analyzing…"
        : phase === "ended"
          ? "Interview ended"
          : !live
            ? "Ready when you are"
            : isSpeaking
              ? "Alex is speaking"
              : "Listening to you…";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative grid place-items-center" style={{ width: size, height: size }}>
        {live && isSpeaking && (
          <>
            <span className="orb-ring absolute inset-0 rounded-full bg-indigo-500/40" />
            <span className="orb-ring-delayed absolute inset-0 rounded-full bg-sky-400/30" />
          </>
        )}
        <span
          className={`relative rounded-full transition-all duration-500 ${live ? "orb-breathe" : ""}`}
          style={{
            width: size * 0.78,
            height: size * 0.78,
            background: live
              ? isSpeaking
                ? "radial-gradient(circle at 30% 30%, #a5b4fc, #6366f1 45%, #0ea5e9 100%)"
                : "radial-gradient(circle at 30% 30%, #6ee7b7, #10b981 45%, #0f766e 100%)"
              : "radial-gradient(circle at 30% 30%, #3f3f46, #27272a 60%, #18181b 100%)",
            boxShadow: live
              ? isSpeaking
                ? "0 0 60px 6px rgba(99,102,241,0.45)"
                : "0 0 40px 2px rgba(16,185,129,0.3)"
              : "0 0 0 1px rgba(255,255,255,0.06) inset",
          }}
        />
      </div>
      <div className="flex items-center gap-2 text-sm text-zinc-300">
        <span
          className={`h-2 w-2 rounded-full ${
            live ? (isSpeaking ? "bg-indigo-400" : "bg-emerald-400 animate-pulse") : phase === "connecting" ? "bg-amber-400 animate-pulse" : "bg-zinc-600"
          }`}
        />
        {label}
      </div>
    </div>
  );
}
