import asyncio
import tempfile
import os
import numpy as np
import soundfile as sf
import sounddevice as sd
from scipy import signal
import edge_tts

VOICE = "en-GB-RyanNeural"
TARS_RATE = "-8%"
TARS_PITCH = "-15Hz"


async def _synthesize(text: str, output_path: str):
    communicate = edge_tts.Communicate(text, VOICE, rate=TARS_RATE, pitch=TARS_PITCH)
    await communicate.save(output_path)


def _apply_tars_effect(audio: np.ndarray, sr: int) -> np.ndarray:
    """Apply audio processing to make voice sound like TARS."""
    # Slight pitch shift down via resampling
    shift_ratio = 0.92
    resampled_len = int(len(audio) / shift_ratio)
    pitched = signal.resample(audio, resampled_len)

    # Trim back to original length to keep timing
    if len(pitched) > len(audio):
        pitched = pitched[:len(audio)]
    else:
        pitched = np.pad(pitched, (0, len(audio) - len(pitched)))

    # Add subtle metallic resonance (comb filter)
    delay_samples = int(sr * 0.008)  # 8ms
    comb = np.zeros_like(pitched)
    for i in range(len(pitched)):
        if i >= delay_samples:
            comb[i] = pitched[i] + 0.15 * pitched[i - delay_samples]
        else:
            comb[i] = pitched[i]

    # Light high-frequency boost for that mechanical edge
    b, a = signal.butter(2, 3000 / (sr / 2), btype='high')
    high = signal.filtfilt(b, a, comb)
    mixed = comb + 0.18 * high

    # Normalize
    peak = np.max(np.abs(mixed))
    if peak > 0:
        mixed = mixed / peak * 0.92

    return mixed.astype(np.float32)


def speak(text: str):
    """Convert text to TARS-style speech and play it."""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        tmp_path = f.name

    try:
        asyncio.run(_synthesize(text, tmp_path))

        audio, sr = sf.read(tmp_path)
        if audio.ndim > 1:
            audio = audio.mean(axis=1)

        processed = _apply_tars_effect(audio.astype(np.float32), sr)

        sd.play(processed, sr)
        sd.wait()
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
