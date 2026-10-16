export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export type TranscriptLine = { role: "user" | "agent"; text: string; t: number };

export type PresenceSummary = {
  posture_pct: number;
  eye_contact_pct: number;
  eyes_closed_pct?: number;
  looking_away_pct?: number;
  slouch_events: number;
  samples: number;
  timeline: ("good" | "warn" | "bad" | "none")[];
};

export type Kind = "coding" | "sql";
export type Mode = "behavioral" | Kind;

export type Problem = {
  id: string;
  kind: Kind;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  tags: string[];
  hints: string[];
  approach: string;
  complexity: string;
  tables?: string[];
  function?: string;
  prompt: string;
  examples: string[];
  starter: string;
  test_count: number;
};

export type TestResult = { input: unknown; expected: unknown; got: unknown; passed: boolean };
export type RunResult = {
  error: string | null;
  results: TestResult[];
  passed: number;
  total: number;
  stderr?: string;
  columns?: string[];
  rows?: unknown[][];
};

export type VerbatimItem =
  | { type: "word"; text: string; start: number; filler: boolean; stutter: boolean }
  | { type: "pause"; duration: number; long: boolean }
  | { type: "event"; text: string; start: number }
  | { type: "turn"; start: number };

export type VoiceMetrics = {
  word_count: number;
  empty?: boolean;
  speaking_time_s?: number;
  wpm?: number;
  filler_total?: number;
  filler_per_min?: number;
  filler_breakdown?: Record<string, number>;
  stutter_total?: number;
  stutters_per_min?: number;
  stutter_examples?: string[];
  long_pauses?: number;
  short_pauses?: number;
  longest_pause_s?: number;
  clarity?: number | null;
  scores?: { pace: number; fillers: number; stutters?: number; pauses: number; clarity: number };
  delivery_score?: number;
  transcript_text?: string;
  verbatim?: VerbatimItem[];
};

export type Feedback = {
  overall: number;
  summary: string;
  scores: Record<string, number | null>;
  strengths: string[];
  improvements: string[];
  per_question: { question: string; feedback: string }[];
  source: "bedrock" | "metrics";
  fallback_reason?: string;
};

export type Report = {
  sessionId?: string;
  mode: Mode;
  role: string;
  createdAt: number;
  durationS: number;
  transcript: TranscriptLine[];
  presence: PresenceSummary;
  voice: VoiceMetrics | null;
  voiceError?: string | null;
  feedback: Feedback;
  problem?: Problem;
  code?: string;
  tests?: RunResult | null;
};

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export const getToken = (agent: "interviewer" | "guide" = "interviewer") =>
  fetch(`${API_BASE}/api/eleven/token?agent=${agent}`).then((r) => json<{ token: string }>(r));
export const getProblems = () => fetch(`${API_BASE}/api/problems`).then((r) => json<Problem[]>(r));
export const runCode = (problem_id: string, code: string) =>
  fetch(`${API_BASE}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ problem_id, code }),
  }).then((r) => json<RunResult>(r));

export async function analyze(payload: Record<string, unknown>, audio: Blob | null) {
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  if (audio) form.append("audio", audio, "candidate.webm");
  const res = await fetch(`${API_BASE}/api/analyze`, { method: "POST", body: form });
  return json<{ session_id: string; feedback: Feedback; voice: VoiceMetrics | null; voice_error: string | null }>(res);
}

/** Locally saved sessions (backend/data/sessions). */
export type SessionSummary = { id: string; mode: Mode; role: string; createdAt: number; durationS: number; overall: number; has_audio: boolean };
export const listSessions = () => fetch(`${API_BASE}/api/sessions`).then((r) => json<SessionSummary[]>(r));
export const getSession = (id: string) => fetch(`${API_BASE}/api/sessions/${id}`).then((r) => json<Report>(r));
export const saveSessionReport = (id: string, report: Report) =>
  fetch(`${API_BASE}/api/sessions/${id}/report`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(report),
  }).catch(() => undefined);
export const sessionAudioUrl = (id: string) => `${API_BASE}/api/sessions/${id}/audio`;
export const sessionTranscriptUrl = (id: string) => `${API_BASE}/api/sessions/${id}/transcript.txt`;

const REPORT_KEY = "poise:last-report";
export function saveReport(r: Report) {
  try {
    sessionStorage.setItem(REPORT_KEY, JSON.stringify(r));
    localStorage.setItem(REPORT_KEY, JSON.stringify(r));
  } catch {}
}
export function loadReport(): Report | null {
  try {
    const raw = sessionStorage.getItem(REPORT_KEY) ?? localStorage.getItem(REPORT_KEY);
    return raw ? (JSON.parse(raw) as Report) : null;
  } catch {
    return null;
  }
}

const ROLE_KEY = "poise:role";
export function loadRole() {
  try {
    return localStorage.getItem(ROLE_KEY) || "Software Engineer";
  } catch {
    return "Software Engineer";
  }
}
export function saveRole(role: string) {
  try {
    localStorage.setItem(ROLE_KEY, role);
  } catch {}
  window.dispatchEvent(new CustomEvent("poise:role", { detail: role }));
}
