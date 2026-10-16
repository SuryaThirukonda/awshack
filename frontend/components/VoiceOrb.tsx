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
            <span className="orb-ring absolute inset-0 rounded-full bg-indigo-500/25" />
            <span className="orb-ring-delayed absolute inset-0 rounded-full bg-indigo-400/20" />
          </>
        )}
        <span
          className={`relative rounded-full transition-all duration-500 ${live ? "orb-breathe" : ""}`}
          style={{
            width: size * 0.78,
            height: size * 0.78,
            background: live ? (isSpeaking ? "#6366f1" : "#10b981") : "rgba(228,228,231,0.8)",
            boxShadow: live
              ? isSpeaking
                ? "0 0 0 10px rgba(99,102,241,0.12), 0 12px 30px -8px rgba(99,102,241,0.45)"
                : "0 0 0 10px rgba(16,185,129,0.12), 0 12px 30px -8px rgba(16,185,129,0.35)"
              : "0 0 0 1px rgba(0,0,0,0.06) inset",
          }}
        />
      </div>
      <div className="flex items-center gap-2 text-sm text-zinc-700">
        <span
          className={`h-2 w-2 rounded-full ${
            live ? (isSpeaking ? "bg-indigo-500" : "bg-emerald-500 animate-pulse") : phase === "connecting" ? "bg-amber-500 animate-pulse" : "bg-zinc-300"
          }`}
        />
        {label}
      </div>
    </div>
  );
}
