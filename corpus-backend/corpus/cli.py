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
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
