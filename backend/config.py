"""Settings read fresh from .env on every call, so toggling ELEVENLABS_ACCOUNT needs no restart.

ELEVENLABS_ACCOUNT=1 → ELEVENLABS_API_KEY,  ELEVENLABS_AGENT_ID,  ELEVENLABS_GUIDE_AGENT_ID
ELEVENLABS_ACCOUNT=2 → ELEVENLABS_API_KEY2, ELEVENLABS_AGENT_ID2, ELEVENLABS_GUIDE_AGENT_ID2
"""

import os
from pathlib import Path

from dotenv import dotenv_values

ENV_FILES = [Path(__file__).resolve().parent / ".env", Path(__file__).resolve().parent.parent / ".env"]


def settings() -> dict[str, str]:
    values = dict(os.environ)
    for f in ENV_FILES:
        if f.exists():
            values.update({k: v for k, v in dotenv_values(f).items() if v is not None})
    return values


def eleven_account() -> tuple[str, str]:
    """(account label, env-var suffix) for the selected ElevenLabs account."""
    account = (settings().get("ELEVENLABS_ACCOUNT") or "1").strip()
    return account, "" if account in ("", "1") else account


def eleven_key() -> str | None:
    _, suffix = eleven_account()
    return settings().get(f"ELEVENLABS_API_KEY{suffix}") or None


def eleven_agent_var(agent: str) -> str:
    _, suffix = eleven_account()
    return f"ELEVENLABS_{'GUIDE_' if agent == 'guide' else ''}AGENT_ID{suffix}"


def eleven_agent_id(agent: str) -> str | None:
    return settings().get(eleven_agent_var(agent)) or None
