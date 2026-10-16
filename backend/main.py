import json
import os
import re
from datetime import datetime
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import Body, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from analysis import ELEVEN_BASE, bedrock_feedback, fallback_feedback, scribe_transcribe, voice_metrics  # noqa: E402
from problems import PROBLEMS, public_problem  # noqa: E402
from runner import run_code, run_sql  # noqa: E402

SESSIONS_DIR = Path(__file__).resolve().parent / "data" / "sessions"

app = FastAPI(title="Interview Prep API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "elevenlabs_key": bool(os.environ.get("ELEVENLABS_API_KEY")),
        "agent_id": bool(os.environ.get("ELEVENLABS_AGENT_ID")),
        "guide_agent_id": bool(os.environ.get("ELEVENLABS_GUIDE_AGENT_ID")),
    }


@app.get("/api/eleven/token")
def eleven_token(agent: str = "interviewer"):
    """Short-lived WebRTC token. agent=interviewer (mock interviews) or guide (voice navigation / question review)."""
    env_var = "ELEVENLABS_GUIDE_AGENT_ID" if agent == "guide" else "ELEVENLABS_AGENT_ID"
    key, agent_id = os.environ.get("ELEVENLABS_API_KEY"), os.environ.get(env_var)
    if not key or not agent_id:
        raise HTTPException(500, f"Set ELEVENLABS_API_KEY and {env_var} in backend/.env (run create_agent.py)")
    resp = httpx.get(
        f"{ELEVEN_BASE}/v1/convai/conversation/token",
        params={"agent_id": agent_id},
        headers={"xi-api-key": key},
        timeout=15,
    )
    if resp.status_code != 200:
        raise HTTPException(resp.status_code, f"ElevenLabs token error: {resp.text[:300]}")
    return {"token": resp.json()["token"]}


@app.get("/api/problems")
def problems():
    return [public_problem(p) for p in PROBLEMS.values()]


class RunRequest(BaseModel):
    problem_id: str
    code: str


@app.post("/api/run")
def run(req: RunRequest):
    if req.problem_id not in PROBLEMS:
        raise HTTPException(404, "Unknown problem")
    if PROBLEMS[req.problem_id]["kind"] == "sql":
        return run_sql(req.problem_id, req.code)
    return run_code(req.problem_id, req.code)


@app.post("/api/analyze")
async def analyze(payload: str = Form(...), audio: UploadFile | None = File(None)):
    """payload: JSON {mode, role, transcript[], presence{}, code?, tests?, problem?}; audio: candidate mic recording.

    Everything is also saved locally under backend/data/sessions/<session_id>/ (audio, Scribe output, verbatim
    transcript, analysis) so the candidate can revisit exactly what they said."""
    data = json.loads(payload)
    session_id = f"{datetime.now():%Y%m%d-%H%M%S}-{data.get('mode', 'interview')}"
    session_dir = SESSIONS_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)

    voice, voice_error = None, None
    if audio is not None:
        blob = await audio.read()
        ext = "mp4" if "mp4" in (audio.content_type or "") else "webm"
        (session_dir / f"audio.{ext}").write_bytes(blob)
        if len(blob) > 2000:
            try:
                stt = scribe_transcribe(blob, audio.filename or f"answer.{ext}", audio.content_type or "audio/webm")
                (session_dir / "scribe.json").write_text(json.dumps(stt, indent=2))
                voice = voice_metrics(stt, data.get("agent_speaking"))
                (session_dir / "transcript.txt").write_text(
                    "Verbatim transcript (ElevenLabs Scribe). *word* = filler, <word> = stutter, [pause Ns] = hesitation.\n\n"
                    + voice.get("transcript_text", "")
                    + "\n"
                )
            except Exception as e:  # keep the report working even if STT fails
                voice_error = f"{type(e).__name__}: {e}"[:300]
    data.pop("agent_speaking", None)
    data["voice"] = {k: v for k, v in (voice or {}).items() if k not in ("transcript", "transcript_text", "verbatim")} or None
    if voice and voice.get("transcript_text"):
        data["candidate_speech_transcript"] = voice["transcript_text"]

    try:
        feedback = bedrock_feedback(data)
        feedback["source"] = "bedrock"
    except Exception as e:
        feedback = fallback_feedback(data, voice, f"{type(e).__name__}: {e}"[:300])
        feedback["source"] = "metrics"

    result = {"session_id": session_id, "feedback": feedback, "voice": voice, "voice_error": voice_error}
    (session_dir / "analysis.json").write_text(json.dumps(result | {"payload": data}, indent=2, default=str))
    return result


def _session_dir(session_id: str) -> Path:
    if not re.fullmatch(r"[\w-]+", session_id):
        raise HTTPException(400, "Bad session id")
    d = SESSIONS_DIR / session_id
    if not d.is_dir():
        raise HTTPException(404, "Session not found")
    return d


@app.put("/api/sessions/{session_id}/report")
def save_report(session_id: str, report: dict = Body(...)):
    """The frontend saves the full report it rendered so history can show it again."""
    (_session_dir(session_id) / "report.json").write_text(json.dumps(report, indent=2, default=str))
    return {"ok": True}


@app.get("/api/sessions")
def list_sessions():
    out = []
    for d in sorted(SESSIONS_DIR.glob("*"), reverse=True) if SESSIONS_DIR.exists() else []:
        f = d / "report.json"
        if not f.exists():
            continue
        r = json.loads(f.read_text())
        out.append({
            "id": d.name,
            "mode": r.get("mode"),
            "role": r.get("role"),
            "createdAt": r.get("createdAt"),
            "durationS": r.get("durationS"),
            "overall": (r.get("feedback") or {}).get("overall"),
            "has_audio": any(d.glob("audio.*")),
        })
    return out


@app.get("/api/sessions/{session_id}")
def get_session(session_id: str):
    f = _session_dir(session_id) / "report.json"
    if not f.exists():
        raise HTTPException(404, "No report saved for this session")
    return json.loads(f.read_text())


@app.get("/api/sessions/{session_id}/audio")
def get_audio(session_id: str):
    files = list(_session_dir(session_id).glob("audio.*"))
    if not files:
        raise HTTPException(404, "No audio for this session")
    return FileResponse(files[0], media_type="audio/mp4" if files[0].suffix == ".mp4" else "audio/webm")


@app.get("/api/sessions/{session_id}/transcript.txt")
def get_transcript(session_id: str):
    f = _session_dir(session_id) / "transcript.txt"
    if not f.exists():
        raise HTTPException(404, "No transcript for this session")
    return FileResponse(f, media_type="text/plain", filename=f"{session_id}-transcript.txt")
