import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-2xl border border-black/[0.07] bg-white/70 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-14px_rgba(16,24,40,0.12)] backdrop-blur ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHeader({ icon, title, right }: { icon?: ReactNode; title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-medium text-zinc-800">
        {icon && <span className="text-zinc-500">{icon}</span>}
        {title}
      </div>
      {right}
    </div>
  );
}

const pillTones = {
  good: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
  warn: "border-amber-500/25 bg-amber-500/10 text-amber-700",
  bad: "border-rose-500/20 bg-rose-500/10 text-rose-700",
  neutral: "border-black/[0.08] bg-white/60 text-zinc-600",
  accent: "border-indigo-500/20 bg-indigo-500/10 text-indigo-700",
};

export function Pill({ tone = "neutral", children }: { tone?: keyof typeof pillTones; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${pillTones[tone]}`}>
      {children}
    </span>
  );
}

const btnTones = {
  primary: "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-500 disabled:bg-indigo-600/40 disabled:shadow-none",
  danger: "bg-rose-600 text-white shadow-sm shadow-rose-600/20 hover:bg-rose-500 disabled:opacity-40",
  ghost: "border border-black/[0.08] bg-white/70 text-zinc-800 backdrop-blur hover:bg-white disabled:opacity-40",
};

export function Button({
  tone = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: keyof typeof btnTones }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition active:scale-[0.98] disabled:cursor-not-allowed ${btnTones[tone]} ${className}`}
    />
  );
}

export function scoreTone(v: number | null | undefined): "good" | "warn" | "bad" | "neutral" {
  if (v === null || v === undefined) return "neutral";
  return v >= 75 ? "good" : v >= 50 ? "warn" : "bad";
}

export const toneColor = { good: "#10b981", warn: "#f59e0b", bad: "#f43f5e", neutral: "#a1a1aa" };

export const difficultyTone = (d: string) => (d === "Easy" ? "good" : d === "Medium" ? "warn" : "bad");
