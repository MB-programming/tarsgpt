<?php
// ── AI Chat providers — fill the ones you have ─────────────
define('OPENAI_API_KEY', '');   // sk-...
define('GEMINI_API_KEY', '');   // AIza...
define('GROK_API_KEY',   '');   // xai-...

// ── TTS (always uses OpenAI onyx — best TARS voice) ─────────
// Falls back to browser SpeechSynthesis if key is empty.
define('TTS_MODEL', 'tts-1');
define('TTS_VOICE', 'onyx');
define('TTS_SPEED', 0.88);

// ── Chat models per provider ────────────────────────────────
define('OPENAI_MODEL', 'gpt-4o-mini');
define('GEMINI_MODEL', 'gemini-1.5-flash');
define('GROK_MODEL',   'grok-beta');
