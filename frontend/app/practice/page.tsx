"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookOpen, ChevronRight, Code2, Database, Eye, Lightbulb, Loader2, Mic, Play, Target } from "lucide-react";
import { Button, Card, CardHeader, Pill, difficultyTone } from "@/components/ui";
import { ErrorBanner } from "@/components/session";
import { getProblems, type Problem } from "@/lib/api";
import { emit, useCommand, usePageContext } from "@/lib/bus";

type Filter = "all" | "coding" | "sql";

export default function PracticePage() {
  return (
    <Suspense>
      <Practice />
    </Suspense>
  );
}

function Practice() {
  const params = useSearchParams();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(params.get("problem"));
  const [reveal, setReveal] = useState<{ id?: string; hints: number; approach: boolean }>({ hints: 0, approach: false });

  useEffect(() => {
    getProblems().then(setProblems).catch((e) => setError(String(e.message ?? e)));
  }, []);

  const list = useMemo(() => problems.filter((p) => filter === "all" || p.kind === filter), [problems, filter]);
  const problem = problems.find((p) => p.id === selectedId) ?? list[0];

  // Revealed hints/approach are tracked per problem, so switching problems starts fresh.
  const current = reveal.id === problem?.id ? reveal : { id: problem?.id, hints: 0, approach: false };
  const hintsShown = current.hints;
  const showApproach = current.approach;
  const setHintsShown = (f: (n: number) => number) => setReveal({ ...current, hints: f(current.hints) });
  const setShowApproach = (v: boolean) => setReveal({ ...current, approach: v });

  usePageContext({ page: "practice", filter, problem: problem && { id: problem.id, title: problem.title, kind: problem.kind }, hints_revealed: hintsShown, approach_revealed: showApproach });
  useCommand((cmd) => {
    if (cmd.type === "select-problem") {
      setSelectedId(cmd.problemId);
      return true;
    }
  });

  const review = (p: Problem) =>
    emit({ type: "guide-ask", text: `Let's review the problem "${p.title}" (id ${p.id}). Walk me through it like a tutor.` });

  return (
    <div className="flex flex-1 flex-col gap-5 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5">
            <BookOpen className="h-5 w-5 text-amber-300" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-white">Question review</h1>
            <p className="text-sm text-zinc-400">LeetCode-style and SQL questions — study with hints, or review out loud with Poise.</p>
          </div>
        </div>
        <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {(["all", "coding", "sql"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-sm capitalize transition ${filter === f ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              {f === "sql" ? "SQL" : f}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorBanner message={`Could not load problems: ${error}`} />}

      <div className="grid flex-1 gap-5 lg:grid-cols-12">
        <Card className="overflow-hidden lg:col-span-4">
          <CardHeader title={`${list.length} questions`} icon={<Target className="h-4 w-4" />} />
          {!problems.length && !error ? (
            <div className="flex items-center gap-2 p-4 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {list.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => setSelectedId(p.id)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${problem?.id === p.id ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5">
                      {p.kind === "sql" ? <Database className="h-4 w-4 text-emerald-300" /> : <Code2 className="h-4 w-4 text-sky-300" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-white">{p.title}</div>
                      <div className="truncate text-xs text-zinc-500">{p.tags.join(" · ")}</div>
                    </div>
                    <Pill tone={difficultyTone(p.difficulty)}>{p.difficulty}</Pill>
                    <ChevronRight className="h-4 w-4 text-zinc-600" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {problem && (
          <div className="flex flex-col gap-5 lg:col-span-8">
            <Card className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-white">{problem.title}</h2>
                    <Pill tone={difficultyTone(problem.difficulty)}>{problem.difficulty}</Pill>
                    <Pill tone="accent">{problem.kind === "sql" ? "SQL" : "Coding"}</Pill>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {problem.tags.map((t) => (
                      <Pill key={t}>{t}</Pill>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button tone="ghost" onClick={() => review(problem)}>
                    <Mic className="h-4 w-4" /> Review with Poise
                  </Button>
                  <Link href={`/technical?kind=${problem.kind}&problem=${problem.id}`}>
                    <Button>
                      <Play className="h-4 w-4" /> Mock interview
                    </Button>
                  </Link>
                </div>
              </div>
              <p className="mt-5 text-sm leading-relaxed text-zinc-300">{problem.prompt}</p>
              {problem.tables && (
                <pre className="mt-4 overflow-x-auto rounded-xl border border-white/[0.06] bg-black/30 p-3 font-mono text-xs text-emerald-200/90">{problem.tables.join("\n")}</pre>
              )}
              <div className="mt-4 space-y-1.5">
                {problem.examples.map((ex) => (
                  <code key={ex} className="block rounded-lg bg-white/[0.05] px-3 py-2 font-mono text-xs text-zinc-300">
                    {ex}
                  </code>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Hints"
                icon={<Lightbulb className="h-4 w-4" />}
                right={
                  hintsShown < problem.hints.length && (
                    <button onClick={() => setHintsShown((n) => n + 1)} className="text-xs font-medium text-indigo-300 hover:text-indigo-200">
                      Reveal hint {hintsShown + 1} of {problem.hints.length}
                    </button>
                  )
                }
              />
              <div className="space-y-2 p-4">
                {hintsShown === 0 && <p className="text-sm text-zinc-500">Try it first. Reveal hints one at a time when you&apos;re stuck.</p>}
                {problem.hints.slice(0, hintsShown).map((h, i) => (
                  <div key={i} className="flex gap-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-3 py-2.5 text-sm text-amber-100/90">
                    <span className="font-mono text-xs text-amber-300">{i + 1}</span>
                    {h}
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Optimal approach"
                icon={<Eye className="h-4 w-4" />}
                right={
                  !showApproach && (
                    <button onClick={() => setShowApproach(true)} className="text-xs font-medium text-indigo-300 hover:text-indigo-200">
                      Reveal solution approach
                    </button>
                  )
                }
              />
              <div className="p-4">
                {showApproach ? (
                  <div className="space-y-3">
                    <p className="text-sm leading-relaxed text-zinc-200">{problem.approach}</p>
                    <Pill tone="good">{problem.complexity}</Pill>
                  </div>
                ) : (
                  <div className="h-16 rounded-xl bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.03),rgba(255,255,255,0.03)_8px,transparent_8px,transparent_16px)]" />
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
