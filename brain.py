import urllib.request
import urllib.error
import json
from tars_prompt import TARS_SYSTEM_PROMPT

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "llama3.2"

_history: list[dict] = []


def check_ollama():
    """Verify Ollama is running and the model is available."""
    try:
        req = urllib.request.urlopen("http://localhost:11434/api/tags", timeout=3)
        data = json.loads(req.read())
        available = [m["name"].split(":")[0] for m in data.get("models", [])]
        if MODEL not in available and not any(MODEL in m for m in available):
            raise RuntimeError(
                f"Model '{MODEL}' not found.\n"
                f"Run:  ollama pull {MODEL}\n"
                f"Available: {', '.join(available) or 'none'}"
            )
    except urllib.error.URLError:
        raise RuntimeError(
            "Ollama is not running.\n"
            "Start it with:  ollama serve\n"
            "Install from:   https://ollama.com"
        )


def chat(user_message: str) -> str:
    """Send message to local Ollama as TARS and get response."""
    _history.append({"role": "user", "content": user_message})

    payload = json.dumps({
        "model": MODEL,
        "stream": False,
        "messages": [
            {"role": "system", "content": TARS_SYSTEM_PROMPT},
            *_history,
        ],
    }).encode()

    req = urllib.request.Request(
        OLLAMA_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
    )

    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read())

    reply = data["message"]["content"].strip()
    _history.append({"role": "assistant", "content": reply})

    if len(_history) > 20:
        _history[:] = _history[-20:]

    return reply


def reset():
    _history.clear()
