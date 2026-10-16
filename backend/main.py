import json
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from analysis import ELEVEN_BASE, bedrock_feedback, fallback_feedback, scribe_transcribe, voice_metrics  # noqa: E402
from problems import PROBLEMS, public_problem  # noqa: E402
from runner import run_code, run_sql  # noqa: E402

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
    """payload: JSON {mode, role, transcript[], presence{}, code?, tests?, problem?}; audio: candidate mic recording."""
    data = json.loads(payload)

    voice, voice_error = None, None
    if audio is not None:
        blob = await audio.read()
        if len(blob) > 2000:
            try:
                stt = scribe_transcribe(blob, audio.filename or "answer.webm", audio.content_type or "audio/webm")
                voice = voice_metrics(stt, data.get("agent_speaking"))
            except Exception as e:  # keep the report working even if STT fails
                voice_error = f"{type(e).__name__}: {e}"[:300]
    data.pop("agent_speaking", None)
    data["voice"] = {k: v for k, v in (voice or {}).items() if k != "transcript"} or None
    if voice and voice.get("transcript"):
        data["candidate_speech_transcript"] = voice["transcript"]

    try:
        feedback = bedrock_feedback(data)
        feedback["source"] = "bedrock"
    except Exception as e:
        feedback = fallback_feedback(data, voice, f"{type(e).__name__}: {e}"[:300])
        feedback["source"] = "metrics"

    return {"feedback": feedback, "voice": voice, "voice_error": voice_error}
