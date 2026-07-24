# CLAUDE.md — A2→B1 総合英語テキスト制作プロジェクト

## 1. プロジェクト概要

- **目的**: CEFR A2 の日本人学習者を B1 に到達させる独習用・4技能総合英語テキストを制作する
- **形態**: 紙の書籍（PDF入稿）＋ インストール不要のウェブアプリ（`learn.goonresearch.jp`）のハイブリッド
- **想定学習者**: 独習者（教師なし前提）。英検準2級〜2級・TOEIC 400–550 帯
- **設計思想**: 第二言語習得研究（SLA）の成果を構成レベルで実装する。単一ソース（構造化コンテンツ）から紙面 PDF とアプリ用 JSON の両方をビルドする
- **発行**: 合同会社語音（Go-on LLC）

## 2. SLA 設計原理（実装対応表）

全体の骨格は Nation (2007) の four strands。全活動に strand タグを付与し、ユニット単位で 4 ストランドの時間配分が概ね均等になるよう検証する。

| SLA 原理 | 実装 | 媒体 |
|---|---|---|
| 意味重視インプット（i+1、98%カバー率） | 語彙統制済み対話・読み物・リスニング | 紙＋アプリ |
| Noticing / input enhancement (Schmidt) | ターゲット形式の太字・下線、日英対照解説 | 紙 |
| Processing Instruction (VanPatten) | 解釈タスク → 産出の順で文法練習を配列 | 紙 |
| Pushed output (Swain) | ユニット末メインタスク（書く・話す） | 紙＋アプリ採点 |
| Interaction 仮説 | AI 対話ロールプレイ（recast・明確化要求を実装） | アプリ |
| 自動化理論 (DeKeyser) / 流暢性開発 | シャドーイング3段階・4/3/2・timed reading | アプリ |
| 分散効果・検索練習 | SRS 語彙フラッシュカード（SM-2） | アプリ |
| 音声知覚訓練（HVPT） | L1加重NDが高い語の複数話者知覚訓練 | アプリ |
| 自己調整学習 | Can-do 自己評価・進捗可視化・学習計画ガイド | 紙＋アプリ |

## 3. 全体構成

- **20ユニット**。CEFR-J の Can-do（A2.2 → B1.1）に沿って機能・話題を配列
- **語彙シラバス**: NGSL 1,001–2,800 語帯を中心に約 900 語をターゲット化。配列は頻度ランクを ND・FL・L1加重ND で補正（高 L1加重ND 語は早期導入し HVPT と連携）
- **文法シラバス**: A2→B1 の壁となる項目を機能ベースで導入（経験の have+過去分詞、比較、条件、関係節、間接疑問、受動、不定詞/動名詞の使い分け 等）
- **巻頭**: 「このテキストの使い方」（週あたり学習時間モデル、4ストランドの説明、アプリ接続手順）
- **巻末**: 語彙索引（発音記号・初出ユニット付き）、Can-do チェックリスト総覧
- **5ユニットごとに復習ユニット相当の Consolidation セクション**（既習素材の流暢性開発に充当）

## 4. ユニットテンプレート（紙面 7 ステップ＋アプリ連携）

各ユニットは以下の固定構造。各セクションに `strand` と `medium` を必ず付与する。

1. **Warm-up**（紙）— タスク予告とスキーマ活性化。strand: meaning-focused output（準備）
2. **Input**（紙＋音声はアプリ）— 対話＋読み物。累積既習語彙＋ターゲット語で 98% カバー率。strand: meaning-focused input
3. **Noticing**（紙）— input enhancement、日英対照。strand: language-focused learning
4. **Language Focus**（紙）— PI 解釈タスク → 統制産出。解説は自己完結（です・ます調、専門用語最小限）。strand: language-focused learning
5. **Main Task**（紙＋アプリ）— 情報ギャップは「AI が情報の半分を持つ」形で独習化。ライティング/スピーキング成果物は Claude 採点でフィードバック。strand: meaning-focused output
6. **Fluency**（アプリ）— シャドーイング3段階、4/3/2、既習素材のみ使用。strand: fluency development
7. **Reflection**（紙＋アプリ連動）— Can-do 自己評価、達成記録欄

