"use client";

import { useEffect, useRef } from "react";
import type { TranscriptLine } from "@/lib/api";

export default function Transcript({ lines, empty = "The conversation will appear here." }: { lines: TranscriptLine[]; empty?: string }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Block body on purpose: scrollIntoView returns a Promise in newer browsers, and an effect must not return one.
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lines.length]);

  if (!lines.length) {
    return <div className="grid h-full place-items-center p-6 text-center text-sm text-zinc-500">{empty}</div>;
  }
  return (
    <div className="flex flex-col gap-3 p-4">
      {lines.map((l, i) => (
        <div key={i} className={`flex ${l.role === "user" ? "justify-end" : "justify-start"}`}>
          <div
            className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
              l.role === "user"
                ? "rounded-br-md bg-indigo-600 text-white shadow-sm"
                : "rounded-bl-md border border-black/[0.06] bg-white/80 text-zinc-800 shadow-sm"
            }`}
          >
            <div className={`mb-0.5 text-[10px] font-semibold uppercase tracking-wider ${l.role === "user" ? "text-indigo-100" : "text-zinc-500"}`}>
              {l.role === "user" ? "You" : "Alex"}
            </div>
            {l.text}
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
