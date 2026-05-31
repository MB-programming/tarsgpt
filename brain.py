import urllib.request
import urllib.error
import json
from tars_prompt import TARS_SYSTEM_PROMPT

OLLAMA_URL = "http://localhost:11434/api/chat"
MODEL = "llama3.2"

_history: list[dict] = []


def _ollama_installed() -> bool:
    import shutil
    return shutil.which("ollama") is not None


def _try_start_ollama():
    """Try to launch ollama serve in the background."""
    import subprocess, time
    subprocess.Popen(
        ["ollama", "serve"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    time.sleep(3)


def check_ollama():
    """Verify Ollama is running and the model is available. Auto-starts if needed."""
    if not _ollama_installed():
        raise RuntimeError(
            "Ollama غير مثبت على جهازك.\n\n"
            "ثبّته بطريقة واحدة من الاتنين:\n"
            "  [A] brew install ollama\n"
            "  [B] حمّله من الموقع: https://ollama.com/download\n\n"
            "بعد التثبيت شغّل: ollama pull llama3.2\n"
            "ثم أعد تشغيل TARS."
        )

    # Try connecting — if not running, auto-start it
    for attempt in range(2):
        try:
            req = urllib.request.urlopen("http://localhost:11434/api/tags", timeout=4)
            data = json.loads(req.read())
            available = [m["name"].split(":")[0] for m in data.get("models", [])]
            if not any(MODEL in m for m in available):
                raise RuntimeError(
                    f"Model '{MODEL}' غير موجود.\n"
                    f"حمّله بـ:  ollama pull {MODEL}\n"
                    f"المتاح حالياً: {', '.join(available) or 'لا يوجد'}"
                )
            return
        except urllib.error.URLError:
            if attempt == 0:
                _try_start_ollama()
            else:
                raise RuntimeError(
                    "Ollama مثبت لكن مش شغّال.\n"
                    "شغّله يدوياً في Terminal منفصل:\n"
                    "  ollama serve"
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
