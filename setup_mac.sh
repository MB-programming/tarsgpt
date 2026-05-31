#!/bin/bash
# TARS Voice Assistant — Mac Setup (100% Free, No API keys)

set -e

echo "=== TARS Setup for Mac ==="
echo "    100% offline — no API keys needed"
echo ""

# Check Python
if ! command -v python3 &>/dev/null; then
    echo "ERROR: Python 3 not found. Install from https://python.org"
    exit 1
fi

# Check Homebrew
if ! command -v brew &>/dev/null; then
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Install ffmpeg (needed by whisper)
if ! command -v ffmpeg &>/dev/null; then
    echo "Installing ffmpeg..."
    brew install ffmpeg
fi

# Install portaudio (needed by sounddevice)
if ! brew list portaudio &>/dev/null 2>&1; then
    echo "Installing portaudio..."
    brew install portaudio
fi

# Install Ollama (local AI engine)
if ! command -v ollama &>/dev/null; then
    echo "Installing Ollama (local AI)..."
    brew install ollama
fi

# Pull the TARS brain model (llama3.2 ~2GB)
echo ""
echo "Downloading AI model: llama3.2 (~2 GB, one-time download)..."
ollama pull llama3.2

# Create virtual environment
echo ""
echo "Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install Python packages
echo "Installing Python packages..."
pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "=== Setup Complete! ==="
echo ""
echo "To run TARS:"
echo ""
echo "  1. Start Ollama (in a separate terminal or background):"
echo "     ollama serve"
echo ""
echo "  2. Run TARS:"
echo "     source venv/bin/activate"
echo "     python main.py"
echo ""
echo "Everything runs locally on your Mac — no internet needed after setup."
