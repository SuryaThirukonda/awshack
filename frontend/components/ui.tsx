import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-2xl border border-white/[0.08] bg-white/[0.025] shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_20px_40px_-20px_rgba(0,0,0,0.6)] backdrop-blur ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHeader({ icon, title, right }: { icon?: ReactNode; title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
        {icon && <span className="text-zinc-400">{icon}</span>}
        {title}
      </div>
      {right}
    </div>
  );
}

const pillTones = {
  good: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  warn: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  bad: "border-rose-400/30 bg-rose-400/10 text-rose-300",
  neutral: "border-white/10 bg-white/5 text-zinc-300",
  accent: "border-indigo-400/30 bg-indigo-400/10 text-indigo-300",
};

export function Pill({ tone = "neutral", children }: { tone?: keyof typeof pillTones; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${pillTones[tone]}`}>
      {children}
    </span>
  );
}

const btnTones = {
  primary:
    "bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-400 disabled:bg-indigo-500/40 disabled:shadow-none",
  danger: "bg-rose-500/90 text-white hover:bg-rose-500 disabled:opacity-40",
  ghost: "border border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08] disabled:opacity-40",
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

export const toneColor = { good: "#34d399", warn: "#fbbf24", bad: "#fb7185", neutral: "#71717a" };

export const difficultyTone = (d: string) => (d === "Easy" ? "good" : d === "Medium" ? "warn" : "bad");
