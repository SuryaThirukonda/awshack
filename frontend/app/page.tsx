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
    accent: "from-indigo-500/20 to-indigo-500/0",
  },
  {
    href: "/technical?kind=coding",
    icon: Code2,
    title: "Coding interview",
    tag: "Technical",
    desc: "Solve LeetCode-style problems in Python while the interviewer asks you to think aloud.",
    accent: "from-sky-500/20 to-sky-500/0",
  },
  {
    href: "/technical?kind=sql",
    icon: Database,
    title: "SQL interview",
    tag: "Technical",
    desc: "Write queries against real tables; explain joins, filters and edge cases as you go.",
    accent: "from-emerald-500/20 to-emerald-500/0",
  },
  {
    href: "/practice",
    icon: BookOpen,
    title: "Question review",
    tag: "Practice",
    desc: "Browse the question bank and review hints and optimal approaches with the voice guide.",
    accent: "from-amber-500/20 to-amber-500/0",
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
        <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
          <Sparkles className="h-3.5 w-3.5 text-indigo-300" /> Voice-first interview coach
        </span>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
          Practice out loud.{" "}
          <span className="bg-gradient-to-r from-indigo-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent">Walk in with poise.</span>
        </h1>
        <p className="mt-5 max-w-xl text-base text-zinc-400">
          Mock interviews with a real-time voice interviewer that watches your posture, listens to your delivery, and follows your code as you write it.
        </p>

        <div className="mt-8 flex w-full max-w-lg flex-col gap-3 sm:flex-row">
          <label className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 focus-within:border-indigo-400/50">
            <Briefcase className="h-4 w-4 text-zinc-500" />
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              onBlur={() => saveRole(role)}
              placeholder="Target role"
              className="h-11 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
            />
          </label>
          <button
            onClick={() => {
              saveRole(role);
              emit({ type: "guide-ask", text: "Hi! What can you help me practice?" });
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 text-sm font-medium text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400"
          >
            <Mic className="h-4 w-4" /> Talk to Poise
          </button>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Or press <kbd className="rounded border border-white/10 bg-white/5 px-1 font-mono">/</kbd> anywhere and say “start a coding interview”.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {modes.map(({ href, icon: Icon, title, tag, desc, accent }) => (
          <Link key={href} href={href} onClick={() => saveRole(role)} className="group">
            <Card className="relative h-full overflow-hidden p-5 transition group-hover:-translate-y-0.5 group-hover:border-white/20">
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${accent}`} />
              <div className="relative flex h-full flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5">
                    <Icon className="h-5 w-5 text-white" />
                  </span>
                  <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">{tag}</span>
                </div>
                <h3 className="text-base font-semibold text-white">{title}</h3>
                <p className="flex-1 text-sm leading-relaxed text-zinc-400">{desc}</p>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-indigo-300">
                  Start <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {features.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex gap-3 rounded-2xl border border-white/[0.06] p-4">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-indigo-300" />
            <div>
              <div className="text-sm font-medium text-white">{title}</div>
              <div className="mt-1 text-sm text-zinc-400">{body}</div>
            </div>
          </div>
        ))}
      </section>

      <p className="text-center text-xs text-zinc-600">
        Backend:{" "}
        <span className={health === "ok" ? "text-emerald-400" : health === "down" ? "text-rose-400" : "text-zinc-500"}>
          {health === "ok" ? "connected" : health === "down" ? `not reachable at ${API_BASE}` : "checking…"}
        </span>
      </p>
    </div>
  );
}
