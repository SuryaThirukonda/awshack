"use client";

import { useEffect, useRef } from "react";

/** Tiny app-wide command bus so the voice guide can drive whichever page is mounted. */
export type Command =
  | { type: "start-interview" }
  | { type: "end-interview" }
  | { type: "select-problem"; problemId: string }
  | { type: "guide-ask"; text: string }
  | { type: "interview-starting" }
  | { type: "interview-phase"; phase: string };

const EVT = "poise:cmd";
const REPLAYABLE = new Set<Command["type"]>(["start-interview", "select-problem"]);
let pending: { cmd: Command; at: number }[] = [];

/** Dispatch a command. Replayable commands nobody handled are kept briefly for a page that mounts next. */
export function emit(cmd: Command) {
  const ev = new CustomEvent<Command>(EVT, { detail: cmd, cancelable: true });
  const unhandled = window.dispatchEvent(ev);
  if (unhandled && REPLAYABLE.has(cmd.type)) pending.push({ cmd, at: Date.now() });
}

/** Subscribe to commands. Return `true` from the handler to mark a command as handled. */
export function useCommand(handler: (cmd: Command) => boolean | void) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    const fn = (e: Event) => {
      if (ref.current((e as CustomEvent<Command>).detail) === true) e.preventDefault();
    };
    window.addEventListener(EVT, fn);
    const fresh = pending.filter((p) => Date.now() - p.at < 8000);
    pending = [];
    for (const p of fresh) if (ref.current(p.cmd) !== true) pending.push(p);
    return () => window.removeEventListener(EVT, fn);
  }, []);
}

/** What the current page is showing, readable by the voice guide's get_page_context tool. */
let pageContext: Record<string, unknown> = {};
export const getPageContext = () => pageContext;
export function usePageContext(ctx: Record<string, unknown>) {
  const key = JSON.stringify(ctx);
  useEffect(() => {
    pageContext = JSON.parse(key);
    return () => {
      pageContext = {};
    };
  }, [key]);
}
