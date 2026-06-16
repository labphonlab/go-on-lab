"""WhisperX whole-file annotation pipeline (production path) + offline mapping.

WhisperX performs VAD segmentation, Whisper ASR, wav2vec2 word-level alignment
and (optionally) pyannote diarization in a single whole-file pass. Its result is
a dict of segments with word timings, language and speaker labels.

The value this module adds is the **mapping** from that result to our gated,
auditable :class:`~corpus.annotation.models.Segment` objects — a pure function
(:func:`segments_from_whisperx`) that is fully unit-tested offline. The model
execution (:class:`WhisperXPipeline`) is a thin lazy wrapper so the core keeps
zero hard dependencies and runs where GPUs/network are available.

    pip install whisperx
"""

from __future__ import annotations

from typing import Optional

from .models import Segment, Transcript, WordTiming
from .orchestrator import AnnotationPolicy, gate_segment
from ..models import ItemState


def _segment_confidence(words: list[dict]) -> Optional[float]:
    """Mean word score, if WhisperX provided per-word scores."""
    scores = [w["score"] for w in words
              if isinstance(w.get("score"), (int, float))]
    return sum(scores) / len(scores) if scores else None


def segments_from_whisperx(
    result: dict,
    source_id: str = "source",
    policy: AnnotationPolicy | None = None,
    declared_language: Optional[str] = None,
) -> list[Segment]:
    """Map a WhisperX result dict to gated Segment objects.

    Expected shape (WhisperX >= 3):

        {
          "language": "en",
          "segments": [
            {"start": 0.0, "end": 3.1, "text": "hello world",
             "speaker": "SPEAKER_00",
             "words": [{"word": "hello", "start": 0.0, "end": 0.4,
                        "score": 0.98, "speaker": "SPEAKER_00"}, ...]},
            ...
          ]
        }
    """
    policy = policy or AnnotationPolicy()
    language = result.get("language") or declared_language
    out: list[Segment] = []

    for i, s in enumerate(result.get("segments", [])):
        start = float(s.get("start", 0.0))
        end = float(s.get("end", start))
        raw_words = s.get("words", []) or []
        words = [
            WordTiming(
                word=w.get("word", ""),
                start_s=float(w.get("start", start)),
                end_s=float(w.get("end", end)),
                confidence=(float(w["score"])
                            if isinstance(w.get("score"), (int, float)) else None),
            )
            for w in raw_words
        ]
        # Speaker: prefer the segment label, else the majority word label.
        speaker = s.get("speaker") or _majority_speaker(raw_words) or "SPEAKER_00"
        text = (s.get("text") or "").strip() or None

        seg = Segment(
            segment_id=f"{source_id}#{i:04d}",
            source_id=source_id, start_s=start, end_s=end, speaker=speaker,
        )
        tr = Transcript(
            text=text,
            language=language,
            confidence=_segment_confidence(raw_words),
            words=words,
            is_heuristic=False,  # real ASR output
        )
        seg.transcript = tr
        if tr.confidence is not None:
            seg.scores["asr_confidence"] = round(tr.confidence, 4)
        gate_segment(seg, tr, policy, declared_language)
        seg.decide()
        out.append(seg)
    return out


def _majority_speaker(words: list[dict]) -> Optional[str]:
    counts: dict[str, int] = {}
    for w in words:
        spk = w.get("speaker")
        if spk:
            counts[spk] = counts.get(spk, 0) + 1
    return max(counts, key=counts.get) if counts else None


class WhisperXPipeline:
    """Lazy wrapper that runs WhisperX end to end, then maps to Segments.

    Heavy deps (whisperx, torch, pyannote) are imported only on construction so
    importing this module never forces them. Diarization needs a Hugging Face
    token with the pyannote licence accepted.
    """

    def __init__(self, model_size: str = "small", device: str = "cpu",
                 compute_type: str = "int8", diarize: bool = True,
                 hf_token: Optional[str] = None,
                 policy: AnnotationPolicy | None = None):
        import whisperx  # type: ignore  # lazy: optional dependency

        self._whisperx = whisperx
        self._device = device
        self._model = whisperx.load_model(model_size, device,
                                          compute_type=compute_type)
        self.diarize = diarize
        self._hf_token = hf_token
        self.policy = policy or AnnotationPolicy()

    def process(self, audio_path: str, source_id: Optional[str] = None,
                declared_language: Optional[str] = None) -> list[Segment]:
        wx = self._whisperx
        audio = wx.load_audio(audio_path)

        result = self._model.transcribe(audio, language=declared_language)
        lang = result["language"]

        # Word-level alignment (wav2vec2) for the detected language.
        align_model, meta = wx.load_align_model(language_code=lang,
                                                device=self._device)
        result = wx.align(result["segments"], align_model, meta, audio,
                          self._device, return_char_alignments=False)
        result["language"] = lang

        if self.diarize:
            diarizer = wx.DiarizationPipeline(use_auth_token=self._hf_token,
                                              device=self._device)
            diar = diarizer(audio)
            result = wx.assign_word_speakers(diar, result)

        return segments_from_whisperx(result, source_id or audio_path,
                                      self.policy, declared_language)
