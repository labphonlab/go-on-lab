"""Command-line interface for the corpus backend.

    python -m corpus.cli prompts --file examples/prompts_en.jsonl
    python -m corpus.cli demo   --out /tmp/goon_demo
    python -m corpus.cli run    --audio clip.wav --prompt-file prompts.jsonl \\
                                --prompt-id en-0001 --speaker spk1 --out out/
"""

from __future__ import annotations

import argparse
import json
import os
import sys

from .models import ConsentRecord, License, Recording, Speaker
from .prompts.store import PromptStore
from .pipeline.orchestrator import Pipeline
from .storage import manifest


def _demo_consent(speaker_id: str) -> ConsentRecord:
    return ConsentRecord(
        consent_id=f"consent-{speaker_id}", speaker_id=speaker_id,
        version="2026-05-01", commercial_use=True, redistribution=True,
        derivatives=True, jurisdiction="JP",
    )


def cmd_prompts(args: argparse.Namespace) -> int:
    store = PromptStore.from_jsonl(args.file)
    print(f"loaded {len(store)} prompts from {args.file}")
    langs: dict[str, int] = {}
    for p in store:
        langs[p.language] = langs.get(p.language, 0) + 1
    for lang, n in sorted(langs.items()):
        print(f"  {lang}: {n}")
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    store = PromptStore.from_jsonl(args.prompt_file)
    prompt = store.get(args.prompt_id)
    rec = Recording(
        recording_id=args.recording_id or os.path.basename(args.audio),
        prompt_id=prompt.prompt_id, speaker_id=args.speaker, audio_path=args.audio,
    )
    item = Pipeline().process(
        rec, prompt, _demo_consent(args.speaker), License(args.license))
    print(json.dumps(item.to_dict(), ensure_ascii=False, indent=2))
    if args.out:
        manifest.export_corpus([item], args.out)
        print(f"\nexported manifest to {args.out}/", file=sys.stderr)
    return 0 if item.state.value != "rejected" else 2


def cmd_demo(args: argparse.Namespace) -> int:
    """End-to-end demo: synthesise clips, run the pipeline, export a manifest."""
    from .audio.synth import write_tone_wav

    os.makedirs(args.out, exist_ok=True)
    store = PromptStore()
    from .models import Prompt
    store.add(Prompt("demo-en-1", "en", "the quick brown fox jumps", License.CC0_1_0))
    store.add(Prompt("demo-ja-1", "ja", "むかし むかし ある ところ に", License.CC0_1_0))

    pipe = Pipeline()
    items = []
    specs = [
        ("clean.wav", dict(duration_s=2.5, amplitude=0.3, noise=0.0), "demo-en-1"),
        ("noisy.wav", dict(duration_s=2.5, amplitude=0.05, noise=0.08), "demo-en-1"),
        ("clipped.wav", dict(duration_s=2.5, amplitude=1.2, noise=0.0), "demo-ja-1"),
    ]
    for fname, kw, pid in specs:
        path = os.path.join(args.out, fname)
        write_tone_wav(path, **kw)
        rec = Recording(fname, pid, "demo-spk", path)
        items.append(pipe.process(rec, store.get(pid),
                                  _demo_consent("demo-spk"), License.CC_BY_4_0))

    for it in items:
        print(f"{it.recording.recording_id:12s} -> {it.state.value:8s} "
              f"sellable={it.is_sellable()}  "
              f"hard_fails={[g.name for g in it.failed_hard()]}")
    summary = manifest.export_corpus(items, args.out)
    print("\nsummary:", json.dumps(summary, ensure_ascii=False))
    print(f"manifest + dataset card written to {args.out}/")
    return 0


def cmd_annotate(args: argparse.Namespace) -> int:
    """Run the automatic segmentation + labeling pipeline on a recording."""
    from .annotation.orchestrator import AnnotationPipeline
    from .annotation import manifest as ann_manifest

    pipe = AnnotationPipeline()
    segments = pipe.annotate_file(
        args.audio, source_id=args.source_id, declared_language=args.language)

    for s in segments:
        txt = (s.transcript.text if s.transcript and s.transcript.text
               else "<no-transcript>")
        print(f"{s.segment_id}  [{s.start_s:6.2f}-{s.end_s:6.2f}]  "
              f"{s.speaker:11s}  {s.state.value:8s}  snr={s.scores.get('snr_db')}  {txt}")

    summary = ann_manifest.summarise(segments)
    print("\nsummary:", json.dumps(summary, ensure_ascii=False))
    if args.out:
        ann_manifest.export(segments, args.out)
        print(f"segments + dataset card written to {args.out}/", file=sys.stderr)
    return 0


