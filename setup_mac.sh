#!/bin/bash
# TARS Voice Assistant — Mac Setup (100% Free, No API keys)

set -e

echo "=== TARS Setup for Mac ==="
echo "    100% offline — no API keys needed"
echo ""

# ── Python ────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
    echo "ERROR: Python 3 not found."
    echo "Install from: https://www.python.org/downloads/"
    exit 1
fi

# ── Homebrew (optional but helpful) ──────────────────────
HAS_BREW=false
if command -v brew &>/dev/null; then
    HAS_BREW=true
fi

# ── ffmpeg ────────────────────────────────────────────────
if ! command -v ffmpeg &>/dev/null; then
    echo "Installing ffmpeg..."
    if $HAS_BREW; then
        brew install ffmpeg
    else
        echo "  brew غير متاح — ثبّت ffmpeg يدوياً من: https://ffmpeg.org/download.html"
        echo "  أو ثبّت Homebrew أولاً: https://brew.sh"
        echo "  ثم أعد تشغيل هذا الـ script."
        exit 1
    fi
fi

# ── portaudio (للميكروفون) ────────────────────────────────
if $HAS_BREW && ! brew list portaudio &>/dev/null 2>&1; then
    echo "Installing portaudio..."
    brew install portaudio
fi

# ── Ollama ────────────────────────────────────────────────
if ! command -v ollama &>/dev/null; then
    echo ""
    echo "Installing Ollama (local AI engine)..."
    if $HAS_BREW; then
        brew install ollama
    else
        # Direct installer from ollama.com
        curl -fsSL https://ollama.com/install.sh | sh
    fi

    # Verify install succeeded
    if ! command -v ollama &>/dev/null; then
        echo ""
        echo "  تعذّر تثبيت Ollama تلقائياً."
        echo "  حمّله يدوياً من: https://ollama.com/download"
        echo "  بعد التثبيت أعد تشغيل هذا الـ script."
        exit 1
    fi

    echo "  ✓ Ollama installed."
fi

# ── Pull the AI model (one-time ~2GB download) ─────────────
echo ""
echo "Downloading AI model: llama3.2 (~2 GB, one-time download)..."
ollama pull llama3.2

# ── Python packages ────────────────────────────────────────
echo ""
echo "Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

echo "Installing Python packages..."
pip install --upgrade pip --quiet
pip install -r requirements.txt

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║         Setup Complete!                 ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "لتشغيل TARS:"
echo ""
echo "  Terminal 1 — شغّل Ollama:"
echo "    ollama serve"
echo ""
echo "  Terminal 2 — شغّل TARS:"
echo "    source venv/bin/activate"
echo "    python main.py"
echo ""
echo "ملاحظة: TARS يبدأ Ollama تلقائياً إن لم يكن شغّالاً."
