"""Structure analysis + structured extraction (第1層 1.), via Claude API.

Each section is classified into a content_type, has its learning target
inferred (vocab / grammar form / phonetic feature / discourse pattern), and
gets a learning_methods list + a one-line SLA rationale for report.md — this
module is the "判定アルゴリズム" described in AGENTS.md.

ClaudeClassifier is also allowed to complete/correct/restructure messy or
incomplete source text (OCR garble, docx/pdf conversion artifacts, a
truncated sentence) rather than passing it through verbatim — but never
silently: any changed item carries original_text + revision_note, and
report.py surfaces every one of them for human review before delivery.
Sections with matching audio get a stricter instruction (transcription-level
fixes only) since MFA alignment and dictation grading assume item text
matches what's actually spoken.

A HeuristicClassifier fallback covers offline/CI runs (no ANTHROPIC_API_KEY):
it is intentionally crude (regex/shape-based, no text correction at all)
and exists only so `samples/` E2E tests don't require network access. Real
deliveries always go through ClaudeClassifier.
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
    items: list  # list[dict]: text, ja, ipa, pos, speaker, original_text, revision_note


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
                        "text": {"type": "string", "description": "学習項目として提示する最終テキスト（必要に応じ補完・修正・再構成済み）"},
                        "ja": {"type": "string", "description": "日本語訳"},
                        "ipa": {"type": "string", "description": "IPA表記"},
                        "pos": {"type": "string", "description": "品詞（vocabulary_listのみ）"},
                        "speaker": {"type": "string", "description": "話者名（dialogueのみ。例: A, B, Maria）"},
                        "original_text": {
                            "type": "string",
                            "description": "text を元のテキストから補完・修正・再構成した場合のみ、変更前の原文をそのまま記載。変更していない場合は空文字。",
                        },
                        "revision_note": {
                            "type": "string",
                            "description": "text を変更した場合のみ、何をどう変えたか・なぜ変えたかを日本語1行で。変更していない場合は空文字。",
                        },
                    },
                    "required": ["text", "ja", "ipa", "original_text", "revision_note"],
                },
            },
        },
        "required": ["content_type", "learning_target_summary", "learning_methods", "rationale", "items"],
    },
}

_SYSTEM_PROMPT = """あなたは第二言語習得（SLA）研究に基づいて英語教材を解析する言語学者です。
入力される教材の1節（Markdown。docx/pdf/html等から変換されたテキストの場合もある）を読み、
以下を行ってください:

1. content_type を vocabulary_list / dialogue / grammar_note / reading_passage / pattern_drill から1つ判定する
2. その節で学習者が習得すべきもの（語彙・文法形式・音声特徴・談話パターン）を推定する
3. 推定した習得目標とSLA研究の知見（検索練習効果・間隔反復・交互配置・気づき仮説・処理指導・
   アウトプット仮説・スキル習得理論・関与負荷仮説・HVPT・シャドーイング研究・i+1・明示的フィードバック研究）
   に照らして学習方法を「認識→再生→産出」の順に選び、一言で理論的根拠を述べる
4. 節内のテキストを項目（例文・語彙）に分割し、各項目について日本語訳とIPA表記を付与する
5. content_type が dialogue の場合、各項目にその発話者名（speaker）を付与する
   （ロールプレイで話者ごとにミュート・切替するために使用する）

## 入力テキストの補完・修正・再構成について

PDF/OCR/docx変換や教師の走り書きに由来する誤字脱字・文字化け・文の途中切れ・脱字などの
明らかな不備がある場合、学習項目として提示する前に教育的に適切な形へ補完・修正・再構成してよい。
ただし以下を厳守すること:

- 変更した場合は必ず items[].original_text に変更前の原文をそのまま、
  items[].revision_note に変更内容と理由を日本語1行で記載する（例:
  「OCR誤読 'teh' を 'the' に修正」「文末が欠落していたため文脈から補完」）。
  変更していない項目は両方とも空文字のままにする
- **音声ファイルが存在する節（下記ユーザーメッセージで明示される）では、書き起こしの
  誤字レベルの補正に留め、実際に話されている内容と異なる修正はしないこと。**
  音声アラインメントは項目テキストと実際の発話が一致している前提で動作するため、
  内容を変えると音声タイムスタンプがずれ、ディクテーションの採点も不正確になる
- 音声のない節（grammar_noteの例文など）では、教育的な観点からより踏み込んだ
  補完・再構成を行ってよい
