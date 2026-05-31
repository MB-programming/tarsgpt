import anthropic
from tars_prompt import TARS_SYSTEM_PROMPT

_client = None
_history: list[dict] = []


def _get_client():
    global _client
    if _client is None:
        _client = anthropic.Anthropic()
    return _client


def chat(user_message: str) -> str:
    """Send message to Claude as TARS and get response."""
    _history.append({"role": "user", "content": user_message})

    response = _get_client().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=TARS_SYSTEM_PROMPT,
        messages=_history,
    )

    reply = response.content[0].text
    _history.append({"role": "assistant", "content": reply})

    # Keep history manageable
    if len(_history) > 20:
        _history[:] = _history[-20:]

    return reply


def reset():
    _history.clear()