def cmd_annotate_demo(args: argparse.Namespace) -> int:
    """Synthesise a multi-region recording and run the annotation pipeline."""
    from .audio.synth import write_segmented_wav
    from .annotation.orchestrator import AnnotationPipeline
    from .annotation import manifest as ann_manifest

    os.makedirs(args.out, exist_ok=True)
    path = os.path.join(args.out, "source.wav")
    write_segmented_wav(path, regions=[(1.0, 1.2), (1.5, 0.9), (0.8, 1.5)],
                        gap_s=0.5)
    segments = AnnotationPipeline().annotate_file(path, source_id="demo-source")
    for s in segments:
        print(f"{s.segment_id}  [{s.start_s:6.2f}-{s.end_s:6.2f}]  "
              f"{s.speaker:11s}  {s.state.value:8s}  snr={s.scores.get('snr_db')}")
    summary = ann_manifest.export(segments, args.out)
    print("\nsummary:", json.dumps(summary, ensure_ascii=False))
    print(f"segments + dataset card written to {args.out}/")
    return 0


def cmd_acquire(args: argparse.Namespace) -> int:
    """Acquire audio from a local directory into an acquisition store."""
    from .acquisition.registry import AcquisitionRegistry
    from .acquisition.adapters.local_dir import LocalDirectorySource

    reg = AcquisitionRegistry(args.store)
    src = LocalDirectorySource(args.dir, language=args.language,
                               license=License(args.license))
    acquired = reg.acquire_from(src, limit=args.limit)
    print(f"acquired {len(acquired)} new item(s) into {args.store}/")
    for a in acquired:
        print(f"  {a.item_id}  {a.language}  {a.license}  "
              f"sha256={a.sha256[:12]}…  {a.bytes} bytes")
    print("license summary:", json.dumps(reg.license_summary(), ensure_ascii=False))
    return 0


def cmd_acquire_demo(args: argparse.Namespace) -> int:
    """Synthesise a folder of audio, acquire it (with dedup), then annotate."""
    from .audio.synth import write_segmented_wav
    from .acquisition.registry import AcquisitionRegistry
    from .acquisition.adapters.local_dir import LocalDirectorySource
    from .annotation.orchestrator import AnnotationPipeline
    from .annotation import manifest as ann_manifest

    raw = os.path.join(args.out, "raw")
    os.makedirs(raw, exist_ok=True)
    # Two distinct recordings plus an exact duplicate to exercise dedup.
    write_segmented_wav(os.path.join(raw, "talk_a.wav"),
                        regions=[(1.0, 1.2), (1.5, 0.9)], gap_s=0.5)
    write_segmented_wav(os.path.join(raw, "talk_b.wav"),
                        regions=[(0.8, 1.5), (1.2, 1.0), (1.0, 0.8)], gap_s=0.5)
    import shutil as _sh
    _sh.copy2(os.path.join(raw, "talk_a.wav"), os.path.join(raw, "talk_a_copy.wav"))

    reg = AcquisitionRegistry(os.path.join(args.out, "store"))
    src = LocalDirectorySource(raw, language="ja", license=License.CC0_1_0)
    acquired = reg.acquire_from(src)
    print(f"acquired {len(acquired)} item(s) (duplicate skipped by content hash)")

    pipe = AnnotationPipeline()
    all_segments = []
    for a in acquired:
        all_segments.extend(pipe.annotate_file(a.local_path, source_id=a.item_id,
                                               declared_language=a.language))
    out_dir = os.path.join(args.out, "corpus")
    summary = ann_manifest.export(all_segments, out_dir)
    print("annotation summary:", json.dumps(summary, ensure_ascii=False))
    print(f"acquisition manifest: {reg.manifest_path}")
    print(f"corpus segments + card: {out_dir}/")
    return 0


