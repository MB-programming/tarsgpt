#!/bin/bash
# TARS Voice Assistant — Mac Setup

set -e

echo "=== TARS Setup for Mac ==="
echo ""

# Check Python
if ! command -v python3 &>/dev/null; then
    echo "ERROR: Python 3 not found. Install from https://python.org"
    exit 1
fi

# Check Homebrew (needed for ffmpeg)
if ! command -v brew &>/dev/null; then
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Install ffmpeg (needed by pydub/whisper)
if ! command -v ffmpeg &>/dev/null; then
    echo "Installing ffmpeg..."
    brew install ffmpeg
fi

# Install portaudio (needed by sounddevice)
if ! brew list portaudio &>/dev/null; then
    echo "Installing portaudio..."
    brew install portaudio
fi

# Create virtual environment
echo "Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install Python packages
echo "Installing Python packages (this may take a few minutes)..."
pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Copy .env.example to .env and add your Anthropic API key"
echo "     cp .env.example .env"
echo "     nano .env"
echo ""
echo "  2. Run TARS:"
echo "     source venv/bin/activate"
echo "     python main.py"
echo ""
echo "Get your free Anthropic API key at: https://console.anthropic.com"
