"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, AudioLines, BookOpen, Briefcase, Code2, Database, Mic, PersonStanding, Sparkles, Wand2 } from "lucide-react";
import { API_BASE, saveRole } from "@/lib/api";
import { useRole } from "@/lib/useStored";
import { emit } from "@/lib/bus";
import { Card } from "@/components/ui";

const modes = [
  {
    href: "/interview",
    icon: Mic,
    title: "Regular interview",
    tag: "Behavioral",
    desc: "STAR-style questions with live posture coaching and voice delivery analysis.",
    accent: "bg-indigo-500/10 text-indigo-600",
  },
  {
    href: "/technical?kind=coding",
    icon: Code2,
    title: "Coding interview",
    tag: "Technical",
    desc: "Solve LeetCode-style problems in Python while the interviewer asks you to think aloud.",
    accent: "bg-sky-500/10 text-sky-600",
  },
  {
    href: "/technical?kind=sql",
    icon: Database,
    title: "SQL interview",
    tag: "Technical",
    desc: "Write queries against real tables; explain joins, filters and edge cases as you go.",
    accent: "bg-emerald-500/10 text-emerald-600",
  },
  {
    href: "/practice",
    icon: BookOpen,
    title: "Question review",
    tag: "Practice",
    desc: "Browse the question bank and review hints and optimal approaches with the voice guide.",
    accent: "bg-amber-500/10 text-amber-600",
  },
];

const features = [
  { icon: AudioLines, title: "Voice analysis", body: "ElevenLabs Scribe measures pace, filler words, pauses and clarity." },
  { icon: PersonStanding, title: "Posture & eye contact", body: "MediaPipe tracks slouching and gaze live, right in your browser." },
  { icon: Wand2, title: "AI feedback", body: "Claude on Amazon Bedrock grades content, communication and code." },
];

export default function Home() {
  const storedRole = useRole();
  const [draft, setRole] = useState<string | null>(null);
  const role = draft ?? storedRole;
  const [health, setHealth] = useState<"ok" | "down" | "checking">("checking");

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((r) => setHealth(r.ok ? "ok" : "down"))
      .catch(() => setHealth("down"));
  }, []);

  return (
    <div className="flex flex-col gap-10 pt-12">
      <section className="flex flex-col items-center text-center">
        <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-black/[0.04] px-3 py-1 text-xs text-zinc-700">
          <Sparkles className="h-3.5 w-3.5 text-indigo-600" /> Voice-first interview coach
        </span>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-zinc-900 sm:text-6xl">
          Practice out loud.{" "}
          <span className="text-indigo-600">Walk in with poise.</span>
        </h1>
        <p className="mt-5 max-w-xl text-base text-zinc-500">
          Mock interviews with a real-time voice interviewer that watches your posture, listens to your delivery, and follows your code as you write it.
        </p>

        <div className="mt-8 flex w-full max-w-lg flex-col gap-3 sm:flex-row">
          <label className="flex flex-1 items-center gap-2 rounded-xl border border-black/[0.08] bg-white/70 px-3 focus-within:border-indigo-500/50">
            <Briefcase className="h-4 w-4 text-zinc-500" />
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              onBlur={() => saveRole(role)}
              placeholder="Target role"
              className="h-11 flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
            />
          </label>
          <button
            onClick={() => {
              saveRole(role);
              emit({ type: "guide-ask", text: "Hi! What can you help me practice?" });
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-medium text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-500"
          >
            <Mic className="h-4 w-4" /> Talk to Poise
          </button>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Or press <kbd className="rounded border border-black/[0.08] bg-black/[0.04] px-1 font-mono">/</kbd> anywhere and say “start a coding interview”.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {modes.map(({ href, icon: Icon, title, tag, desc, accent }) => (
          <Link key={href} href={href} onClick={() => saveRole(role)} className="group">
            <Card className="relative h-full overflow-hidden p-5 transition group-hover:-translate-y-0.5 group-hover:border-black/[0.14] group-hover:bg-white/90">
              <div className="relative flex h-full flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className={`grid h-10 w-10 place-items-center rounded-xl ${accent}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{tag}</span>
                </div>
                <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
                <p className="flex-1 text-sm leading-relaxed text-zinc-500">{desc}</p>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600">
                  Start <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {features.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex gap-3 rounded-2xl border border-black/[0.06] p-4">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
            <div>
              <div className="text-sm font-medium text-zinc-900">{title}</div>
              <div className="mt-1 text-sm text-zinc-500">{body}</div>
            </div>
          </div>
        ))}
      </section>

      <p className="text-center text-xs text-zinc-400">
        Backend:{" "}
        <span className={health === "ok" ? "text-emerald-500" : health === "down" ? "text-rose-500" : "text-zinc-500"}>
          {health === "ok" ? "connected" : health === "down" ? `not reachable at ${API_BASE}` : "checking…"}
        </span>
      </p>
    </div>
  );
}