def cmd_librivox(args: argparse.Namespace) -> int:
    """Acquire public-domain audiobooks from LibriVox (requires network + ffmpeg).

    LibriVox books are multi-track MP3; each track is transcoded to 16 kHz mono
    WAV and registered separately with provenance + content-hash dedup.
    """
    from .acquisition.registry import AcquisitionRegistry
    from .acquisition.adapters.librivox import LibriVoxSource

    from urllib.error import URLError, HTTPError

    src = LibriVoxSource(language=args.language, transcode=not args.no_transcode)
    reg = AcquisitionRegistry(args.store)
    try:
        catalog = list(src.catalog(limit=args.limit))
    except (URLError, HTTPError) as exc:
        print(f"could not reach the LibriVox API: {type(exc).__name__}: {exc}\n"
              f"This environment may block outbound network "
              f"(see the network policy). Run where egress to librivox.org is "
              f"allowed.", file=sys.stderr)
        return 1

    total = 0
    for item in catalog:
        print(f"book {item.item_id}: {item.title}  ({item.duration_s}s)")
        try:
            tracks = reg.acquire_tracks(src, item)
        except Exception as exc:  # network/ffmpeg/zip errors surfaced honestly
            print(f"  ! failed: {type(exc).__name__}: {exc}", file=sys.stderr)
            continue
        total += len(tracks)
        for t in tracks:
            print(f"  + {t.item_id}  {t.bytes} bytes  sha256={t.sha256[:12]}…")
    print(f"\nacquired {total} track(s) into {args.store}/")
    print("license summary:", json.dumps(reg.license_summary(), ensure_ascii=False))
    return 0 if total else 1


def cmd_whisperx_demo(args: argparse.Namespace) -> int:
    """Show the WhisperX result -> gated Segment mapping (offline, no ML).

    Uses a canned WhisperX-shaped result so the M3 mapping + gating + decision
    logic is demonstrable without GPUs/network; the real path is identical via
    corpus.annotation.whisperx_pipeline.WhisperXPipeline(...).process(audio).
    """
    from .annotation.whisperx_pipeline import segments_from_whisperx
    from .annotation.orchestrator import AnnotationPolicy
    from .annotation import manifest as ann_manifest

    canned = {
        "language": "en",
        "segments": [
            {"start": 0.0, "end": 2.1, "text": "the meeting will begin shortly",
             "speaker": "SPEAKER_00",
             "words": [{"word": "the", "start": 0.0, "end": 0.2, "score": 0.97,
                        "speaker": "SPEAKER_00"},
                       {"word": "meeting", "start": 0.2, "end": 0.7, "score": 0.95,
                        "speaker": "SPEAKER_00"}]},
            {"start": 2.5, "end": 5.0, "text": "uh maybe later perhaps",
             "speaker": "SPEAKER_01",
             "words": [{"word": "uh", "start": 2.5, "end": 2.7, "score": 0.35},
                       {"word": "maybe", "start": 2.8, "end": 3.2, "score": 0.41}]},
        ],
    }
    segs = segments_from_whisperx(canned, source_id="meeting-001",
                                  policy=AnnotationPolicy(min_snr_db=-999))
    for s in segs:
        print(f"{s.segment_id}  [{s.start_s:5.2f}-{s.end_s:5.2f}]  {s.speaker:11s}  "
              f"{s.state.value:8s}  conf={s.transcript.confidence}  "
              f"\"{s.transcript.text}\"")
    if args.out:
        ann_manifest.export(segs, args.out)
        print(f"\nsegments + card written to {args.out}/", file=sys.stderr)
    return 0


