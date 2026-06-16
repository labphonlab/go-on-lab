"""Production stage implementations (optional, ML-backed).

These are the drop-in replacements for the baselines. Dependencies are imported
lazily inside each constructor so importing this module never forces them onto
the zero-dependency core. Install what you need:

    pip install whisperx          # ASR + word alignment + language id
    pip install pyannote.audio    # diarization (needs HF token + license accept)
    pip install silero-vad        # VAD

WhisperX already performs VAD-based segmentation internally, so in the production
configuration the segmenter and transcriber collapse into one model pass; this
module keeps them separable for clarity and for swapping pieces independently.

Phone-level alignment (MFA) plugs into the existing ``corpus.alignment``
interface and runs as a downstream stage on accepted segments.
"""

from __future__ import annotations

from .base import Segmenter, Diarizer, Transcriber
from .models import SpeechRegion, SpeakerTurn, Transcript, WordTiming
from ..audio.wav import WavData


class WhisperXTranscriber(Transcriber):
    """ASR + word-level timestamps + language id via WhisperX."""

    def __init__(self, model_size: str = "small", device: str = "cpu",
                 compute_type: str = "int8"):
        import whisperx  # type: ignore  # lazy: optional dependency

        self._whisperx = whisperx
        self._model = whisperx.load_model(model_size, device, compute_type=compute_type)
        self._device = device
        self._align_cache: dict[str, tuple] = {}

    def transcribe(self, wav: WavData, start_s: float, end_s: float,
                   declared_language: str | None = None) -> Transcript:
        # M3: feed the decoded segment samples to whisperx.transcribe(), then
        # whisperx.align() for word timings. _wer()/confidence scoring already
        # exist; this wires real audio in. Raise until wired to avoid faking.
        raise NotImplementedError(
            "Wire decoded segment samples into whisperx.transcribe()+align() in "
            "M3; Transcript/WordTiming carry the resulting words & confidence."
        )


class PyannoteDiarizer(Diarizer):
    """Speaker diarization via pyannote.audio 3.x."""

    def __init__(self, hf_token: str, model: str = "pyannote/speaker-diarization-3.1"):
        from pyannote.audio import Pipeline  # type: ignore  # lazy

        self._pipeline = Pipeline.from_pretrained(model, use_auth_token=hf_token)

    def diarize(self, wav: WavData) -> list[SpeakerTurn]:
        raise NotImplementedError(
            "Feed the source audio path/array to the pyannote pipeline in M3 and "
            "map its annotation timeline to SpeakerTurn objects."
        )


class SileroSegmenter(Segmenter):
    """Voice-activity detection via Silero VAD (better than energy on noisy audio)."""

    def __init__(self):
        import torch  # type: ignore  # lazy

        self._model, self._utils = torch.hub.load(
            "snakers4/silero-vad", "silero_vad")

    def segment(self, wav: WavData) -> list[SpeechRegion]:
        raise NotImplementedError(
            "Run Silero get_speech_timestamps over the samples in M3 and map "
            "results (seconds) to SpeechRegion objects."
        )