**QR 動線（紙⇄アプリの往復設計）**:

- アプリ活動が登場する紙面の各箇所に、セクション単位のディープリンク QR（`https://learn.goonresearch.jp/u/{unit}/{section}`）を印刷する。QR の隣に短縮 URL（例 `goon.jp/u7s3`）を併記
- QR は `build_pdf.py` が unit.yaml のセクション ID から自動生成して配置する（手作業での貼付は禁止。URL とコンテンツの整合性をビルド時に保証）
- **開いたままなら続行**: 一度アプリを開いたら、再スキャンなしにアプリ内ナビゲーション（ユニットマップ・「次の活動へ」ボタン）で続きの活動に進める。活動終了画面には対応する紙面ページ番号を表示し、紙に戻す
- **閉じたら QR で再開**: ブラウザやタブを閉じても、該当箇所の QR を読み直せばその活動が開き、IndexedDB に保存された進捗（シャドーイングの段階、SRS セッション途中の状態など）から再開できる。ディープリンク自体はステートレスに保ち、状態は常にローカル DB から復元する

## 5. リポジトリ構造

```
a2b1-textbook/
  CLAUDE.md
  content/
    syllabus.yaml            # 全体シラバス（Can-do・文法・語彙配当）
    vocabulary.csv           # word, ngsl_rank, nd, fl, l1_weighted_nd, hvpt, unit
    app_config.yaml          # ディープリンクのベースURL・短縮ドメイン設定
    units/unit01/ … unit20/
      unit.yaml              # メタデータ（下記スキーマ）
      sections/*.md          # セクション本文（frontmatter 付き Markdown）
      audio/                 # 生成音声＋MFA TextGrid
  scripts/
    vocab_check.py           # カバー率・未習語検出（ビルド時必須ゲート）
    audio_gen.py             # TTS → MFA アラインメント
    export_app.py            # → build/app-export/*.json
    build_pdf.py             # → build/pdf/（Typst、セクションQR自動生成込み）
  app/                       # learn.goonresearch.jp（Next.js 14 PWA）
  build/
    qr-map.json              # short_code → deep_link の対応表（リダイレクト設定に利用）
```

## 6. データスキーマ

### 6.1 unit.yaml（コンテンツ単一ソース）

```yaml
unit: 7
title: "Making Plans with Friends"
cefr_j: "A2.2"
can_do:
  - id: "A2.2-SI-3"
    ja: "友人と予定を調整し、簡単な提案・修正ができる"
grammar_focus: ["be going to vs will", "shall we / why don't we"]
vocabulary_targets: [45語のword list]      # vocabulary.csv と整合必須
sections:
  - id: "07-input-dialogue"
    type: input_dialogue    # warmup|input_dialogue|input_reading|noticing|
                            # form_pi|form_production|main_task|fluency|reflection
    strand: meaning_input   # meaning_input|meaning_output|language_focus|fluency
    medium: both            # paper|app|both
    app_components: [karaoke_reader, shadowing, dictation]
```

`app_components` が1つ以上あるセクションは、紙面ビルド時に自動的に QR コード（§4）が付与される。`app_components: []` かつ `medium: paper` のセクションには QR を配置しない。

### 6.2 アプリ用エクスポート JSON（LinguaForge 互換）