def cmd_diet(args: argparse.Namespace) -> int:
    """List Diet meetings with speaker-labeled verbatim text (needs network).

    The kokkai record API is text-only; audio must be supplied out-of-band and
    aligned against this transcript. The per-speech speaker labels are the
    valuable, under-exploited signal (diarization ground truth).
    """
    from urllib.error import URLError, HTTPError
    from .acquisition.adapters.diet_jp import DietJapanSource

    src = DietJapanSource()
    query = {}
    for kv in args.query or []:
        if "=" in kv:
            k, v = kv.split("=", 1)
            query[k] = v
    try:
        items = list(src.catalog(limit=args.limit, **query))
    except (URLError, HTTPError) as exc:
        print(f"could not reach the kokkai API: {type(exc).__name__}: {exc}\n"
              f"This environment may block outbound network (see the network "
              f"policy). Run where egress to kokkai.ndl.go.jp is allowed.",
              file=sys.stderr)
        return 1

    out_records = []
    for it in items:
        speakers = it.extra.get("speakers", [])
        n_sp = len(it.extra.get("speeches", []))
        print(f"{it.item_id}  {it.title}  speakers={len(speakers)} speeches={n_sp}")
        out_records.append(it)
    if args.out and out_records:
        import json as _json
        os.makedirs(args.out, exist_ok=True)
        path = os.path.join(args.out, "diet_meetings.jsonl")
        with open(path, "w", encoding="utf-8") as fh:
            for it in out_records:
                fh.write(_json.dumps({
                    "item_id": it.item_id, "title": it.title,
                    "language": it.language, "license": it.license.value,
                    "attribution": it.attribution,
                    "speakers": it.extra.get("speakers"),
                    "speeches": it.extra.get("speeches"),
                }, ensure_ascii=False) + "\n")
        print(f"\nwrote {len(out_records)} meeting(s) to {path}", file=sys.stderr)
    return 0 if items else 1


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="corpus", description="Go-on Lab corpus backend")
    sub = p.add_subparsers(dest="cmd", required=True)

    pp = sub.add_parser("prompts", help="load and summarise a prompt set")
    pp.add_argument("--file", required=True)
    pp.set_defaults(func=cmd_prompts)

    pr = sub.add_parser("run", help="process a single recording")
    pr.add_argument("--audio", required=True)
    pr.add_argument("--prompt-file", required=True)
    pr.add_argument("--prompt-id", required=True)
    pr.add_argument("--speaker", required=True)
    pr.add_argument("--recording-id", default=None)
    pr.add_argument("--license", default="CC-BY-4.0")
    pr.add_argument("--out", default=None)
    pr.set_defaults(func=cmd_run)

    pd = sub.add_parser("demo", help="synthesise clips and run the full pipeline")
    pd.add_argument("--out", default="./_demo_out")
    pd.set_defaults(func=cmd_demo)

    pa = sub.add_parser("annotate",
                        help="auto segment+label a recording (pseudo-labeling)")
    pa.add_argument("--audio", required=True)
    pa.add_argument("--source-id", default=None)
    pa.add_argument("--language", default=None)
    pa.add_argument("--out", default=None)
    pa.set_defaults(func=cmd_annotate)

    pad = sub.add_parser("annotate-demo",
                         help="synthesise multi-region audio and annotate it")
    pad.add_argument("--out", default="./_annotate_demo")
    pad.set_defaults(func=cmd_annotate_demo)

    paq = sub.add_parser("acquire", help="acquire audio from a local directory")
    paq.add_argument("--dir", required=True)
    paq.add_argument("--store", default="./_acquire_store")
    paq.add_argument("--language", default="und")
    paq.add_argument("--license", default="CC0-1.0")
    paq.add_argument("--limit", type=int, default=None)
    paq.set_defaults(func=cmd_acquire)

    paqd = sub.add_parser("acquire-demo",
                          help="acquire (with dedup) then annotate, end to end")
    paqd.add_argument("--out", default="./_acquire_demo")
    paqd.set_defaults(func=cmd_acquire_demo)

    plv = sub.add_parser("librivox",
                         help="acquire public-domain audiobooks (network + ffmpeg)")
    plv.add_argument("--language", default="english")
    plv.add_argument("--store", default="./_librivox_store")
    plv.add_argument("--limit", type=int, default=5)
    plv.add_argument("--no-transcode", action="store_true",
                     help="keep original MP3 instead of converting to WAV")
    plv.set_defaults(func=cmd_librivox)

    pwx = sub.add_parser("whisperx-demo",
                         help="demo the WhisperX result -> gated Segment mapping")
    pwx.add_argument("--out", default=None)
    pwx.set_defaults(func=cmd_whisperx_demo)

    pdt = sub.add_parser("diet",
                         help="list Diet meetings with speaker-labeled text (network)")
    pdt.add_argument("--limit", type=int, default=5)
    pdt.add_argument("--query", action="append",
                     help="kokkai API param as key=value (e.g. nameOfMeeting=予算委員会)")
    pdt.add_argument("--out", default=None)
    pdt.set_defaults(func=cmd_diet)
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
