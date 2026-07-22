"""output/report.md generation — the pre-delivery human-check document.

Must surface (per AGENTS.md):
  - the learning-method decision + SLA rationale per section
  - low-confidence / failed alignment spans
  - every extracted ja/ipa value, for human spot-check
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from .schema import Course


def render_report(
    course: Course,
    warnings: list[str],
    generated_at: datetime | None = None,
    oov_words: list[str] | None = None,
) -> str:
    generated_at = generated_at or datetime.now(timezone.utc)
    lines: list[str] = []
    lines.append(f"# {course.title} — 解析レポート")
    lines.append("")
    lines.append(f"- レベル: {course.level}")
    lines.append(f"- 言語: {course.lang}")
    lines.append(f"- 元ファイル: {', '.join(course.source_files)}")
    lines.append(f"- 生成日時: {generated_at.isoformat()}")
    lines.append("")

    lines.append("## セクション別 学習方法とSLA根拠")
    lines.append("")
    for section in course.sections:
        lines.append(f"### {section.id} {section.title} ({section.content_type})")
        lines.append(f"- 学習方法: {', '.join(section.learning_methods)}")
        lines.append(f"- 根拠: {section.rationale}")
        lines.append(f"- 項目数: {len(section.items)}")
        lines.append("")

    lines.append("## 警告（要人手確認）")
    lines.append("")
    lines.append("音声アラインメントの信頼度低下だけでなく、解析データソースのフォールバック等も含む。")
    lines.append("")
    if warnings:
        for w in warnings:
            lines.append(f"- ⚠️ {w}")
    else:
        lines.append("- 警告なし")
    lines.append("")

    lines.append("## 抽出内容の確認用一覧（訳・IPA・ND）")
    lines.append("")
    lines.append("Claude APIの出力はそのまま信用せず、必ずここで確認すること。")
    lines.append("ND / L1加重ND は単語項目のみ（文には未定義）。CMUdict未収載語は下記に別途一覧。")
    lines.append("")
    for section in course.sections:
        lines.append(f"### {section.id} {section.title}")
        lines.append("")
        lines.append("| id | text | ipa | ja | difficulty_flags | ND | L1加重ND | alignment |")
        lines.append("|---|---|---|---|---|---|---|---|")
        for item in section.items:
            flags = ", ".join(item.difficulty_flags) or "-"
            nd_col = str(item.nd) if item.nd is not None else "-"
            nd_l1_col = str(item.nd_l1_weighted) if item.nd_l1_weighted is not None else "-"
            if item.alignment_confidence is None:
                align_col = "音声なし"
            elif item.alignment_confidence < 0.5:
                align_col = "⚠️ 低信頼度"
            else:
                align_col = "OK"
            lines.append(
                f"| {item.id} | {item.text} | {item.ipa} | {item.ja} | {flags} | "
                f"{nd_col} | {nd_l1_col} | {align_col} |"
            )
        lines.append("")

    lines.append("## CMUdict未収載語（NDスコア計算対象外）")
    lines.append("")
    if oov_words:
        lines.append("以下の単語項目はCMUdictに発音情報が無く、ND / L1加重NDを計算できなかった:")
        lines.append("")
        for w in oov_words:
            lines.append(f"- {w}")
    else:
        lines.append("- 未収載語なし")
    lines.append("")

    return "\n".join(lines)


def write_report(
    course: Course,
    warnings: list[str],
    output_dir: Path,
    oov_words: list[str] | None = None,
) -> Path:
    report_path = Path(output_dir) / "report.md"
    report_path.write_text(render_report(course, warnings, oov_words=oov_words), encoding="utf-8")
    return report_path
