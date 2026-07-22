# 語学学習アプリ生成システム（仮称: LinguaForge）

## プロジェクト概要

既存の語学学習テキストとその音声ファイルを入力として受け取り、
テキスト内容を解析して最適な学習方法を自動選択し、
学習用Webアプリ（PWA）を出力するパイプラインシステム。

- 開発主体: 合同会社語音
- 事業形態（当面）: 受託制作の社内制作ツール。教師から教材を受領 → 本システムで生成 → 人手で最終確認 → 納品
- **対象言語: 英語を第一優先で実装。**言語依存部分は `config.yaml` の `lang` パラメータ（en/ko）で切り替えられる設計とし、韓国語はフェーズ3で追加
- 対象学習者: 日本語母語の英語学習者

## 入力

- `input/text/` — 教材テキスト。対応形式: Markdown, plain text, docx（優先度順に実装）
- `input/audio/` — 対応する音声。wav または mp3。ファイル名でテキストの節と対応付け（`01_intro.md` ↔ `01_intro.wav`）
- `input/config.yaml` — 教材メタ情報（タイトル、対象レベル、教師名、納品先など）

## 出力

- `output/app/` — Next.js 14 (App Router) + Tailwind のスタンドアロンWebアプリ（静的書き出し可能なPWA）
- `output/data/` — 中間表現JSON一式（後述）。再生成・デバッグ用に必ず保存
- `output/report.md` — 解析結果と選択された学習方法の一覧（納品前チェック用）

## アーキテクチャ: 3層パイプライン

### 第1層: 解析層（Python）

1. **テキスト構造解析**（Claude API使用）
   - 節ごとにコンテンツ種別を判定: `vocabulary_list` / `dialogue` / `grammar_note` / `reading_passage` / `pattern_drill`
   - 語彙・例文・文法項目を構造化抽出（ハングル・ヨミ・日本語訳・品詞）
2. **音声アラインメント**（Montreal Forced Aligner, english_mfa 音響モデル・辞書）
   - 音声とテキストを強制アラインメントし、文・語・音素単位のタイムスタンプを取得
   - アラインメント失敗区間はreport.mdに警告として記録（人手確認対象）
3. **難易度・優先度付与**
   - 日本語話者の困難音素対（例: /l/-/r/, /b/-/v/, /s/-/θ/, /ɪ/-/iː/）を含む項目にフラグ
   - フェーズ2でL1加重ND・FL指標による出題優先度スコアを付与（NGSLベースの語彙指標テーブルを外部ファイルとして読み込む設計にする）
   - 連続音声過程（連結・同化・脱落・短縮形）を含む文にフラグを付け、リスニング教材として優先

### 第2層: 中間表現（JSON）

入力形式によらず統一スキーマに正規化する。出力層はこのJSONのみに依存すること。

```json
{
  "meta": { "title": "", "level": "", "source_files": [] },
  "sections": [
    {
      "id": "01",
      "content_type": "dialogue",
      "learning_methods": ["dictation", "shadowing", "roleplay"],
      "items": [
        {
          "id": "01-003",
          "text": "Would you like some coffee?",
          "ipa": "wʊdʒə laɪk səm ˈkɔfi",
          "ja": "コーヒーはいかがですか",
          "audio": { "file": "01_intro.wav", "start": 3.21, "end": 4.05 },
          "difficulty_flags": ["palatalization", "weak_form"]
        }
      ]
    }
  ]
}
```

## コンテンツ種別 → 学習方法マッピング

| content_type | 実装する学習方法 |
|---|---|
| vocabulary_list | SRSフラッシュカード（音声付き）、聞き取り選択問題 |
| dialogue | 部分再生ディクテーション、シャドーイング（速度調整付き）、ロールプレイ（片側ミュート） |
| grammar_note | 構造化インプット問題 → 穴埋めドリル、並べ替え問題 |
| reading_passage | 音読フォロー（カラオケ式ハイライト）、内容理解問題 |
| pattern_drill | 置換ドリル（音声提示 → 口頭産出 → モデル音声で確認） |

