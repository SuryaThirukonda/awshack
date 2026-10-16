"""Voice analysis (ElevenLabs Scribe) and interview feedback (Amazon Bedrock)."""

import json
import math
import os
import re

import boto3
import httpx

ELEVEN_BASE = "https://api.elevenlabs.io"

FILLERS_SINGLE = {"um", "umm", "uh", "uhh", "er", "ah", "hmm", "like", "basically", "actually", "literally"}
FILLERS_MULTI = ["you know", "kind of", "sort of", "i mean"]
PAUSE_THRESHOLD_S = 2.0


def scribe_transcribe(audio: bytes, filename: str, content_type: str) -> dict:
    resp = httpx.post(
        f"{ELEVEN_BASE}/v1/speech-to-text",
        headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"]},
        data={
            "model_id": "scribe_v2",
            "timestamps_granularity": "word",
            "tag_audio_events": "true",
            "no_verbatim": "false",
        },
        files={"file": (filename, audio, content_type)},
        timeout=120,
    )
    resp.raise_for_status()
    return resp.json()


def _clamp(x: float) -> int:
    return int(max(0, min(100, round(x))))


def _overlaps_agent(start: float, end: float, agent: list[list[float]], pad: float = 0.75) -> bool:
    return any(start < e + pad and end > s - pad for s, e in agent)


def voice_metrics(stt: dict, agent_speaking: list[list[float]] | None = None) -> dict:
    """agent_speaking: [[start_s, end_s], ...] relative to recording start, so interviewer turns
    aren't counted as candidate hesitation."""
    agent_speaking = agent_speaking or []
    words = [w for w in stt.get("words", []) if w.get("type") == "word" and w.get("text", "").strip()]
    events = [w["text"] for w in stt.get("words", []) if w.get("type") == "audio_event"]
    if not words:
        return {"word_count": 0, "empty": True, "transcript": stt.get("text", "")}

    tokens = [re.sub(r"[^\w']", "", w["text"].lower()) for w in words]
    text = " ".join(tokens)

    filler_counts: dict[str, int] = {}
    for t in tokens:
        if t in FILLERS_SINGLE:
            filler_counts[t] = filler_counts.get(t, 0) + 1
    for phrase in FILLERS_MULTI:
        n = len(re.findall(rf"\b{phrase}\b", text))
        if n:
            filler_counts[phrase] = n
    filler_total = sum(filler_counts.values())

    gaps = [max(0.0, words[i + 1]["start"] - words[i]["end"]) for i in range(len(words) - 1)]
    gap_spans = [(words[i]["end"], words[i + 1]["start"]) for i in range(len(words) - 1)]
    # Hesitation = a long silence mid-answer, not a turn boundary where the interviewer was talking.
    long_pauses = [
        g for g, (s, e) in zip(gaps, gap_spans) if PAUSE_THRESHOLD_S <= g < 20 and not _overlaps_agent(s, e, agent_speaking)
    ]
    hesitation_gaps = [g for g, (s, e) in zip(gaps, gap_spans) if not _overlaps_agent(s, e, agent_speaking)]
    # Speaking time excludes every long silence (interviewer turns and thinking time).
    total_span = words[-1]["end"] - words[0]["start"]
    speaking_time = max(1.0, total_span - sum(g for g in gaps if g >= PAUSE_THRESHOLD_S))
    minutes = speaking_time / 60
    wpm = len(words) / minutes
    filler_per_min = filler_total / minutes

    logprobs = [w["logprob"] for w in words if isinstance(w.get("logprob"), (int, float))]
    clarity = sum(math.exp(lp) for lp in logprobs) / len(logprobs) if logprobs else None

    # 0-100 scores with simple bands
    if 130 <= wpm <= 160:
        pace_score = 100
    elif wpm < 130:
        pace_score = _clamp(100 - (130 - wpm) * 1.5)
    else:
        pace_score = _clamp(100 - (wpm - 160) * 1.5)
    filler_score = _clamp(100 - max(0.0, filler_per_min - 1) * 12)
    pause_score = _clamp(100 - len(long_pauses) / max(minutes, 0.5) * 8)
    clarity_score = _clamp((clarity or 0.85) * 100)

    return {
        "word_count": len(words),
        "speaking_time_s": round(speaking_time, 1),
        "wpm": round(wpm),
        "filler_total": filler_total,
        "filler_per_min": round(filler_per_min, 1),
        "filler_breakdown": dict(sorted(filler_counts.items(), key=lambda kv: -kv[1])),
        "long_pauses": len(long_pauses),
        "longest_pause_s": round(max([g for g in hesitation_gaps if g < 20], default=0.0), 1),
        "clarity": round(clarity, 3) if clarity is not None else None,
        "audio_events": events[:20],
        "scores": {
            "pace": pace_score,
            "fillers": filler_score,
            "pauses": pause_score,
            "clarity": clarity_score,
        },
        "delivery_score": round((pace_score + filler_score + pause_score + clarity_score) / 4),
        "transcript": stt.get("text", ""),
    }


