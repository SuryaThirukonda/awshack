"""One-time setup: create the two ElevenLabs agents and save their ids to the repo-root .env.

  * Interviewer ("Alex") — runs behavioral / coding / SQL mock interviews.
  * Guide ("Poise")      — voice assistant that navigates the app and reviews practice questions via client tools.

Usage: .venv/bin/python create_agent.py   (needs ELEVENLABS_API_KEY in .env)
       .venv/bin/python create_agent.py --key-var ELEVENLABS_API_KEY2 --suffix 2
           → creates the agents in another account and saves ELEVENLABS_AGENT_ID2 / ELEVENLABS_GUIDE_AGENT_ID2
"""

import argparse
import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT_ENV = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv(ROOT_ENV)

API = "https://api.elevenlabs.io"

INTERVIEWER_PROMPT = """You are Alex, a friendly but rigorous senior interviewer at a top tech company, running a live
mock interview over voice. Interview mode: {{mode}}. Target role: {{role}}.

General rules:
- Speak naturally and concisely: 1-3 sentences per turn. Never use markdown, lists, or code formatting in speech.
- Ask ONE question at a time, then stop and listen.
- Do not give scores during the interview; a written report is generated afterwards.

If mode is "behavioral":
- Ask 4 behavioral questions relevant to the role (a challenging project, a conflict with a teammate, a failure and
  what you learned, a time you showed leadership). Use the STAR method as your lens.
- After each answer ask at most one short follow-up probing specifics (their own contribution, metrics, outcome).
- After the 4th question, thank them, tell them to press End to see their report, and stop.

If mode is "coding" or "sql":
- The problem is: {{problem}}
- Briefly introduce the problem in one or two sentences and ask them to talk through their approach before writing
  code (for SQL: which tables, joins and filters they'll need).
- You will receive silent context updates with the candidate's live code or query and their test results. Use them.
- Stay quiet while they work unless they talk to you. Answer clarifying questions, give a small nudge if they are
  stuck for a long time, but never dictate the solution.
- When you receive a message starting with "[interviewer cue]", ask them to explain what they are doing right now
  and why, referencing something specific in their current code (a variable, loop, join, or clause you see).
- When tests pass or they say they're done, ask about complexity (coding) or performance / edge cases like NULLs and
  ties (SQL), then wrap up and tell them to press End to see their report.
"""

GUIDE_PROMPT = """You are Poise, the voice guide inside an AI interview-prep web app. Be warm, brief (1-2 sentences per
turn unless teaching), and action-oriented. Never use markdown in speech.

The app has these pages (use the navigate tool):
- home: overview.
- interview: the regular behavioral mock interview with posture + voice analysis.
- coding: technical interview, LeetCode-style coding problems in Python.
- sql: technical interview, SQL query problems.
- practice: the question bank, where you can review LeetCode-style and SQL questions with the user.
- report: the feedback report from the user's most recent interview.

What you do:
1. Navigation by voice. When the user asks to go somewhere or do something, call navigate, then confirm briefly.
2. Starting interviews. To start one, navigate to interview, coding or sql first (use select_problem for a specific
   problem), then call start_interview. Tell the user the interviewer Alex will take over; you will disconnect.
3. Reviewing questions. Use list_problems and get_problem. When reviewing a problem, act like a tutor: restate the
   problem simply, ask how they would approach it, give the hints one at a time, then explain the optimal approach
   and its complexity. Call select_problem so the problem is shown on screen while you discuss it.
4. Reports. On the report page, call get_page_context to read their scores and feedback and talk them through it.
Call get_page_context whenever you're unsure what the user is looking at. Never invent problems that the tools
don't return.
"""


def client_tool(name: str, description: str, properties: dict | None = None, required: list[str] | None = None) -> dict:
    cfg = {
        "type": "client",
        "name": name,
        "description": description,
        "expects_response": True,
        "response_timeout_secs": 10,
    }
    if properties:
        cfg["parameters"] = {"type": "object", "properties": properties, "required": required or []}
    return {"tool_config": cfg}


