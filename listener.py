import numpy as np
import sounddevice as sd
import soundfile as sf
import tempfile
import os
import whisper

_model = None


def _get_model():
    global _model
    if _model is None:
        _model = whisper.load_model("base")
    return _model


def record_until_silence(
    sample_rate: int = 16000,
    silence_threshold: float = 0.01,
    silence_duration: float = 1.8,
    max_duration: float = 30.0,
) -> np.ndarray:
    """Record audio, stopping automatically after silence."""
    chunk_size = int(sample_rate * 0.1)  # 100ms chunks
    silence_chunks = int(silence_duration / 0.1)
    max_chunks = int(max_duration / 0.1)

    recorded = []
    silent_count = 0
    started_speaking = False

    with sd.InputStream(samplerate=sample_rate, channels=1, dtype="float32") as stream:
        for _ in range(max_chunks):
            chunk, _ = stream.read(chunk_size)
            chunk = chunk.flatten()
            recorded.append(chunk)

            rms = np.sqrt(np.mean(chunk ** 2))

            if rms > silence_threshold:
                started_speaking = True
                silent_count = 0
            elif started_speaking:
                silent_count += 1
                if silent_count >= silence_chunks:
                    break

    return np.concatenate(recorded)


def transcribe(audio: np.ndarray, sample_rate: int = 16000) -> str:
    """Transcribe audio array to text using Whisper."""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        tmp_path = f.name

    try:
        sf.write(tmp_path, audio, sample_rate)
        model = _get_model()
        result = model.transcribe(tmp_path, language="ar" if _is_arabic(audio) else None)
        return result["text"].strip()
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


def _is_arabic(audio: np.ndarray) -> bool:
    """Quick heuristic — always let Whisper auto-detect language."""
    return False
