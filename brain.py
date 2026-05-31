import os
import urllib.request
import urllib.error
import json
from tars_prompt import TARS_SYSTEM_PROMPT

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "llama-3.1-8b-instant"

_history: list[dict] = []


def check_groq():
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError(
            "GROQ_API_KEY مش موجود.\n\n"
            "خطوتين بس:\n"
            "  1. سجّل مجاناً على: https://console.groq.com\n"
            "  2. افتح ملف .env وحط:\n"
            "     GROQ_API_KEY=gsk_xxxxxxxxxxxx"
        )


def chat(user_message: str) -> str:
    api_key = os.getenv("GROQ_API_KEY", "").strip()

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
        GROQ_URL,
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
