#!/bin/bash
# TARS Voice Assistant — Mac Setup (يشتغل على أي Mac حتى 2013)

set -e

echo "=== TARS Setup for Mac ==="
echo ""

# ── Python ─────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
    echo "ERROR: Python 3 مش موجود."
    echo "حمّله من: https://www.python.org/downloads/"
    exit 1
fi

# ── Homebrew ───────────────────────────────────────────────
HAS_BREW=false
if command -v brew &>/dev/null; then
    HAS_BREW=true
fi

# ── ffmpeg (مطلوب لـ Whisper) ──────────────────────────────
if ! command -v ffmpeg &>/dev/null; then
    echo "Installing ffmpeg..."
    if $HAS_BREW; then
        brew install ffmpeg
    else
        echo "  ثبّت Homebrew أولاً من: https://brew.sh"
        echo "  ثم أعد تشغيل هذا الـ script."
        exit 1
    fi
fi

# ── portaudio (مطلوب للميكروفون) ──────────────────────────
if $HAS_BREW && ! brew list portaudio &>/dev/null 2>&1; then
    echo "Installing portaudio..."
    brew install portaudio
fi

# ── Python packages ────────────────────────────────────────
echo ""
echo "Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

echo "Installing Python packages..."
pip install --upgrade pip --quiet
pip install -r requirements.txt

# ── .env ──────────────────────────────────────────────────
if [ ! -f .env ]; then
    cp .env.example .env
    echo ""
    echo "  ⚠️  ملف .env اتعمل. محتاج تضيف Groq API key."
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         Setup Complete!                 ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "خطوة واحدة باقية — Groq API key مجاني:"
echo ""
echo "  1. افتح: https://console.groq.com"
echo "  2. سجّل مجاناً واعمل API key"
echo "  3. افتح ملف .env وحط:"
echo "     GROQ_API_KEY=gsk_xxxxxxxxxx"
echo ""
echo "لتشغيل TARS:"
echo "  source venv/bin/activate"
echo "  python main.py"
