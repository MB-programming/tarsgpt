import os
import json
import urllib.request
from tars_prompt import TARS_SYSTEM_PROMPT

OPENAI_URL = "https://api.openai.com/v1/chat/completions"
MODEL = "gpt-4o-mini"

_history: list[dict] = []


def check_openai():
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY مش موجود.\n\n"
            "افتح ملف .env وحط:\n"
            "  OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx"
        )


def chat(user_message: str) -> str:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()

    _history.append({"role": "user", "content": user_message})

    payload = json.dumps({
        "model": MODEL,
        "max_tokens": 512,
        "messages": [
            {"role": "system", "content": TARS_SYSTEM_PROMPT},
            *_history,
        ],
    }).encode()

    req = urllib.request.Request(
        OPENAI_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
    )

    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())

    reply = data["choices"][0]["message"]["content"].strip()
    _history.append({"role": "assistant", "content": reply})

    if len(_history) > 20:
        _history[:] = _history[-20:]

    return reply


def reset():
    _history.clear()
