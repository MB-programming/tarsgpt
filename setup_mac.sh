#!/bin/bash
# TARS Voice Assistant — Mac Setup (يشتغل على أي Mac حتى 2013)

set -e

echo "=== TARS Setup for Mac ==="
echo ""

# ── Homebrew ───────────────────────────────────────────────
HAS_BREW=false
if command -v brew &>/dev/null; then
    HAS_BREW=true
fi

# ── Python 3.11 (Whisper مش متوافق مع 3.12+) ──────────────
if $HAS_BREW; then
    if ! brew list python@3.11 &>/dev/null 2>&1; then
        echo "Installing Python 3.11..."
        brew install python@3.11
    fi
    PYTHON=$(brew --prefix python@3.11)/bin/python3.11
else
    PYTHON=$(which python3)
fi

if ! $PYTHON --version &>/dev/null; then
    echo "ERROR: Python مش موجود."
    exit 1
fi

echo "Using $($PYTHON --version)"

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
$PYTHON -m venv venv
source venv/bin/activate

echo "Installing Python packages..."
pip install --upgrade pip setuptools --quiet
pip install -r requirements.txt

# ── .env ──────────────────────────────────────────────────
if [ ! -f .env ]; then
    cp .env.example .env
    echo ""
    echo "  ⚠️  ملف .env اتعمل. محتاج تضيف OpenAI API key."
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         Setup Complete!                 ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "خطوة واحدة باقية — OpenAI API key:"
echo ""
echo "  افتح ملف .env وحط:"
echo "  OPENAI_API_KEY=sk-xxxxxxxxxx"
echo ""
echo "لتشغيل TARS:"
echo "  source venv/bin/activate"
echo "  python main.py"
