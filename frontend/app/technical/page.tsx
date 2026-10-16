"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Editor, { type BeforeMount } from "@monaco-editor/react";
import { ConversationProvider } from "@elevenlabs/react";
import { CheckCircle2, Code2, Database, Hand, Loader2, MessagesSquare, Mic, MicOff, Play, RotateCcw, Square, TestTube2, XCircle } from "lucide-react";
import CameraPanel from "@/components/CameraPanel";
import Transcript from "@/components/Transcript";
import VoiceOrb from "@/components/VoiceOrb";
import { AnalyzingOverlay, ErrorBanner, SessionHeader } from "@/components/session";
import { Button, Card, CardHeader, Pill, difficultyTone } from "@/components/ui";
import { getProblems, runCode, type Kind, type Problem, type RunResult } from "@/lib/api";
import { useCommand, usePageContext } from "@/lib/bus";
import { useInterviewSession } from "@/lib/useInterviewSession";
import { useRole } from "@/lib/useStored";
import { usePosture } from "@/lib/usePosture";

const CHECK_IN_EVERY_MS = 75_000;
const CODE_SYNC_DEBOUNCE_MS = 4_000;

export default function TechnicalPage() {
  return (
    <Suspense>
      <ConversationProvider>
        <TechnicalSession />
      </ConversationProvider>
    </Suspense>
  );
}

const defineTheme: BeforeMount = (monaco) => {
  monaco.editor.defineTheme("poise", {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: { "editor.background": "#0b0d13", "editor.lineHighlightBackground": "#ffffff08", "editorGutter.background": "#0b0d13" },
  });
};

