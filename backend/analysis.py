"""Voice analysis (ElevenLabs Scribe) and interview feedback (Amazon Bedrock)."""

import json
import math
import os
import re

import boto3
import httpx

from config import eleven_key

ELEVEN_BASE = "https://api.elevenlabs.io"

FILLERS_SINGLE = {"um", "umm", "uh", "uhh", "er", "ah", "hmm", "like", "basically", "actually", "literally"}
FILLERS_MULTI = ["you know", "kind of", "sort of", "i mean"]
PAUSE_THRESHOLD_S = 2.0


def scribe_transcribe(audio: bytes, filename: str, content_type: str) -> dict:
    resp = httpx.post(
        f"{ELEVEN_BASE}/v1/speech-to-text",
        headers={"xi-api-key": eleven_key() or ""},
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


SHORT_PAUSE_S = 0.6
LIKE_NOT_FILLER_AFTER = {"i'd", "would", "you'd", "we'd", "they'd", "looks", "look", "looked", "feel", "feels", "felt", "sounds", "something", "things"}


def _norm(t: str) -> str:
    return re.sub(r"[^\w']", "", t.lower())


def _flag_words(words: list[dict]) -> tuple[list[bool], list[bool]]:
    """Per-word (filler, stutter) flags. Scribe keeps disfluencies when no_verbatim=false."""
    toks = [_norm(w["text"]) for w in words]
    filler = [False] * len(words)
    stutter = [False] * len(words)
    for i, t in enumerate(toks):
        prev = toks[i - 1] if i else ""
        nxt = toks[i + 1] if i + 1 < len(toks) else ""
        if t in FILLERS_SINGLE and not (t == "like" and prev in LIKE_NOT_FILLER_AFTER):
            filler[i] = True
        if f"{t} {nxt}" in FILLERS_MULTI:
            filler[i] = filler[i + 1] = True
        raw = words[i]["text"].strip()
        # "th-", "I-I", "w-we" → broken-off word; "I I think" → immediate repetition
        if re.search(r"\w[-–—]$", raw) or re.match(r"^(\w{1,4})[-–—]\1", raw, re.I):
            stutter[i] = True
        elif t and t == nxt and words[i + 1]["start"] - words[i]["end"] < 1.0:
            stutter[i] = True
    return filler, stutter


def _fmt_ts(sec: float) -> str:
    return f"{int(sec // 60):02d}:{int(sec % 60):02d}"


def build_verbatim(stt: dict, filler: list[bool], stutter: list[bool], agent: list[list[float]]) -> tuple[list[dict], str]:
    """Annotated verbatim transcript: words (with filler/stutter flags), pauses, audio events, and turn breaks."""
    items: list[dict] = []
    lines: list[str] = []
    cur: list[str] = []
    wi = 0
    prev_end = None

    def new_turn(at: float):
        if cur:
            lines.append(" ".join(cur))
            cur.clear()
        lines.append(f"\n[{_fmt_ts(at)}]")

    for w in stt.get("words", []):
        kind = w.get("type")
        if kind == "audio_event":
            items.append({"type": "event", "text": w["text"].strip("()[] "), "start": round(w.get("start", 0), 2)})
            cur.append(f"({w['text'].strip('()[] ')})")
            continue
        if kind != "word" or not w.get("text", "").strip():
            continue
        if prev_end is None:
            new_turn(w["start"])
        else:
            gap = w["start"] - prev_end
            if gap >= SHORT_PAUSE_S:
                if gap >= 20 or _overlaps_agent(prev_end, w["start"], agent):
                    items.append({"type": "turn", "start": round(w["start"], 2)})
                    new_turn(w["start"])
                else:
                    long = gap >= PAUSE_THRESHOLD_S
                    items.append({"type": "pause", "duration": round(gap, 1), "long": long})
                    cur.append(f"[{'long ' if long else ''}pause {gap:.1f}s]")
        text = w["text"].strip()
        items.append({"type": "word", "text": text, "start": round(w["start"], 2), "filler": filler[wi], "stutter": stutter[wi]})
        cur.append(f"<{text}>" if stutter[wi] else f"*{text}*" if filler[wi] else text)
        prev_end = w["end"]
        wi += 1
    if cur:
        lines.append(" ".join(cur))
    return items, "\n".join(lines).strip()


def voice_metrics(stt: dict, agent_speaking: list[list[float]] | None = None) -> dict:
    """agent_speaking: [[start_s, end_s], ...] relative to recording start, so interviewer turns
    aren't counted as candidate hesitation."""
    agent_speaking = agent_speaking or []
    words = [w for w in stt.get("words", []) if w.get("type") == "word" and w.get("text", "").strip()]
    events = [w["text"] for w in stt.get("words", []) if w.get("type") == "audio_event"]
    if not words:
        return {"word_count": 0, "empty": True, "transcript": stt.get("text", ""), "verbatim": [], "transcript_text": ""}

    filler, stutter = _flag_words(words)
    verbatim, transcript_text = build_verbatim(stt, filler, stutter, agent_speaking)

    filler_counts: dict[str, int] = {}
    toks = [_norm(w["text"]) for w in words]
    i = 0
    while i < len(toks):
        if filler[i]:
            pair = f"{toks[i]} {toks[i + 1]}" if i + 1 < len(toks) else ""
            key = pair if pair in FILLERS_MULTI else toks[i]
            filler_counts[key] = filler_counts.get(key, 0) + 1
            i += 2 if key == pair else 1
        else:
            i += 1
    filler_total = sum(filler_counts.values())
    stutter_total = sum(stutter)

    gaps = [max(0.0, words[i + 1]["start"] - words[i]["end"]) for i in range(len(words) - 1)]
    gap_spans = [(words[i]["end"], words[i + 1]["start"]) for i in range(len(words) - 1)]
    # Hesitation = a silence mid-answer, not a turn boundary where the interviewer was talking.
    hesitation_gaps = [g for g, (s, e) in zip(gaps, gap_spans) if g < 20 and not _overlaps_agent(s, e, agent_speaking)]
    long_pauses = [g for g in hesitation_gaps if g >= PAUSE_THRESHOLD_S]
    short_pauses = [g for g in hesitation_gaps if SHORT_PAUSE_S <= g < PAUSE_THRESHOLD_S]
    # Speaking time excludes every long silence (interviewer turns and thinking time).
    total_span = words[-1]["end"] - words[0]["start"]
    speaking_time = max(1.0, total_span - sum(g for g in gaps if g >= PAUSE_THRESHOLD_S))
    minutes = speaking_time / 60
    wpm = len(words) / minutes
    filler_per_min = filler_total / minutes
    stutters_per_min = stutter_total / minutes

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
    stutter_score = _clamp(100 - max(0.0, stutters_per_min - 0.5) * 25)
    pause_score = _clamp(100 - len(long_pauses) / max(minutes, 0.5) * 8)
    clarity_score = _clamp((clarity or 0.85) * 100)
    scores = {"pace": pace_score, "fillers": filler_score, "stutters": stutter_score, "pauses": pause_score, "clarity": clarity_score}

    return {
        "word_count": len(words),
        "speaking_time_s": round(speaking_time, 1),
        "wpm": round(wpm),
        "filler_total": filler_total,
        "filler_per_min": round(filler_per_min, 1),
        "filler_breakdown": dict(sorted(filler_counts.items(), key=lambda kv: -kv[1])),
        "stutter_total": stutter_total,
        "stutters_per_min": round(stutters_per_min, 1),
        "stutter_examples": [words[i]["text"] + " " + words[i + 1]["text"] for i in range(len(words) - 1) if stutter[i]][:8],
        "long_pauses": len(long_pauses),
        "short_pauses": len(short_pauses),
        "longest_pause_s": round(max(hesitation_gaps, default=0.0), 1),
        "clarity": round(clarity, 3) if clarity is not None else None,
        "audio_events": events[:20],
        "scores": scores,
        "delivery_score": round(sum(scores.values()) / len(scores)),
        "transcript": stt.get("text", ""),
        "transcript_text": transcript_text,
        "verbatim": verbatim,
    }


FEEDBACK_PROMPT = """You are an expert interview coach. Evaluate this {mode} mock interview for a {role} candidate.

Data (JSON):
{data}

Notes:
- "voice" metrics come from verbatim speech-to-text of the candidate's mic (WPM ideal 130-160, fillers ideally
  < 2/min, stutters = repeated or broken-off words). "candidate_speech_transcript" is that verbatim transcript, where
  *word* marks a filler, <word> a stutter, and [pause Ns] a hesitation.
- If "voice" is null (no audio captured), set "delivery" to null instead of guessing.
- "presence.eye_contact_pct" = % of time the candidate's eyes were open, visible and facing the camera
  (eyes_closed_pct / looking_away_pct break down the rest).
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