- 教師が意図的に選んだ平易な表現・教育方針上の言い回しは尊重し、不必要な書き換えは行わないこと。
  「直す」のではなく「明らかに壊れている・欠けている箇所を補う」姿勢を基本とする

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
        audio_note = (
            f"[この節には音声ファイル {section.audio_file} が対応しています。"
            "書き起こしの誤字レベルの補正に留めてください]"
            if section.audio_file
            else "[この節に対応する音声ファイルはありません]"
        )
        message = self._client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=_SYSTEM_PROMPT,
            tools=[_TOOL_SCHEMA],
            tool_choice={"type": "tool", "name": "emit_section_analysis"},
            messages=[
                {
                    "role": "user",
                    "content": f"{audio_note}\n\n# {section.title}\n\n{section.body}",
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


def _word_overlap_ratio(lines: list[str]) -> float:
    """High when consecutive lines share most of their words — the shape of
    a substitution drill (one slot changes, the rest of the sentence
    repeats)."""
    word_sets = [set(re.findall(r"[a-zA-Z']+", l.lower())) for l in lines]
    ratios = []
    for a, b in zip(word_sets, word_sets[1:]):
        if not a or not b:
            continue
        ratios.append(len(a & b) / max(len(a | b), 1))
    return sum(ratios) / len(ratios) if ratios else 0.0


class HeuristicClassifier:
    """Deterministic, offline fallback. Used when ANTHROPIC_API_KEY is unset
    so `samples/` can still be run end-to-end without network access.

    This is intentionally crude pattern-matching, not real SLA inference —
    real deliveries always go through ClaudeClassifier, which reasons about
    the actual content instead of guessing content_type from text shape."""

    _DIALOGUE_LINE = re.compile(r"^\s*([A-Za-z][\w .]{0,20}):\s*(.+)$")
    _BULLET_OR_TABLE = re.compile(r"^\s*([-*]|\|)\s*")
    _GRAMMAR_TITLE = re.compile(r"grammar|tense|文法", re.I)
    _DRILL_TITLE = re.compile(r"\bdrill\b|pattern|ドリル|パターン", re.I)

    def classify(self, section: RawSection, lang: str = "en") -> SectionAnalysis:
        lines = [l for l in section.body.splitlines() if l.strip() and not l.strip().startswith("#")]

        dialogue_lines = [self._DIALOGUE_LINE.match(l) for l in lines]
        dialogue_hits = sum(1 for m in dialogue_lines if m)

        speakers: list[str] = []

        if self._GRAMMAR_TITLE.search(section.title):
            # A title is a much more reliable offline signal than trying to
            # infer grammar content from sentence shape alone.
            content_type = "grammar_note"
            texts = [l.strip() for l in lines]
        elif self._DRILL_TITLE.search(section.title):
            content_type = "pattern_drill"
            texts = [l.strip() for l in lines]
        elif dialogue_hits >= max(2, len(lines) // 2):
            content_type = "dialogue"
            texts = [m.group(2).strip() for m in dialogue_lines if m]
            speakers = [m.group(1).strip() for m in dialogue_lines if m]
        elif any(self._BULLET_OR_TABLE.match(l) for l in lines):
            content_type = "vocabulary_list"
            texts = [re.sub(r"^\s*([-*]|\|)\s*", "", l).split("|")[0].strip() for l in lines]
            texts = [t for t in texts if t]
        elif len(lines) >= 3 and _word_overlap_ratio(lines) > 0.45:
            content_type = "pattern_drill"
            texts = [l.strip() for l in lines]
        elif len(lines) <= 3 and sum(len(l.split()) for l in lines) >= 20:
            # a handful of long, unbulleted lines reads as prose, not a list
            content_type = "reading_passage"
            joined = " ".join(l.strip() for l in lines)
            texts = [s.strip() for s in re.split(r"(?<=[.!?])\s+", joined) if s.strip()]
        else:
            content_type = "dialogue"
            texts = [l.strip() for l in lines]
            speakers = [(m.group(1).strip() if m else "") for m in dialogue_lines]

        items = [
            {
                "text": t,
                "ja": "",
                "ipa": "",
                "pos": "",
                "speaker": (speakers[i] if i < len(speakers) else ""),
                # Pattern-matching only — never corrects/completes/restructures
                # text, so there is never anything to report here.
                "original_text": "",
                "revision_note": "",
            }
            for i, t in enumerate(texts)
            if t
        ]

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