FEEDBACK_PROMPT = """You are an expert interview coach. Evaluate this {mode} mock interview for a {role} candidate.

Data (JSON):
{data}

Notes:
- "voice" metrics come from speech-to-text of the candidate's mic (WPM ideal 130-160, fillers ideally < 2/min).
- If "voice" is null (no audio captured), set "delivery" to null instead of guessing.
- "presence" is from webcam pose tracking (% of time with good posture / eye contact).
- In "coding" or "sql" mode, "code" is the final Python code / SQL query, "tests" the test results, and the transcript
  includes moments where the interviewer asked the candidate to explain what they were doing right now — grade that
  think-aloud communication under "communication" and correctness/quality/complexity under "technical".

Respond with ONLY a JSON object, no prose, matching exactly:
{{
  "overall": <0-100 int>,
  "summary": "<2 sentence overall assessment>",
  "scores": {{"content": <0-100>, "communication": <0-100>, "delivery": <0-100>, "presence": <0-100>{tech_field}}},
  "strengths": ["<specific strength>", "<...>", "<...>"],
  "improvements": ["<specific actionable improvement>", "<...>", "<...>"],
  "per_question": [{{"question": "<interviewer question, short>", "feedback": "<1-2 sentences>"}}]
}}"""


def _extract_json(text: str) -> dict:
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object in model output")
    return json.loads(text[start : end + 1])


def bedrock_feedback(payload: dict) -> dict:
    mode = payload.get("mode", "behavioral")
    prompt = FEEDBACK_PROMPT.format(
        mode=mode,
        role=payload.get("role") or "software engineer",
        data=json.dumps(payload, default=str)[:60000],
        tech_field=', "technical": <0-100>' if mode in ("coding", "sql") else "",
    )
    client = boto3.client("bedrock-runtime", region_name=os.environ.get("AWS_REGION", "us-east-1"))
    resp = client.converse(
        modelId=os.environ.get("BEDROCK_MODEL_ID", "us.anthropic.claude-sonnet-5-5"),
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": 2000},
    )
    text = "".join(c.get("text", "") for c in resp["output"]["message"]["content"])
    return _extract_json(text)


def fallback_feedback(payload: dict, voice: dict | None, reason: str) -> dict:
    """Metrics-only report when Bedrock is unavailable."""
    presence = payload.get("presence") or {}
    presence_score = round((presence.get("posture_pct", 0) + presence.get("eye_contact_pct", 0)) / 2)
    delivery = (voice or {}).get("delivery_score")
    scores = {"content": None, "communication": None, "delivery": delivery, "presence": presence_score}
    tests = payload.get("tests") or {}
    if payload.get("mode") in ("coding", "sql") and tests.get("total"):
        scores["technical"] = round(100 * tests.get("passed", 0) / tests["total"])
    known = [v for v in scores.values() if isinstance(v, (int, float))]
    return {
        "overall": round(sum(known) / len(known)) if known else 0,
        "summary": "AI feedback unavailable — showing measured delivery and presence metrics only.",
        "scores": scores,
        "strengths": [],
        "improvements": [],
        "per_question": [],
        "fallback_reason": reason,
    }
