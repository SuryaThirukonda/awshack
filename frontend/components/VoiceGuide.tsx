"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { AudioLines, Loader2, Mic, PhoneOff, Sparkles } from "lucide-react";
import { getProblems, getToken, loadReport, loadRole, saveRole, type Problem } from "@/lib/api";
import { emit, getPageContext, useCommand } from "@/lib/bus";

const ROUTES: Record<string, string> = {
  home: "/",
  interview: "/interview",
  coding: "/technical?kind=coding",
  sql: "/technical?kind=sql",
  practice: "/practice",
  report: "/report",
};

let problemCache: Problem[] | null = null;
const problems = async () => (problemCache ??= await getProblems());

export default function VoiceGuide() {
  return (
    <ConversationProvider>
      <Guide />
    </ConversationProvider>
  );
}

function Guide() {
  const router = useRouter();
  const [lines, setLines] = useState<{ role: string; text: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const pendingAsk = useRef<string | null>(null);

  const path = () => window.location.pathname + window.location.search;

  const conversation = useConversation({
    onMessage: ({ message, role }) => message?.trim() && setLines((l) => [...l.slice(-5), { role, text: message }]),
    onConnect: () => {
      setConnecting(false);
      if (pendingAsk.current) {
        const text = pendingAsk.current;
        pendingAsk.current = null;
        setTimeout(() => conversation.sendUserMessage(text), 600);
      }
    },
    onDisconnect: () => setConnecting(false),
    onError: (m) => {
      setError(typeof m === "string" ? m : "Voice error");
      setConnecting(false);
    },
    clientTools: {
      navigate: ({ page }: { page?: string }) => {
        const route = ROUTES[page ?? ""];
        if (!route) return `Unknown page. Valid pages: ${Object.keys(ROUTES).join(", ")}`;
        router.push(route);
        return `Navigated to ${page}.`;
      },
      start_interview: () => {
        const p = window.location.pathname;
        if (!p.startsWith("/interview") && !p.startsWith("/technical")) {
          return "Not on an interview page. Navigate to interview, coding, or sql first, then call start_interview.";
        }
        setTimeout(() => {
          conversation.endSession();
          emit({ type: "start-interview" });
        }, 2500);
        return "Starting now. Say one short line handing over to the interviewer Alex; you will disconnect in 2 seconds.";
      },
      end_interview: () => {
        emit({ type: "end-interview" });
        return "Ending the interview and generating the report.";
      },
      list_problems: async ({ kind }: { kind?: string }) => {
        const list = (await problems()).filter((p) => !kind || kind === "all" || p.kind === kind);
        return JSON.stringify(list.map(({ id, title, kind, difficulty, tags }) => ({ id, title, kind, difficulty, tags })));
      },
      get_problem: async ({ problem_id }: { problem_id?: string }) => {
        const p = (await problems()).find((x) => x.id === problem_id);
        if (!p) return "No problem with that id. Call list_problems.";
        const { id, title, kind, difficulty, tags, prompt, examples, hints, approach, complexity, tables } = p;
        return JSON.stringify({ id, title, kind, difficulty, tags, prompt, examples, tables, hints, approach, complexity });
      },
      select_problem: async ({ problem_id }: { problem_id?: string }) => {
        const p = (await problems()).find((x) => x.id === problem_id);
        if (!p) return "No problem with that id. Call list_problems.";
        const here = path();
        if (here.startsWith("/practice") || (here.startsWith("/technical") && here.includes(`kind=${p.kind}`))) {
          emit({ type: "select-problem", problemId: p.id });
        } else if (here.startsWith("/technical")) {
          router.push(`/technical?kind=${p.kind}&problem=${p.id}`);
        } else {
          router.push(`/practice?problem=${p.id}`);
        }
        return `Showing "${p.title}" on screen.`;
      },
      set_role: ({ role }: { role?: string }) => {
        if (!role) return "No role given.";
        saveRole(role);
        return `Target role set to ${role}.`;
      },
      get_page_context: () => {
        const ctx: Record<string, unknown> = { page: path(), role: loadRole(), ...getPageContext() };
        if (window.location.pathname.startsWith("/report")) {
          const r = loadReport();
          if (r) ctx.report = { mode: r.mode, feedback: r.feedback, voice: r.voice?.scores, presence: { posture_pct: r.presence.posture_pct, eye_contact_pct: r.presence.eye_contact_pct } };
        }
        return JSON.stringify(ctx);
      },
    },
  });

  const live = conversation.status === "connected";

  async function start(ask?: string) {
    setError(null);
    setLines([]);
    setConnecting(true);
    pendingAsk.current = ask ?? null;
    try {
      const { token } = await getToken("guide");
      conversation.startSession({ conversationToken: token, connectionType: "webrtc" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setConnecting(false);
    }
  }

  useCommand((cmd) => {
    if (cmd.type === "interview-starting" && conversation.status !== "disconnected") conversation.endSession();
    if (cmd.type === "interview-phase") setHidden(cmd.phase !== "idle");
    if (cmd.type === "guide-ask") {
      if (live) conversation.sendUserMessage(cmd.text);
      else start(cmd.text);
      return true;
    }
  });

  // Keyboard shortcut: press "/" (outside inputs/editors) to talk to the guide.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "/" || t.closest("input, textarea, [contenteditable], .monaco-editor")) return;
      e.preventDefault();
      if (!live && !connecting && !hidden) start();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (hidden) return null;

  if (!live && !connecting) {
    return (
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2">
        {error && <div className="max-w-xs rounded-xl border border-rose-400/30 bg-rose-950/80 px-3 py-2 text-xs text-rose-200">{error}</div>}
        <button
          onClick={() => start()}
          className="group flex items-center gap-2.5 rounded-full border border-white/10 bg-zinc-900/90 py-2 pl-2 pr-4 text-sm text-zinc-100 shadow-2xl shadow-black/50 backdrop-blur transition hover:border-indigo-400/40 hover:bg-zinc-800/90"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-400 shadow-lg shadow-indigo-500/40 transition group-hover:scale-105">
            <Mic className="h-4 w-4 text-white" />
          </span>
          Ask Poise
          <kbd className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">/</kbd>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 w-[340px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/95 shadow-2xl shadow-black/60 backdrop-blur-xl">
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
        <span className="relative grid h-9 w-9 place-items-center">
          {conversation.isSpeaking && <span className="orb-ring absolute inset-0 rounded-full bg-indigo-500/50" />}
          <span className="relative grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-400">
            {connecting ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : conversation.isSpeaking ? <AudioLines className="h-4 w-4 text-white" /> : <Sparkles className="h-4 w-4 text-white" />}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-white">Poise guide</div>
          <div className="text-xs text-zinc-400">{connecting ? "Connecting…" : conversation.isSpeaking ? "Speaking" : "Listening — try “start a SQL interview”"}</div>
        </div>
        <button onClick={() => conversation.endSession()} className="grid h-8 w-8 place-items-center rounded-full bg-rose-500/90 text-white hover:bg-rose-500" title="End">
          <PhoneOff className="h-4 w-4" />
        </button>
      </div>
      <div className="scrollbar-thin max-h-56 space-y-2 overflow-y-auto px-4 py-3 text-sm">
        {lines.length === 0 ? (
          <p className="text-zinc-500">Say things like “review Two Sum with me”, “open SQL practice”, or “explain my report”.</p>
        ) : (
          lines.map((l, i) => (
            <p key={i} className={l.role === "user" ? "text-indigo-200" : "text-zinc-200"}>
              <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{l.role === "user" ? "You" : "Poise"}</span>
              {l.text}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
