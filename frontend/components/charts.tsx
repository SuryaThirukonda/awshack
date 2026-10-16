import type { PresenceSummary } from "@/lib/api";
import { scoreTone, toneColor } from "./ui";

export function ScoreRing({ value, label, size = 96, stroke = 8 }: { value: number | null | undefined; label?: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = typeof value === "number" ? Math.max(0, Math.min(100, value)) : null;
  const color = toneColor[scoreTone(v)];
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
          {v !== null && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={color}
              strokeWidth={stroke}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - v / 100)}
              style={{ transition: "stroke-dashoffset 1s ease", filter: `drop-shadow(0 0 6px ${color}66)` }}
            />
          )}
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-semibold tabular-nums text-white" style={{ fontSize: size * 0.28 }}>
            {v ?? "—"}
          </span>
        </div>
      </div>
      {label && <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">{label}</span>}
    </div>
  );
}

/** Horizontal bar with an "ideal range" band. */
export function MetricBar({
  label,
  value,
  display,
  max,
  ideal,
  hint,
  score,
}: {
  label: string;
  value: number;
  display: string;
  max: number;
  ideal?: [number, number];
  hint?: string;
  score?: number;
}) {
  const pct = (x: number) => `${Math.max(0, Math.min(100, (x / max) * 100))}%`;
  const color = toneColor[scoreTone(score)];
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-zinc-300">{label}</span>
        <span className="font-mono text-sm tabular-nums text-white">{display}</span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.06]">
        {ideal && (
          <div
            className="absolute inset-y-0 bg-emerald-400/15"
            style={{ left: pct(ideal[0]), width: `calc(${pct(ideal[1])} - ${pct(ideal[0])})` }}
          />
        )}
        <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style={{ width: pct(value), background: color }} />
      </div>
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

export function PostureTimeline({ timeline }: { timeline: PresenceSummary["timeline"] }) {
  const colors = { good: "bg-emerald-400/80", warn: "bg-amber-400/80", bad: "bg-rose-400/80", none: "bg-zinc-700" };
  if (!timeline.length) return <p className="text-sm text-zinc-500">No posture data recorded.</p>;
  return (
    <div>
      <div className="flex h-8 gap-[2px] overflow-hidden rounded-lg">
        {timeline.map((t, i) => (
          <div key={i} className={`flex-1 ${colors[t]}`} title={t} />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-zinc-500">
        <span>Start</span>
        <div className="flex gap-3">
          <Legend c="bg-emerald-400/80" l="Good" />
          <Legend c="bg-amber-400/80" l="One issue" />
          <Legend c="bg-rose-400/80" l="Slouch + looking away" />
          <Legend c="bg-zinc-700" l="Not visible" />
        </div>
        <span>End</span>
      </div>
    </div>
  );
}

function Legend({ c, l }: { c: string; l: string }) {
  return (
    <span className="hidden items-center gap-1 sm:inline-flex">
      <span className={`h-2 w-2 rounded-sm ${c}`} />
      {l}
    </span>
  );
}
