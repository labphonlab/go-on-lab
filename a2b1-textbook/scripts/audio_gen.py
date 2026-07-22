#!/usr/bin/env python3
"""TTS -> forced-alignment pipeline for a unit's spoken sections.

STATUS: interface implemented, NOT executable in this sandbox.

This pipeline needs two external resources that are unavailable in the
environment this script was authored in (no network egress to TTS
providers, no Montreal Forced Aligner install):

  1. A TTS provider (per CLAUDE.md section 7: OpenAI TTS, proxied through
     an Edge Function in the deployed app -- but for offline asset
     generation at build time, a direct API call with an API key is
     simplest). Set OPENAI_API_KEY to use it.
  2. Montreal Forced Aligner (`mfa`) on PATH, plus an English acoustic
     model + pronunciation dictionary (`mfa model download acoustic
     english_us_arpa` / `mfa model download dictionary english_us_arpa`),
     to produce the TextGrid files that scripts/export_app.py's
     `shadowing`/`dictation` components reference.

What IS implemented and runnable without those:
  - `extract_speech_lines()`: parses a section's dialogue lines from
    Markdown (the same format vocab_check.py / export_app.py read), which
    is the input both TTS and MFA need.
  - `plan_audio_jobs()`: computes exactly which (unit, section, line) audio
    files must exist, matching the paths export_app.py already references
    (audio/<section_id>.mp3, audio/<section_id>-line###.mp3). Running with
    --dry-run prints this plan without calling any external service, which
    is useful for scoping work before wiring up real credentials.

Usage once credentials/tools are available:
    export OPENAI_API_KEY=...
    python3 scripts/audio_gen.py --unit 1              # TTS + MFA align
    python3 scripts/audio_gen.py --unit 1 --dry-run     # show the plan only
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONTENT_DIR = REPO_ROOT / "content"

DIALOGUE_LINE_RE = re.compile(r"^\*\*(?P<speaker>[^:*]+):\*\*\s*(?P<line>.+)$", re.MULTILINE)
FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)


@dataclass
class AudioJob:
    unit: int
    section_id: str
    kind: str  # "full_section" | "line"
    text: str
    out_mp3: Path
    speaker: str | None = None


def parse_frontmatter(path: Path) -> tuple[dict, str]:
    raw = path.read_text(encoding="utf-8")
    match = FRONTMATTER_RE.match(raw)
    if not match:
        return {}, raw
    meta = yaml.safe_load(match.group(1)) or {}
    return meta, raw[match.end():]


def extract_speech_lines(body: str) -> list[tuple[str, str]]:
    """Return [(speaker, line), ...] for a dialogue-formatted section body."""
    return [(m.group("speaker").strip(), m.group("line").strip()) for m in DIALOGUE_LINE_RE.finditer(body)]


def plan_audio_jobs(content_dir: Path, unit_num: int) -> list[AudioJob]:
    unit_dir = content_dir / "units" / f"unit{unit_num:02d}"
    unit_yaml = yaml.safe_load((unit_dir / "unit.yaml").read_text(encoding="utf-8"))
    audio_dir = unit_dir / "audio"

    jobs: list[AudioJob] = []
    for section in unit_yaml.get("sections", []):
        if "shadowing" not in (section.get("app_components") or []) and "dictation" not in (
            section.get("app_components") or []
        ):
            continue
        section_id = section["id"]
        section_path = unit_dir / "sections" / f"{section_id}.md"
        if not section_path.exists():
            continue
        meta, body = parse_frontmatter(section_path)
        source_section_id = meta.get("source_section")
        if source_section_id:
            # This section reuses another section's audio -- no new job.
            continue

        lines = extract_speech_lines(body)
        if not lines:
            continue

        full_text = " ".join(line for _, line in lines)
        jobs.append(
            AudioJob(unit_num, section_id, "full_section", full_text, audio_dir / f"{section_id}.mp3")
        )
        for idx, (speaker, line) in enumerate(lines, start=1):
            jobs.append(
                AudioJob(
                    unit_num,
                    section_id,
                    "line",
                    line,
                    audio_dir / f"{section_id}-line{idx:03d}.mp3",
                    speaker=speaker,
                )
            )
    return jobs


def synthesize_tts(text: str, out_path: Path, voice: str = "alloy") -> None:
    """Call the OpenAI TTS API. Requires OPENAI_API_KEY and network access."""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "OPENAI_API_KEY is not set. This sandbox has no TTS credentials -- "
            "run this step in an environment with API access configured."
        )
    try:
        import openai  # noqa: PLC0415 (optional dependency, imported lazily)
    except ImportError as exc:
        raise EnvironmentError(
            "The `openai` package is not installed. Run `pip install openai` in an "
            "environment with network access before calling synthesize_tts()."
        ) from exc

    client = openai.OpenAI(api_key=api_key)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with client.audio.speech.with_streaming_response.create(
        model="tts-1", voice=voice, input=text
    ) as response:
        response.stream_to_file(out_path)


def align_with_mfa(audio_path: Path, transcript: str, out_textgrid: Path) -> None:
    """Run Montreal Forced Aligner on a single audio+transcript pair."""
    if shutil.which("mfa") is None:
        raise EnvironmentError(
            "Montreal Forced Aligner (`mfa`) is not on PATH. Install it "
            "(https://montreal-forced-aligner.readthedocs.io/) and download the "
            "english_us_arpa acoustic model + dictionary before calling align_with_mfa()."
        )
    corpus_dir = out_textgrid.parent / "_mfa_tmp"
    corpus_dir.mkdir(parents=True, exist_ok=True)
    (corpus_dir / f"{audio_path.stem}.lab").write_text(transcript, encoding="utf-8")
    shutil.copy(audio_path, corpus_dir / audio_path.name)
    subprocess.run(
        [
            "mfa",
            "align",
            str(corpus_dir),
            "english_us_arpa",
            "english_us_arpa",
            str(out_textgrid.parent),
        ],
        check=True,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--content-dir", type=Path, default=DEFAULT_CONTENT_DIR)
    parser.add_argument("--unit", type=int, required=True)
    parser.add_argument("--dry-run", action="store_true", help="print the job plan, call nothing external")
    args = parser.parse_args(argv)

    jobs = plan_audio_jobs(args.content_dir, args.unit)
    if not jobs:
        print(f"No audio jobs found for unit {args.unit} (no dialogue sections with shadowing/dictation).")
        return 0

    print(f"{len(jobs)} audio job(s) planned for unit {args.unit}:")
    for job in jobs:
        label = f"[{job.kind}]" + (f" {job.speaker}:" if job.speaker else "")
        print(f"  {job.out_mp3.relative_to(REPO_ROOT)}  {label} {job.text[:60]!r}")

    if args.dry_run:
        return 0

    for job in jobs:
        synthesize_tts(job.text, job.out_mp3)
        align_with_mfa(job.out_mp3, job.text, job.out_mp3.with_suffix(".TextGrid"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
