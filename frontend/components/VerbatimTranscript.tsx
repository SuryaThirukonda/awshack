import { Fragment } from "react";
import { Pause } from "lucide-react";
import type { VerbatimItem } from "@/lib/api";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** What the candidate actually said, with fillers, stutters, pauses and audio events highlighted. */
export default function VerbatimTranscript({ items }: { items: VerbatimItem[] }) {
  if (!items.length) return <p className="text-sm text-zinc-500">No speech captured.</p>;
  // Split into answers at turn boundaries (where the interviewer was speaking).
  const turns: { start: number; items: VerbatimItem[] }[] = [];
  for (const it of items) {
    if (it.type === "turn" || !turns.length) turns.push({ start: "start" in it ? it.start : 0, items: [] });
    if (it.type !== "turn") turns[turns.length - 1].items.push(it);
  }
  return (
    <div className="space-y-4">
      {turns.map((t, i) => (
        <div key={i} className="flex gap-3">
          <span className="mt-0.5 shrink-0 font-mono text-[11px] text-zinc-500">{fmt(t.start)}</span>
          <p className="text-[15px] leading-8 text-zinc-200">
            {t.items.map((it, j) => (
              <Fragment key={j}>
                {it.type === "word" && (
                  <span
                    className={
                      it.stutter
                        ? "rounded bg-rose-500/20 px-1 text-rose-200 underline decoration-rose-400/60 decoration-wavy underline-offset-4"
                        : it.filler
                          ? "rounded bg-amber-400/15 px-1 text-amber-200"
                          : ""
                    }
                    title={it.stutter ? "Stutter / repetition" : it.filler ? "Filler word" : undefined}
                  >
                    {it.text}
                  </span>
                )}
                {it.type === "pause" && (
                  <span
                    className={`mx-0.5 inline-flex items-center gap-0.5 rounded-full border px-1.5 align-middle font-mono text-[10px] leading-4 ${
                      it.long ? "border-rose-400/40 bg-rose-500/10 text-rose-300" : "border-white/10 bg-white/5 text-zinc-400"
                    }`}
                    title={it.long ? "Long hesitation" : "Pause"}
                  >
                    <Pause className="mr-0.5 h-2.5 w-2.5" /> {it.duration}s
                  </span>
                )}
                {it.type === "event" && <span className="mx-0.5 font-mono text-xs italic text-sky-300">({it.text})</span>}{" "}
              </Fragment>
            ))}
          </p>
        </div>
      ))}
    </div>
  );
}
