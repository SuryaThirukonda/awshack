# Poise — AI Interview Coach

Voice-first mock interviews with live posture coaching, voice-delivery analysis, and think-aloud grading.

- **Regular interview**: behavioral (STAR) questions from a voice interviewer (ElevenLabs Agents).
- **Technical interview**: two tabs.
  - **Coding**: LeetCode-style problems in Python.
  - **SQL**: queries against seeded tables.

  The interviewer sees your code live and periodically asks *"what are you doing right now?"*.
- **Practice**: a question bank with hints and optimal approaches. You can review any question out loud with the voice guide.
- **Poise voice guide**: press `/` or click **Ask Poise** to navigate the app by voice. Try "start a SQL interview", "review Two Sum with me" or "explain my report".
- **Report**: a single report page covering:
  - Voice metrics from ElevenLabs Scribe: pace, filler words, hesitation pauses, clarity.
  - Posture and eye contact from MediaPipe, running in the browser.
  - AI feedback from Claude on Amazon Bedrock.

## Setup

```bash
# 1. Secrets: repo-root .env
ELEVENLABS_API_KEY=...
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-5-5

# 2. Backend
cd backend
uv venv .venv && uv pip install -r requirements.txt --python .venv/bin/python
.venv/bin/python create_agent.py      # one-time: creates the interviewer + guide agents, writes their ids to ../.env
.venv/bin/uvicorn main:app --reload --port 8000

# 3. Frontend (new terminal)
cd frontend && npm install && npm run dev   # http://localhost:3000

# 4. AWS credentials for Bedrock feedback
aws login        # or aws configure sso
```

If Bedrock is unavailable, the report still shows the measured voice and posture metrics.

## Architecture

| Piece | Where |
| --- | --- |
| Voice interviewer and guide | `@elevenlabs/react` over WebRTC, using short-lived tokens from `GET /api/eleven/token?agent=interviewer\|guide` |
| Live code to interviewer | `sendContextualUpdate` (debounced), with `sendUserMessage` for check-ins (`app/technical/page.tsx`) |
| Guide client tools | `navigate`, `start_interview`, `end_interview`, `list_problems`, `get_problem`, `select_problem`, `set_role`, `get_page_context` (`components/VoiceGuide.tsx`, defined in `backend/create_agent.py`) |
| Posture and eye contact | MediaPipe Pose + Face Landmarker, calibrated baseline (`lib/usePosture.ts`) |
| Voice analysis | Mic recorded with MediaRecorder, then Scribe v2 word timestamps, then metrics (`backend/analysis.py`) |
| Code and SQL runner | Python subprocess with timeout, and in-memory SQLite (`backend/runner.py`). Local demo only; use a real sandbox when hosted. |
| Feedback | Bedrock Converse with Claude, plus a metrics-only fallback (`backend/analysis.py`) |