`export_app.py` は unit.yaml と sections/*.md から LinguaForge の content_type 形式に直接変換する（classify.py はバイパスし、`type` フィールドで明示指定）。

```json
{
  "unit": 7,
  "components": [
    {"type": "flashcard_sm2", "items": [{"id": "w-1023", "en": "...", "ja": "...", "audio": "..."}]},
    {"type": "shadowing", "audio": "...", "textgrid": "...", "stages": 3},
    {"type": "dictation", "items": []},
    {"type": "cloze", "items": []},
    {"type": "roleplay_ai", "scenario": "...", "ai_role": "...", "learner_goal": "...",
     "known_vocab_cap": 1450, "recast": true, "clarification_requests": true,
     "eval_rubric": "..."},
    {"type": "pronunciation_assess", "targets": []},
    {"type": "hvpt", "contrast": "l-r", "items": []},
    {"type": "can_do_survey", "items": []}
  ]
}
```

`roleplay_ai` のシステムプロンプト要件: (1) 応答語彙を累積既習語彙内に制約、(2) 学習者の誤りは recast で自然に言い直す、(3) 不明瞭な発話には明確化要求を返す、(4) セッション末に JSON でタスク達成評価を出力。

### 6.3 学習記録 DB（Supabase Postgres）

ローカルファースト設計: 全機能は未ログインで IndexedDB のみで動作。ログイン時にサーバー同期（アイテム単位 last-write-wins、`updated_at` 比較）。

```sql
-- auth.users は Supabase Auth 管理（メール Magic Link + Google OAuth）
srs_state(user_id, item_id, ease, interval_days, due_at, reps, lapses, updated_at)
unit_progress(user_id, unit, section_id, completed_at, updated_at)
can_do_responses(user_id, can_do_id, self_rating, responded_at)
task_submissions(user_id, unit, task_type,  -- writing|speaking
                 content_url, ai_feedback_json, score, submitted_at)
```

全テーブルに Row Level Security（`user_id = auth.uid()`）を適用する。

## 7. ウェブアプリ仕様（learn.goonresearch.jp）

- **スタック**: Next.js 14 App Router + Tailwind、Vercel デプロイ、PWA（ホーム画面追加可・ただしインストール不要で全機能動作）
- **再利用**: LinguaForge templates/base-app の既存コンポーネント（Flashcard SM-2 / Dictation / Shadowing / Cloze / KaraokeReader / SubstitutionDrill）を移植。**新規実装**: roleplay_ai UI、listening_choice、HVPT、Can-do 連動、進捗マップ
- **外部 API**: すべて Edge Function プロキシ経由（キーはサーバー側のみ）— OpenAI TTS / Whisper、Azure Pronunciation Assessment、Anthropic Claude（対話・採点）
- **アカウント**: 任意。未ログインでも全機能。SRS 復習残数が一定を超えた時点で「記録を守るための登録」を提案する動線
- **エクスポート**: ログインなしユーザー向けに学習データの JSON エクスポート/インポート（復元コード）を提供
- **アクセス**: セクション QR → `/u/{unit}/{section}`（§4 の往復設計参照）。DNS は goonresearch.jp に CNAME 1 本追加
- **セッション継続と再開**: 各活動の進捗はステップ単位で即時 IndexedDB に保存（autosave）。開いたままの画面ではアプリ内ナビゲーションで続行でき、閉じた後は同一 URL の再訪（QR 再スキャン）で保存状態から再開する。アプリのルート（`/`）を開いた場合は最後の学習位置への「続きから」ボタンを表示する。複数タブ同時利用は IndexedDB の last-write-wins で整合を取る

## 8. 法務ページ（goonresearch.jp 側・Astro サイトに追加）

`go-on-research` リポジトリに以下 2 ページを追加する（日本語必須、英語は既存多言語構成に準拠）。運営者表記は合同会社語音。

1. **プライバシーポリシー** `/privacy` — 必須記載事項:
   - 収集情報: メールアドレス、認証情報（Google OAuth の場合はプロバイダ提供情報）、学習記録（SRS 状態・進捗・自己評価・提出課題）、音声データ（発音評価・AI 対話時）
   - 利用目的: 学習記録の同期・提供、サービス改善
   - 外部処理委託先の明示: Supabase（DB/認証）、Vercel（ホスティング）、Microsoft Azure（発音評価）、Anthropic（AI 対話・採点）、OpenAI（音声認識・合成）— 音声・テキストがこれらに送信されることを明記
   - 保存期間、削除請求手続（アカウント削除で学習記録も削除）、Cookie/ローカルストレージの利用、問い合わせ先、準拠法
2. **利用規約** `/terms` — サービス範囲、禁止事項、免責、著作権（教材コンテンツは語音に帰属、学習者の提出物の扱い）、規約変更手続
3. アプリを有料販売または課金する場合は**特定商取引法に基づく表記**ページも追加する
4. アプリの登録画面・音声送信前の初回ダイアログから両ページへリンクし、同意チェックを取得する

## 9. 品質保証（ビルドゲート）

- `vocab_check.py`: 各ユニットの Input が「累積既習＋当該ユニットターゲット」で 98% 以上カバーされることを CI で検証。未習語はビルドエラー
- ストランド配分チェック: ユニットごとに 4 ストランドの活動時間見積りが 15–35% の範囲に収まること
- 例文スタイル: 自然さ優先（不自然に複雑な統語・機械的例文を禁止）。解説は です・ます調、一文 40 字目安、文法用語は学習者向け言い換えを併記
- pytest: export_app.py のスキーマ検証、SRS ロジック、同期のマージ規則、QR short_code の一意性検証
- E2E: ユニット 1 を用いた紙 PDF ビルド＋アプリ表示＋QR 遷移の通し確認

## 10. 開発フェーズ

1. **Phase 1 — プロトタイプ**: ユニット 1 を紙面 PDF＋アプリで通しビルドし、テンプレートとスキーマを確定
2. **Phase 2 — 基盤**: Supabase 認証・同期、roleplay_ai UI、法務 2 ページ、QR 動線（短縮ドメイン `goon.jp` のリダイレクト実装、`build/qr-map.json` を入力に使用）
3. **Phase 3 — 量産**: ユニット 2–20 のコンテンツ制作（vocab_check をゲートに）＋音声生成パイプライン
4. **Phase 4 — QA・公開**: HVPT・発音評価の実機検証、βテスト、印刷入稿データ作成

## 11. 実装状況（このリポジトリでの進捗）

- **全20ユニットのコンテンツ執筆が完了**（`unit01`〜`unit20`、それぞれ `unit.yaml` + セクション Markdown）。`content/vocabulary.csv` は644語（重複なし）、`vocab_check.py` は全ユニットで100%カバー率、can_do ID の重複なしを確認済み
- ビルドゲート（完了）: `vocab_check.py`（98%カバー率ゲート + can_do ID重複チェック、pytest 付き）、`export_app.py`（LinguaForge JSON、pytest 付き）
- KDP出版パイプライン（完了・実PDFコンパイル済み）: `content/book_meta.yaml`（書誌情報の単一ソース）、`content/front_matter/how-to-use.md`（このテキストの使い方）、`build_pdf.py --full-book`（前付け・目次・本文20ユニット・語彙索引・Can-doチェックリスト総覧を1つの `.typ` に統合、KDPトリムサイズ 7×10in・ミラーマージン・ページ番号ローマ数字→算用数字切替）— **typst 0.13.1 で実際にコンパイルし199ページのPDFを生成、目視確認済み**（コンパイル時に見つかった不具合3件は修正済み: Unit 5/10/15/20の見出し重複、Unit 14の`<u>`タグ、Can-doチェックリストの目次汚染）。`build_epub.py`（Kindle用EPUB3・全25章、QRの代わりにテキストリンク）、`build_cover.py`（電子版カバーPNG）、`build_paperback_cover.py`（紙版フルラップ表紙PDF、背表紙幅は199ページから算出した目安値）、`docs/kdp-metadata.md`（出版ガイド・チェックリスト）
- 未着手（外部リソースまたは発行者本人の判断が必要）:
  - `audio_gen.py` は TTS/MFA への実接続が必要なためインターフェースのみ実装（スタブ）
  - 本番用CJKフォント（`Noto Sans CJK JP`）での最終再コンパイル（このサンドボックスでは代替フォントIPAGothicに自動フォールバックして検証）
  - フルラップ表紙・電子版カバーのプロデザイン化、背表紙幅・のど余白のKDP公式値との照合
  - `app/`（Next.js PWA）、Supabase 接続、法務ページ、`goon.jp` 短縮ドメインのリダイレクト実装、KDPアカウントでの実際の出版操作は Phase 2 以降（KDP出版操作は発行者本人のみが実行可能）
- 次の一手: 本番フォントでの最終再コンパイル → 表紙デザイン確定 → KDP登録
