"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  AudioLines,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Code2,
  Eye,
  MessageSquareQuote,
  Mic,
  PersonStanding,
  RotateCcw,
  ThumbsUp,
  TrendingUp,
} from "lucide-react";
import { MetricBar, PostureTimeline, ScoreRing } from "@/components/charts";
import Transcript from "@/components/Transcript";
import { Button, Card, CardHeader, Pill } from "@/components/ui";
import { emit, usePageContext } from "@/lib/bus";
import { fmtTime } from "@/lib/useInterviewSession";
import { useStoredReport } from "@/lib/useStored";

const MODE_LABEL = { behavioral: "Regular interview", coding: "Coding interview", sql: "SQL interview" } as const;
const RETRY_HREF = { behavioral: "/interview", coding: "/technical?kind=coding", sql: "/technical?kind=sql" } as const;

export default function ReportPage() {
  const report = useStoredReport();
  const [showTranscript, setShowTranscript] = useState(false);
  usePageContext({ page: "report", has_report: !!report });

  if (report === undefined) return null;
  if (!report) {
    return (
      <div className="grid flex-1 place-items-center">
        <Card className="flex max-w-sm flex-col items-center gap-4 p-8 text-center">
          <BarChart3 className="h-8 w-8 text-zinc-500" />
          <div>
            <div className="font-medium text-white">No report yet</div>
            <p className="mt-1 text-sm text-zinc-400">Finish a mock interview and your feedback will show up here.</p>
          </div>
          <Link href="/">
            <Button>Choose an interview</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const { feedback: fb, voice, presence } = report;
  const scoreLabels: [string, string][] = [
    ["content", "Content"],
    ["communication", "Communication"],
    ["delivery", "Delivery"],
    ["presence", "Presence"],
    ...(report.mode !== "behavioral" ? ([["technical", "Technical"]] as [string, string][]) : []),
  ];

  return (
    <div className="flex flex-col gap-5 pt-6">
      {/* Hero */}
      <Card className="relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
          <ScoreRing value={fb.overall} size={148} stroke={11} />
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="accent">{MODE_LABEL[report.mode]}</Pill>
              <Pill>{report.role}</Pill>
              <Pill>{fmtTime(report.durationS)}</Pill>
              {report.problem && <Pill>{report.problem.title}</Pill>}
            </div>
            <h1 className="text-2xl font-semibold text-white">Overall score</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-zinc-300">{fb.summary}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href={RETRY_HREF[report.mode]}>
                <Button>
                  <RotateCcw className="h-4 w-4" /> Try again
                </Button>
              </Link>
              <Button tone="ghost" onClick={() => emit({ type: "guide-ask", text: "Walk me through my latest interview report and what to work on first." })}>
                <Mic className="h-4 w-4" /> Discuss with Poise
              </Button>
            </div>
          </div>
        </div>
        {fb.source === "metrics" && (
          <div className="relative mt-6 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-xs text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            AI feedback (Bedrock) was unavailable, so this report shows measured metrics only. {fb.fallback_reason && <span className="text-amber-200/60">({fb.fallback_reason})</span>}
          </div>
        )}
      </Card>

      {/* Category scores */}
      <Card className="grid grid-cols-2 gap-6 p-6 sm:grid-cols-3 lg:grid-cols-5">
        {scoreLabels.map(([k, label]) => (
          <ScoreRing key={k} value={fb.scores?.[k] ?? null} label={label} size={88} />
        ))}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Voice */}
        <Card>
          <CardHeader title="Voice delivery" icon={<AudioLines className="h-4 w-4" />} right={<span className="text-xs text-zinc-500">ElevenLabs Scribe</span>} />
          <div className="space-y-5 p-5">
            {!voice || voice.empty ? (
              <p className="text-sm text-zinc-500">{report.voiceError ? `Voice analysis failed: ${report.voiceError}` : "Not enough speech was captured to analyze delivery."}</p>
            ) : (
              <>
                <MetricBar label="Pace" value={voice.wpm ?? 0} display={`${voice.wpm} wpm`} max={220} ideal={[130, 160]} score={voice.scores?.pace} hint="Conversational sweet spot is 130–160 words per minute." />
                <MetricBar label="Filler words" value={voice.filler_per_min ?? 0} display={`${voice.filler_total} total · ${voice.filler_per_min}/min`} max={12} ideal={[0, 2]} score={voice.scores?.fillers} hint="Aim for fewer than 2 per minute." />
                <MetricBar label="Hesitation pauses (>2s)" value={voice.long_pauses ?? 0} display={`${voice.long_pauses} · longest ${voice.longest_pause_s}s`} max={10} ideal={[0, 2]} score={voice.scores?.pauses} />
                <MetricBar label="Clarity" value={Math.round((voice.clarity ?? 0) * 100)} display={`${Math.round((voice.clarity ?? 0) * 100)}%`} max={100} ideal={[85, 100]} score={voice.scores?.clarity} hint="Transcription confidence — a proxy for articulation." />
                {voice.filler_breakdown && Object.keys(voice.filler_breakdown).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(voice.filler_breakdown).map(([w, n]) => (
                      <Pill key={w} tone="warn">
                        “{w}” × {n}
                      </Pill>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </Card>

        {/* Presence */}
        <Card>
          <CardHeader title="Posture & eye contact" icon={<PersonStanding className="h-4 w-4" />} right={<span className="text-xs text-zinc-500">MediaPipe</span>} />
          <div className="space-y-5 p-5">
            <div className="grid grid-cols-3 gap-3">
              <Stat icon={<PersonStanding className="h-4 w-4" />} label="Good posture" value={`${presence.posture_pct}%`} />
              <Stat icon={<Eye className="h-4 w-4" />} label="Eye contact" value={`${presence.eye_contact_pct}%`} />
              <Stat icon={<TrendingUp className="h-4 w-4" />} label="Slouch events" value={String(presence.slouch_events)} />
            </div>
            <PostureTimeline timeline={presence.timeline} />
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Strengths" icon={<ThumbsUp className="h-4 w-4" />} />
          <ul className="space-y-2 p-5">
            {fb.strengths?.length ? (
              fb.strengths.map((s, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-zinc-200">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> {s}
                </li>
              ))
            ) : (
              <li className="text-sm text-zinc-500">—</li>
            )}
          </ul>
        </Card>
        <Card>
          <CardHeader title="What to improve" icon={<TrendingUp className="h-4 w-4" />} />
          <ul className="space-y-2 p-5">
            {fb.improvements?.length ? (
              fb.improvements.map((s, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-zinc-200">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-amber-400/20 font-mono text-[10px] text-amber-300">{i + 1}</span>
                  {s}
                </li>
              ))
            ) : (
              <li className="text-sm text-zinc-500">—</li>
            )}
          </ul>
        </Card>
      </div>

      {report.mode !== "behavioral" && report.code !== undefined && (
        <Card>
          <CardHeader
            title={report.mode === "sql" ? "Final query" : "Final code"}
            icon={<Code2 className="h-4 w-4" />}
            right={report.tests ? <Pill tone={report.tests.passed === report.tests.total && !report.tests.error ? "good" : "bad"}>{report.tests.passed}/{report.tests.total} tests passed</Pill> : <Pill>Tests not run</Pill>}
          />
          <pre className="scrollbar-thin max-h-80 overflow-auto p-5 font-mono text-xs leading-relaxed text-zinc-200">{report.code}</pre>
        </Card>
      )}

      {fb.per_question?.length > 0 && (
        <Card>
          <CardHeader title="Question-by-question" icon={<MessageSquareQuote className="h-4 w-4" />} />
          <div className="divide-y divide-white/[0.05]">
            {fb.per_question.map((q, i) => (
              <div key={i} className="p-5">
                <div className="text-sm font-medium text-white">{q.question}</div>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{q.feedback}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <button onClick={() => setShowTranscript((s) => !s)} className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-zinc-200">
          <span className="flex items-center gap-2">
            <MessageSquareQuote className="h-4 w-4 text-zinc-400" /> Full transcript ({report.transcript.length} turns)
          </span>
          <ChevronDown className={`h-4 w-4 text-zinc-400 transition ${showTranscript ? "rotate-180" : ""}`} />
        </button>
        {showTranscript && (
          <div className="border-t border-white/[0.06]">
            <Transcript lines={report.transcript} />
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-white">{value}</div>
    </div>
  );
}
