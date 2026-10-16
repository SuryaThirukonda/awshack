"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, Code2, MessagesSquare, Sparkles } from "lucide-react";

const links = [
  { href: "/interview", label: "Interview", icon: MessagesSquare },
  { href: "/technical", label: "Technical", icon: Code2 },
  { href: "/practice", label: "Practice", icon: BookOpen },
  { href: "/report", label: "Report", icon: BarChart3 },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-600 shadow-sm shadow-indigo-600/30">
            <Sparkles className="h-4 w-4 text-white" />
          </span>
          Poise
        </Link>
        <nav className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                  active ? "bg-black/[0.06] text-zinc-900" : "text-zinc-500 hover:bg-black/[0.04] hover:text-zinc-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