- 練習問題は「認識 → 再生 → 産出」の難易度順に配列すること
- 各セクションに複数の学習方法を割り当ててよい。判定根拠はreport.mdに明記

## 学習方法選択のSLA理論的根拠（設計原則）

学習方法の選択・パラメータ設定は以下の第二言語習得研究の知見に基づくこと。
report.mdには各セクションで選択した方法とその理論的根拠を必ず記載する
（納品時に教師へ提示する説明資料を兼ねる）。

| SLA知見 | システムでの実装 |
|---|---|
| 検索練習効果（retrieval practice; Roediger & Karpicke） | 再提示より想起テストを優先。フラッシュカードは常に「思い出してから答え表示」の形式 |
| 分散学習・間隔反復（spacing effect） | SRSスケジューラはFSRS（またはSM-2）を実装。集中反復モードは作らない |
| 交互配置（interleaving） | 同一ドリル内で文法項目・語彙をブロック提示せず混在配列 |
| 気づき仮説（Schmidt: noticing） | 目標形式・困難音素をテキスト内で視覚的にハイライト。ディクテーションの誤答箇所を明示フィードバック |
| 処理指導（VanPatten: Processing Instruction） | 文法項目はまず産出させず、意味と形式の対応を問う構造化インプット問題から始める |
| アウトプット仮説（Swain） | 各セクションの最終段階に必ず産出タスク（口頭・筆記）を置く。認識で終わらせない |
| スキル習得理論（DeKeyser: 宣言的→手続き的→自動化） | 解説提示 → 制約付き練習 → 流暢性練習（時間制限付き）の3段階を種別ごとに保証 |
| 関与負荷仮説（Laufer & Hulstijn） | 語彙タスクは検索・評価を含む高関与形式（文中使用、選択理由）を優先 |
| HVPT（高変動音声知覚訓練; Logan, Lively & Pisoni） | 困難音素対の知覚訓練は複数話者・複数音声環境の刺激で実施（フェーズ2: 複数話者音声の追加合成を検討） |
| シャドーイング研究（門田ほか: 音韻ループ・復唱効果） | シャドーイングは「マンブリング → テキスト付き → テキストなし」の段階提示。速度は0.75xから開始 |
| 理解可能なインプット＋i+1 | 教材の推定レベル（CEFR）に対し、提示順序を語彙・構文難易度の昇順に自動配列 |
| 明示的フィードバック研究（corrective feedback; Lyster & Ranta） | 誤答時は正答提示のみでなく、なぜ誤りやすいか（L1干渉の説明）を1行表示 |

**判定アルゴリズム**: 解析層はコンテンツ種別だけでなく「そのセクションで学習者が習得すべきもの（語彙・文法形式・音声特徴・談話パターン）」をClaude APIで推定し、上記原則に照らして学習方法の組み合わせと順序を決定する。マッピング表は初期値であり、習得目標に応じて上書きしてよい。

## 第3層: 生成層（Next.js テンプレート）

- `templates/base-app/` に固定テンプレートを置き、中間JSONを流し込んで生成する
- **教材ごとにコンポーネントを書き直さない。** テンプレート + データで量産する
- 学習方法ごとに1コンポーネント: `Flashcard.tsx`, `Dictation.tsx`, `Shadowing.tsx`, `ClozeDrill.tsx`, `KaraokeReader.tsx`, `SubstitutionDrill.tsx`
- 音声再生はタイムスタンプによる部分再生（Web Audio API）。速度変更は 0.75x / 1.0x を必須実装
- 進捗はlocalStorage保存（フェーズ1はサーバーレス）
- IPA表記の表示切替、ダークモード対応
- フェーズ2: 発音評価コンポーネント `PronunciationCheck.tsx`（Azure Pronunciation Assessment。既存TOEIC/英検アプリの実装を流用）

## 技術スタック