PAGES = ["home", "interview", "coding", "sql", "practice", "report"]
GUIDE_TOOLS = [
    client_tool(
        "navigate",
        "Navigate the app to a page.",
        {"page": {"type": "string", "enum": PAGES, "description": f"One of: {', '.join(PAGES)}"}},
        ["page"],
    ),
    client_tool("start_interview", "Start the mock interview on the current interview/coding/sql page. Ends this guide session."),
    client_tool("end_interview", "End the running mock interview and generate the report."),
    client_tool(
        "list_problems",
        "List practice problems (id, title, kind, difficulty, tags).",
        {"kind": {"type": "string", "enum": ["coding", "sql", "all"], "description": "Filter by kind"}},
    ),
    client_tool(
        "get_problem",
        "Get full details of a problem: prompt, examples, hints, optimal approach, complexity.",
        {"problem_id": {"type": "string", "description": "Problem id from list_problems"}},
        ["problem_id"],
    ),
    client_tool(
        "select_problem",
        "Show/select a problem on screen (on practice, coding or sql pages).",
        {"problem_id": {"type": "string", "description": "Problem id from list_problems"}},
        ["problem_id"],
    ),
    client_tool(
        "set_role",
        "Set the user's target job role used to tailor interviews.",
        {"role": {"type": "string", "description": "e.g. 'Backend Engineer', 'Data Analyst'"}},
        ["role"],
    ),
    client_tool("get_page_context", "Get the current page, selected problem, target role, and (on report) the latest scores."),
]


KEY_VAR = "ELEVENLABS_API_KEY"


def post(path: str, body: dict) -> dict:
    resp = httpx.post(f"{API}{path}", headers={"xi-api-key": os.environ[KEY_VAR]}, json=body, timeout=30)
    if resp.status_code >= 300:
        sys.exit(f"POST {path} failed ({resp.status_code}): {resp.text[:800]}")
    return resp.json()


def create_agent(name: str, prompt: str, first_message: str, tool_ids: list[str], placeholders: dict) -> str:
    agent = {
        "first_message": first_message,
        "language": "en",
        "prompt": {"prompt": prompt, **({"tool_ids": tool_ids} if tool_ids else {})},
    }
    if placeholders:
        agent["dynamic_variables"] = {"dynamic_variable_placeholders": placeholders}
    return post("/v1/convai/agents/create", {"name": name, "conversation_config": {"agent": agent}})["agent_id"]


def save_env(values: dict[str, str]) -> None:
    lines = ROOT_ENV.read_text().splitlines() if ROOT_ENV.exists() else []
    lines = [l for l in lines if l.split("=", 1)[0] not in values]
    lines += [f"{k}={v}" for k, v in values.items()]
    ROOT_ENV.write_text("\n".join(lines) + "\n")


def main():
    global KEY_VAR
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--key-var", default="ELEVENLABS_API_KEY", help="env var holding the ElevenLabs API key to use")
    parser.add_argument("--suffix", default="", help="suffix for the saved agent id env vars, e.g. 2")
    args = parser.parse_args()
    KEY_VAR = args.key_var
    if not os.environ.get(KEY_VAR):
        sys.exit(f"Set {KEY_VAR} in .env first")

    interviewer = create_agent(
        "Poise — Interviewer (Alex)",
        INTERVIEWER_PROMPT,
        "Hi, I'm Alex, I'll be your interviewer today. Ready to get started?",
        [],
        {"mode": "behavioral", "role": "software engineer", "problem": "none"},
    )
    print(f"Interviewer agent: {interviewer}")

    tool_ids = [post("/v1/convai/tools", t)["id"] for t in GUIDE_TOOLS]
    print(f"Created {len(tool_ids)} guide client tools")
    guide = create_agent(
        "Poise — Voice Guide",
        GUIDE_PROMPT,
        "Hey, I'm Poise. I can start a mock interview, open coding or SQL practice, or review a question with you. What would you like to do?",
        tool_ids,
        {},
    )
    print(f"Guide agent: {guide}")

    save_env({f"ELEVENLABS_AGENT_ID{args.suffix}": interviewer, f"ELEVENLABS_GUIDE_AGENT_ID{args.suffix}": guide})
    print(f"Saved agent ids to {ROOT_ENV}")


if __name__ == "__main__":
    main()
