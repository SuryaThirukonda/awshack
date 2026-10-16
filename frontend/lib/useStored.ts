"use client";

import { useMemo, useSyncExternalStore } from "react";
import { loadRole, type Report } from "./api";

const subscribe = (cb: () => void) => {
  window.addEventListener("poise:role", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("poise:role", cb);
    window.removeEventListener("storage", cb);
  };
};

/** Target role from localStorage, kept in sync across the app. */
export const useRole = () => useSyncExternalStore(subscribe, loadRole, () => "Software Engineer");

const SSR = "__ssr__";
const readRaw = () => {
  try {
    return sessionStorage.getItem("poise:last-report") ?? localStorage.getItem("poise:last-report");
  } catch {
    return null;
  }
};

export function setCurrentReport(raw: string) {
  try {
    sessionStorage.setItem("poise:last-report", raw);
    localStorage.setItem("poise:last-report", raw);
  } catch {}
  window.dispatchEvent(new Event("storage"));
}

/** Last saved report; `undefined` during SSR / before hydration. */
export function useStoredReport(): Report | null | undefined {
  const raw = useSyncExternalStore(subscribe, readRaw, () => SSR);
  return useMemo(() => (raw === SSR ? undefined : raw ? (JSON.parse(raw) as Report) : null), [raw]);
}
