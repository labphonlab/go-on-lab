"""Live-API verification of ClaudeClassifier against samples/.

Everything else in this test suite exercises HeuristicClassifier (the
offline fallback), since that's what runs without network/credentials.
This file is the one place that actually calls the Claude API, to catch
things a heuristic-only test suite structurally cannot: whether the real
prompt in classify.py's ClaudeClassifier produces valid content_types,
non-empty rationale, and rationale that actually cites an SLA theory from
AGENTS.md's principle table (not just plausible-looking prose).

Run it with:
    ANTHROPIC_API_KEY=sk-... pytest -m live

Add a written summary report (docs/live-test-report.md) with:
    ANTHROPIC_API_KEY=sk-... LINGUAFORGE_LIVE_REPORT=1 pytest -m live

Without ANTHROPIC_API_KEY set, this test skips itself — a plain `pytest`
run (as CI does) is unaffected either way.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path

import pytest

from analysis.classify import ClaudeClassifier, HeuristicClassifier
from analysis.parser import load_sections
from analysis.schema import CONTENT_TYPES

pytestmark = pytest.mark.live

SAMPLES_INPUT = Path(__file__).resolve().parent.parent / "samples" / "input"
REPORT_PATH = Path(__file__).resolve().parent.parent / "docs" / "live-test-report.md"

# Names/phrases from CLAUDE.md's SLA-principle table (both English authors
# and the Japanese terms classify.py's system prompt actually uses) — a
# rationale should cite at least one to count as theory-grounded rather
# than generic filler.
SLA_THEORY_MARKERS = [
    "Roediger", "Karpicke", "検索練習効果", "retrieval practice",
    "spacing", "間隔反復", "分散学習", "SRS", "FSRS", "SM-2",
    "interleav", "交互配置",
    "Schmidt", "noticing", "気づき仮説",
    "VanPatten", "処理指導", "Processing Instruction", "構造化インプット",
    "Swain", "アウトプット仮説", "output hypothesis",
    "DeKeyser", "スキル習得理論", "skill acquisition",
    "Laufer", "Hulstijn", "関与負荷仮説", "involvement load",
    "Logan", "Lively", "Pisoni", "HVPT", "高変動音声知覚訓練",
    "門田", "シャドーイング研究", "音韻ループ",
    "i+1", "comprehensible input", "理解可能なインプット",
    "Lyster", "Ranta", "corrective feedback", "明示的フィードバック",
]


def _cites_sla_theory(text: str) -> bool:
    return any(marker in text for marker in SLA_THEORY_MARKERS)


def _skip_reason() -> str | None:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return "ANTHROPIC_API_KEY not set — skipping live Claude API test"
    return None


@pytest.mark.skipif(_skip_reason() is not None, reason=_skip_reason() or "")
def test_claude_classifier_against_samples():
    raw_sections = load_sections(SAMPLES_INPUT / "text", SAMPLES_INPUT / "audio")

    claude = ClaudeClassifier()
    heuristic = HeuristicClassifier()

    rows = []
    for raw in raw_sections:
        claude_result = claude.classify(raw, lang="en")
        heuristic_result = heuristic.classify(raw, lang="en")
        rows.append(
            {
                "section_id": raw.id,
                "title": raw.title,
                "claude_content_type": claude_result.content_type,
                "heuristic_content_type": heuristic_result.content_type,
                "agree": claude_result.content_type == heuristic_result.content_type,
                "learning_target_summary": claude_result.learning_target_summary,
                "rationale": claude_result.rationale,
                "n_items": len(claude_result.items),
            }
        )

    for row in rows:
        # (a) content_type is one of the 5 schema values
        assert row["claude_content_type"] in CONTENT_TYPES, (
            f"section {row['section_id']}: unexpected content_type {row['claude_content_type']!r}"
        )
        # (c) learning target + rationale are non-empty and rationale cites theory
        assert row["learning_target_summary"].strip(), f"section {row['section_id']}: empty learning_target_summary"
        assert row["rationale"].strip(), f"section {row['section_id']}: empty rationale"
        assert _cites_sla_theory(row["rationale"]), (
            f"section {row['section_id']}: rationale doesn't cite a known SLA theory: {row['rationale']!r}"
        )

    # (b) agreement rate vs. the offline heuristic, logged either way
    agreement = sum(r["agree"] for r in rows) / len(rows)
    print(f"\nHeuristic vs Claude content_type agreement: {agreement:.0%} ({sum(r['agree'] for r in rows)}/{len(rows)})")
    for r in rows:
        mark = "==" if r["agree"] else "!="
        print(f"  {r['section_id']} {r['title']}: heuristic={r['heuristic_content_type']} {mark} claude={r['claude_content_type']}")

    if os.environ.get("LINGUAFORGE_LIVE_REPORT"):
        _write_report(rows, agreement)


def _write_report(rows: list[dict], agreement: float) -> None:
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)

    lines = [
        "# ClaudeClassifier ライブAPIテスト結果",
        "",
        f"- 実行日時: {datetime.now(timezone.utc).isoformat()}",
        f"- 対象: `samples/input`（{len(rows)}セクション）",
        f"- Heuristic分類との一致率: **{agreement:.0%}** ({sum(r['agree'] for r in rows)}/{len(rows)})",
        "",
        "## セクション別の一致状況",
        "",
        "| section | title | heuristic | claude | 一致 |",
        "|---|---|---|---|---|",
    ]
    for r in rows:
        mark = "✓" if r["agree"] else "✗ 要確認"
        lines.append(
            f"| {r['section_id']} | {r['title']} | {r['heuristic_content_type']} | "
            f"{r['claude_content_type']} | {mark} |"
        )

    lines += ["", "## 根拠文の品質所見", ""]
    for r in rows:
        word_count = len(r["rationale"])
        note = "十分な分量" if word_count >= 40 else "簡潔（要目視確認）"
        lines.append(f"### {r['section_id']} {r['title']}")
        lines.append(f"- 習得目標の推定: {r['learning_target_summary']}")
        lines.append(f"- 根拠文（{note}、{word_count}文字）: {r['rationale']}")
        lines.append("")

    REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"\nWrote {REPORT_PATH}")