- 解析層: Python 3.11+, anthropic SDK, Montreal Forced Aligner（english_mfa モデル）
- 生成層: Next.js 14 App Router, Tailwind CSS, TypeScript
- 実行: CLI一発 `python pipeline.py --input ./input --output ./output --lang en`

## 開発フェーズ

1. **フェーズ1（MVP）**: 英語のみ。Markdownテキスト + wav入力、dialogue と vocabulary_list の2種別のみ対応。フラッシュカード・ディクテーション・シャドーイングを実装
2. **フェーズ2**: 全content_type対応、L1加重ND/FLベースの出題優先度、Azure発音評価、docx入力
3. **フェーズ3**: 韓国語対応（korean_mfa モデル + PDI指標テーブルの差し替え）、語音ホスティング、SaaS化検討

## 品質・チェック方針

- MFAアラインメントの信頼度が低い区間は必ずreport.mdに列挙し、人手確認を前提とする
- 抽出した日本語訳・ヨミはClaude APIの出力をそのまま信用せず、report.mdで一覧確認できるようにする
- テストデータとして `samples/` に短い教材1本（テキスト+音声）を用意し、パイプライン全体のE2Eテストを常に通すこと

---

## 実装状況

> このセクションは各開発タスク完了時に更新する。詳細な使い方・検証コマンドは
> [`README.md`](README.md) を参照。

### フェーズ1（MVP）— 完了

- Markdown/txt/html/rtf/docx/pdf/pptx 入力（フェーズ1計画のMarkdown+wavから拡張済み）
- `vocabulary_list` / `dialogue` の解析・学習方法（Flashcard, Dictation, Shadowing）

### フェーズ2 — 進行中

- [x] docx/html/rtf/pdf/pptx入力（フェーズ1の範囲を超えて先行実装済み）
- [x] 全content_type対応（`grammar_note` → ClozeDrill, `reading_passage` → KaraokeReader,
      `pattern_drill` → SubstitutionDrill）
- [x] ClaudeClassifierの実APIテスト基盤（`tests/test_classify_live.py`、`ANTHROPIC_API_KEY`必須）
- [x] L1加重ND/FLベースの出題優先度スコア（`analysis/priority.py` + `analysis/neighborhood.py`）
      — FLは`wordfreq`（Apache-2.0）による実頻度データ、NDはCMUdictベースの実計算。
      母集団はCMUdict全体（NGSL本家データへの絞り込みは下記の理由で未実施）
- [x] `Roleplay.tsx`（dialogue: 片側ミュート＋自己録音確認。話者ラベルは
      `classify.py`（Claude API・ヒューリスティック双方）が項目ごとに付与し、
      中間JSONの `speaker` フィールド経由でUIに渡る）
- [x] `ListeningChoice.tsx`（vocabulary_list: 4択聞き取り、L1加重ND高語を優先的にディストラクタ化）
- [x] （代替対応）**FL用実頻度データ**: NGSL本家の代わりに`wordfreq`（Robyn Speer, Apache-2.0）
      を採用。ライセンス明確・カバレッジが事実上全英単語と、NGSL不採用の埋め合わせとして
      誠実に使える。`wordfreq`未インストール時は簡易頻度帯テーブルにフォールバック
      （`report.md`に警告表示）
- [ ] **NGSL 1.2本家データセットそのもの**: `newgeneralservicelist.org` がこの開発環境の
      ネットワークポリシーでブロックされており取得不可。PyPIの`ngsl`パッケージはライセンス
      不明・データ由来検証不能のため不採用。NGSL固有の「ESL教育向け厳選語彙」という性質が
      必要な場合は、実データの直接提供、またはネットワークポリシー調整が必要
      （README「まだ実装していないもの」参照）
- [ ] Azure発音評価（`PronunciationCheck.tsx`）— 要Azure契約・APIキー、未着手

### フェーズ3 — 未着手

- 韓国語対応（korean_mfa、PDI指標テーブル）
- 語音ホスティング、SaaS化検討
