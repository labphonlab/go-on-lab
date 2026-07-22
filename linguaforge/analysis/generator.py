"""第3層: 生成層 glue — copies templates/base-app into output/app and injects
the intermediate JSON so the static Next.js template renders this course.

Components are never rewritten per course; only public/data/course.json (the
data the template fetches at runtime) and output/data/*.json (saved for
re-generation / debugging, per AGENTS.md) change.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from .schema import Course

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates" / "base-app"
_IGNORE = shutil.ignore_patterns("node_modules", ".next", "out", "*.tsbuildinfo")


def generate_app(course: Course, output_dir: Path, audio_dir: Path | None = None) -> Path:
    output_dir = Path(output_dir)
    app_dir = output_dir / "app"
    data_dir = output_dir / "data"
    data_dir.mkdir(parents=True, exist_ok=True)

    if app_dir.exists():
        shutil.rmtree(app_dir)
    shutil.copytree(TEMPLATE_DIR, app_dir, ignore=_IGNORE)

    course_dict = course.to_dict()

    if audio_dir is not None:
        audio_out = app_dir / "public" / "audio"
        audio_out.mkdir(parents=True, exist_ok=True)
        referenced_files = {
            item["audio"]["file"]
            for section in course_dict["sections"]
            for item in section["items"]
            if item.get("audio")
        }
        for filename in referenced_files:
            src = Path(audio_dir) / filename
            if src.exists():
                shutil.copy(src, audio_out / filename)

    (data_dir / "course.json").write_text(
        json.dumps(course_dict, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    for section in course_dict["sections"]:
        (data_dir / f"section_{section['id']}.json").write_text(
            json.dumps(section, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    (app_dir / "public" / "data").mkdir(parents=True, exist_ok=True)
    (app_dir / "public" / "data" / "course.json").write_text(
        json.dumps(course_dict, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # lib/data.ts statically imports ../data/course.json at build time — this
    # is the copy that actually ends up in the generated app, and it must
    # overwrite the empty placeholder that shutil.copytree just brought in.
    (app_dir / "data" / "course.json").write_text(
        json.dumps(course_dict, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    return app_dir