function TechnicalSession() {
  const router = useRouter();
  const params = useSearchParams();
  const kind: Kind = params.get("kind") === "sql" ? "sql" : "coding";

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const posture = usePosture(videoRef, canvasRef);
  const role = useRole();

  const [all, setAll] = useState<Problem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(params.get("problem"));
  const [codeById, setCodeById] = useState<Record<string, string>>({});
  const [runState, setRunState] = useState<{ id: string; result: RunResult } | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    getProblems().then(setAll).catch((e) => setLoadError(String(e.message ?? e)));
  }, []);

  const problems = useMemo(() => all.filter((p) => p.kind === kind), [all, kind]);
  const problem = problems.find((p) => p.id === selectedId) ?? problems[0];
  const code = problem ? (codeById[problem.id] ?? problem.starter) : "";
  const run = runState && runState.id === problem?.id ? runState.result : null;
  const setRun = (result: RunResult) => problem && setRunState({ id: problem.id, result });

  const session = useInterviewSession({ mode: kind, role, startTracking: posture.startTracking, stopTracking: posture.stopTracking });
  const { phase, conversation } = session;
  const live = phase === "live";
  const active = live || phase === "connecting";

  // Live code → interviewer (silent context), debounced.
  useEffect(() => {
    if (!live || !problem) return;
    const id = setTimeout(() => {
      conversation.sendContextualUpdate(`CANDIDATE ${kind === "sql" ? "SQL QUERY" : "PYTHON CODE"} (live snapshot):\n${code}`);
    }, CODE_SYNC_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [code, live, kind, problem, conversation]);

  const checkIn = useCallback(() => {
    conversation.sendContextualUpdate(`CANDIDATE ${kind === "sql" ? "SQL QUERY" : "PYTHON CODE"} (live snapshot):\n${code}`);
    conversation.sendUserMessage("[interviewer cue] Ask me to explain what I'm doing right now.");
  }, [conversation, code, kind]);

  // Periodic "what's going on now?" check-ins.
  const checkInRef = useRef(checkIn);
  useEffect(() => {
    checkInRef.current = checkIn;
  }, [checkIn]);
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => !conversation.isSpeaking && checkInRef.current(), CHECK_IN_EVERY_MS);
    return () => clearInterval(id);
  }, [live, conversation]);

  async function runTests() {
    if (!problem) return;
    setRunning(true);
    try {
      const r = await runCode(problem.id, code);
      setRun(r);
      if (live) {
        conversation.sendContextualUpdate(
          `TEST RESULTS: ${r.passed}/${r.total} passed.${r.error ? ` Error: ${r.error.slice(0, 400)}` : ""}`,
        );
      }
    } catch (e) {
      setRun({ error: e instanceof Error ? e.message : String(e), results: [], passed: 0, total: problem.test_count });
    } finally {
      setRunning(false);
    }
  }

  function start() {
    if (!problem) return;
    const tables = problem.tables?.length ? ` Tables: ${problem.tables.join(" ")}` : "";
    session.start({ problem: `${problem.title} (${problem.difficulty}). ${problem.prompt}${tables}` });
  }
  const finish = () => session.finish({ problem, code, tests: run });

  usePageContext({
    page: kind,
    phase,
    problem: problem && { id: problem.id, title: problem.title },
    tests: run && { passed: run.passed, total: run.total },
  });
  useCommand((cmd) => {
    if (cmd.type === "start-interview" && phase === "idle" && problem) return void start(), true;
    if (cmd.type === "end-interview" && (live || phase === "ended")) return void finish(), true;
    if (cmd.type === "select-problem" && !active) {
      const p = all.find((x) => x.id === cmd.problemId);
      if (p?.kind === kind || (!all.length && cmd.problemId)) {
        setSelectedId(cmd.problemId);
        return true;
      }
    }
  });

  return (
    <div className="flex flex-1 flex-col gap-5 pt-6">
      <SessionHeader
        icon={kind === "sql" ? <Database className="h-5 w-5 text-emerald-300" /> : <Code2 className="h-5 w-5 text-sky-300" />}
        title="Technical interview"
        subtitle={`${kind === "sql" ? "SQL" : "Coding"} · ${role}`}
        seconds={session.seconds}
        phase={phase}
      >
        <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
          {(["coding", "sql"] as const).map((k) => (
            <button
              key={k}
              disabled={active}
              onClick={() => router.replace(`/technical?kind=${k}`)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition disabled:cursor-not-allowed ${
                kind === k ? "bg-white/10 text-white" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {k === "sql" ? <Database className="h-4 w-4" /> : <Code2 className="h-4 w-4" />}
              {k === "sql" ? "SQL" : "Coding"}
            </button>
          ))}
        </div>
        {phase === "idle" && (
          <Button onClick={start} disabled={!problem}>
            <Play className="h-4 w-4" /> Start interview
          </Button>
        )}
        {active && (
          <>
            <Button tone="ghost" onClick={checkIn} disabled={!live} title="Have the interviewer ask what you're doing">
              <Hand className="h-4 w-4" /> Check in
            </Button>
            <Button tone="ghost" onClick={() => conversation.setMuted(!conversation.isMuted)}>
              {conversation.isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Button tone="danger" onClick={finish}>
              <Square className="h-4 w-4" /> End & report
            </Button>
          </>
        )}
        {phase === "ended" && (
          <Button onClick={finish}>
            <Square className="h-4 w-4" /> Get report
          </Button>
        )}
      </SessionHeader>

      {(session.error || loadError) && <ErrorBanner message={session.error ?? `Could not load problems: ${loadError}`} />}

      <div className="grid flex-1 gap-5 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-8">
          {/* Problem picker + statement */}
          <Card>
            <div className="flex gap-2 overflow-x-auto border-b border-white/[0.06] p-2">
              {problems.map((p) => (
                <button
                  key={p.id}
                  disabled={active}
                  onClick={() => setSelectedId(p.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition disabled:cursor-not-allowed ${
                    problem?.id === p.id ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${p.difficulty === "Easy" ? "bg-emerald-400" : p.difficulty === "Medium" ? "bg-amber-400" : "bg-rose-400"}`} />
                  {p.title}
                </button>
              ))}
              {!problems.length && !loadError && (
                <span className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading problems…
                </span>
              )}
            </div>
            {problem && (
              <div className="space-y-3 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="mr-1 text-base font-semibold text-white">{problem.title}</h2>
                  <Pill tone={difficultyTone(problem.difficulty)}>{problem.difficulty}</Pill>
                  {problem.tags.map((t) => (
                    <Pill key={t}>{t}</Pill>
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-zinc-300">{problem.prompt}</p>
                {problem.tables && (
                  <pre className="overflow-x-auto rounded-xl border border-white/[0.06] bg-black/30 p-3 font-mono text-xs text-emerald-200/90">{problem.tables.join("\n")}</pre>
                )}
                <div className="flex flex-wrap gap-2">
                  {problem.examples.map((ex) => (
                    <code key={ex} className="rounded-lg bg-white/[0.05] px-2.5 py-1 font-mono text-xs text-zinc-300">
                      {ex}
                    </code>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Editor */}
          <Card className="overflow-hidden">
            <CardHeader
              title={kind === "sql" ? "query.sql" : "solution.py"}
              icon={kind === "sql" ? <Database className="h-4 w-4" /> : <Code2 className="h-4 w-4" />}
              right={
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => problem && setCodeById((m) => ({ ...m, [problem.id]: problem.starter }))}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </button>
                  <Button onClick={runTests} disabled={running || !problem} className="px-3 py-1.5 text-xs">
                    {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube2 className="h-3.5 w-3.5" />}
                    {kind === "sql" ? "Run query" : "Run tests"}
                  </Button>
                </div>
              }
            />
            <Editor
              height="380px"
              theme="poise"
              beforeMount={defineTheme}
              language={kind === "sql" ? "sql" : "python"}
              value={code}
              onChange={(v) => {
                if (!problem) return;
                setCodeById((m) => ({ ...m, [problem.id]: v ?? "" }));
                if (live) conversation.sendUserActivity();
              }}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: "var(--font-jetbrains), monospace",
                scrollBeyondLastLine: false,
                padding: { top: 14 },
                renderLineHighlight: "line",
                smoothScrolling: true,
              }}
              loading={<Loader2 className="h-5 w-5 animate-spin text-zinc-500" />}
            />
          </Card>

          {run && <Results run={run} kind={kind} />}
        </div>

        {/* Interviewer side panel */}
        <div className="flex flex-col gap-5 lg:col-span-4">
          <CameraPanel compact videoRef={videoRef} canvasRef={canvasRef} ready={posture.ready} error={posture.error} live={posture.live} />
          <Card className="flex flex-col items-center py-6">
            <VoiceOrb phase={phase} isSpeaking={conversation.isSpeaking} size={110} />
            {phase === "idle" && (
              <p className="mt-3 max-w-xs px-4 text-center text-xs text-zinc-500">
                Alex sees your {kind === "sql" ? "query" : "code"} as you type and will periodically ask you to explain what you&apos;re doing.
              </p>
            )}
          </Card>
          <Card className="flex min-h-[220px] flex-1 flex-col">
            <CardHeader title="Transcript" icon={<MessagesSquare className="h-4 w-4" />} />
            <div className="scrollbar-thin max-h-[360px] flex-1 overflow-y-auto">
              <Transcript lines={session.transcript} empty="Think out loud — your explanations are graded too." />
            </div>
          </Card>
        </div>
      </div>

      {phase === "analyzing" && <AnalyzingOverlay />}
    </div>
  );
}

function Results({ run, kind }: { run: RunResult; kind: Kind }) {
  const allPassed = !run.error && run.passed === run.total;
  return (
    <Card>
      <CardHeader
        title={kind === "sql" ? "Query result" : "Test results"}
        icon={<TestTube2 className="h-4 w-4" />}
        right={<Pill tone={allPassed ? "good" : "bad"}>{run.passed}/{run.total} passed</Pill>}
      />
      <div className="space-y-2 p-4">
        {run.error && <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-rose-500/10 p-3 font-mono text-xs text-rose-200">{run.error}</pre>}
        {kind === "sql" && run.columns && run.rows && (
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-white/[0.04] text-zinc-400">
                <tr>
                  {run.columns.map((c) => (
                    <th key={c} className="px-3 py-2 font-medium">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {run.rows.map((r, i) => (
                  <tr key={i} className="border-t border-white/[0.04] text-zinc-200">
                    {r.map((v, j) => (
                      <td key={j} className="px-3 py-1.5">{v === null ? <span className="text-zinc-500">NULL</span> : String(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!run.rows.length && <div className="px-3 py-2 text-xs text-zinc-500">No rows returned.</div>}
          </div>
        )}
        {kind === "coding" &&
          run.results.map((r, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 font-mono text-xs">
              {r.passed ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />}
              <div className="min-w-0 space-y-0.5 text-zinc-300">
                <div className="truncate"><span className="text-zinc-500">input </span>{JSON.stringify(r.input)}</div>
                <div><span className="text-zinc-500">expected </span>{JSON.stringify(r.expected)}</div>
                {!r.passed && <div className="text-rose-300"><span className="text-zinc-500">got </span>{typeof r.got === "string" ? r.got : JSON.stringify(r.got)}</div>}
              </div>
            </div>
          ))}
      </div>
    </Card>
  );
}
