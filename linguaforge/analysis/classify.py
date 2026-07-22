"""Structure analysis + structured extraction (第1層 1.), via Claude API.

Each section is classified into a content_type, has its learning target
inferred (vocab / grammar form / phonetic feature / discourse pattern), and
gets a learning_methods list + a one-line SLA rationale for report.md — this
module is the "判定アルゴリズム" described in AGENTS.md.

A HeuristicClassifier fallback covers offline/CI runs (no ANTHROPIC_API_KEY):
it is intentionally crude and exists only so `samples/` E2E tests don't
require network access. Real deliveries always go through ClaudeClassifier.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass

from .parser import RawSection
from .schema import CONTENT_TYPE_METHODS

DEFAULT_MODEL = os.environ.get("LINGUAFORGE_MODEL", "claude-sonnet-4-5-20250929")

SLA_RATIONALE_HINTS = {
    "vocabulary_list": (
        "検索練習効果（Roediger & Karpicke）に基づき想起優先のフラッシュカードを採用。"
        "関与負荷仮説（Laufer & Hulstijn）に従い、文中使用・選択理由を問う高関与形式を選択肢問題に含める。"
    ),
    "dialogue": (
        "ディクテーションで気づき仮説（Schmidt: noticing）に基づき誤答箇所を明示。"
        "シャドーイングは音韻ループ・復唱効果（門田ほか）に基づきマンブリング→テキスト付き→テキストなしの段階提示。"
        "ロールプレイはアウトプット仮説（Swain）に基づく産出タスクとして最終段階に配置。"
    ),
    "grammar_note": (
        "処理指導（VanPatten: Processing Instruction）に基づき、産出させる前に意味と形式の対応を"
        "問う構造化インプット問題を先行させ、その後に穴埋め・並べ替えで制約付き産出へ移行。"
    ),
    "reading_passage": (
        "理解可能なインプット+i+1の原則に基づき語彙・構文難易度の昇順で配列。"
        "音読フォローはスキル習得理論（DeKeyser）の宣言的→手続き的段階に対応。"
    ),
    "pattern_drill": (
        "スキル習得理論（DeKeyser）に基づき、音声提示（宣言的知識の確認）→口頭産出（制約付き練習）→"
        "モデル音声確認（フィードバック）の3段階を実装。"
    ),
}


@dataclass
class SectionAnalysis:
    content_type: str
    learning_target_summary: str
    learning_methods: list
    rationale: str
    items: list  # list[dict]: text, ja, ipa, pos


_TOOL_SCHEMA = {
    "name": "emit_section_analysis",
    "description": "Emit structured analysis of one language-learning text section.",
    "input_schema": {
        "type": "object",
        "properties": {
            "content_type": {
                "type": "string",
                "enum": list(CONTENT_TYPE_METHODS.keys()),
            },
            "learning_target_summary": {
                "type": "string",
                "description": "何を習得させる節か（語彙/文法形式/音声特徴/談話パターン）を日本語1文で。",
            },
            "learning_methods": {
                "type": "array",
                "items": {"type": "string"},
                "description": "認識→再生→産出の順で並べた学習方法名の配列。",
            },
            "rationale": {
                "type": "string",
                "description": "採用したSLA理論的根拠を日本語1〜2文で。",
            },
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "text": {"type": "string"},
                        "ja": {"type": "string", "description": "日本語訳"},
                        "ipa": {"type": "string", "description": "IPA表記"},
                        "pos": {"type": "string", "description": "品詞（vocabulary_listのみ）"},
                    },
                    "required": ["text", "ja", "ipa"],
                },
            },
        },
        "required": ["content_type", "learning_target_summary", "learning_methods", "rationale", "items"],
    },
}

_SYSTEM_PROMPT = """あなたは第二言語習得（SLA）研究に基づいて英語教材を解析する言語学者です。
入力される教材の1節（Markdown）を読み、以下を行ってください:

1. content_type を vocabulary_list / dialogue / grammar_note / reading_passage / pattern_drill から1つ判定する
2. その節で学習者が習得すべきもの（語彙・文法形式・音声特徴・談話パターン）を推定する
3. 推定した習得目標とSLA研究の知見（検索練習効果・間隔反復・交互配置・気づき仮説・処理指導・
   アウトプット仮説・スキル習得理論・関与負荷仮説・HVPT・シャドーイング研究・i+1・明示的フィードバック研究）
   に照らして学習方法を「認識→再生→産出」の順に選び、一言で理論的根拠を述べる
4. 節内のテキストを項目（例文・語彙）に分割し、各項目について日本語訳とIPA表記を付与する

日本語母語の学習者を想定すること。IPAは可能な限り正確に付与すること。"""


class ClaudeClassifier:
    def __init__(self, model: str = DEFAULT_MODEL):
        self.model = model
        try:
            import anthropic
        except ImportError as e:
            raise RuntimeError(
                "anthropic package is required for ClaudeClassifier. "
                "Install it (pip install anthropic) or run pipeline.py with --mock."
            ) from e
        self._client = anthropic.Anthropic()

    def classify(self, section: RawSection, lang: str = "en") -> SectionAnalysis:
        message = self._client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=_SYSTEM_PROMPT,
            tools=[_TOOL_SCHEMA],
            tool_choice={"type": "tool", "name": "emit_section_analysis"},
            messages=[
                {
                    "role": "user",
                    "content": f"# {section.title}\n\n{section.body}",
                }
            ],
        )
        tool_use = next(b for b in message.content if b.type == "tool_use")
        result = tool_use.input
        return SectionAnalysis(
            content_type=result["content_type"],
            learning_target_summary=result["learning_target_summary"],
            learning_methods=result["learning_methods"],
            rationale=result["rationale"],
            items=result["items"],
        )


class HeuristicClassifier:
    """Deterministic, offline fallback. Used when ANTHROPIC_API_KEY is unset
    so `samples/` can still be run end-to-end without network access."""

    _DIALOGUE_LINE = re.compile(r"^\s*([A-Za-z][\w .]{0,20}):\s*(.+)$")
    _BULLET_OR_TABLE = re.compile(r"^\s*([-*]|\|)\s*")

    def classify(self, section: RawSection, lang: str = "en") -> SectionAnalysis:
        lines = [l for l in section.body.splitlines() if l.strip() and not l.strip().startswith("#")]

        dialogue_lines = [self._DIALOGUE_LINE.match(l) for l in lines]
        dialogue_hits = sum(1 for m in dialogue_lines if m)

        if dialogue_hits >= max(2, len(lines) // 2):
            content_type = "dialogue"
            texts = [m.group(2).strip() for m in dialogue_lines if m]
        elif any(self._BULLET_OR_TABLE.match(l) for l in lines):
            content_type = "vocabulary_list"
            texts = [re.sub(r"^\s*([-*]|\|)\s*", "", l).split("|")[0].strip() for l in lines]
            texts = [t for t in texts if t]
        else:
            content_type = "dialogue"
            texts = [l.strip() for l in lines]

        items = [{"text": t, "ja": "", "ipa": "", "pos": ""} for t in texts if t]

        return SectionAnalysis(
            content_type=content_type,
            learning_target_summary=f"(heuristic fallback) {content_type} section, no live SLA inference",
            learning_methods=list(CONTENT_TYPE_METHODS[content_type]),
            rationale=SLA_RATIONALE_HINTS[content_type] + "（オフラインヒューリスティックのため要人手確認）",
            items=items,
        )


def build_classifier(mock: bool = False, model: str = DEFAULT_MODEL):
    if mock or not os.environ.get("ANTHROPIC_API_KEY"):
        return HeuristicClassifier()
    return ClaudeClassifier(model=model)
