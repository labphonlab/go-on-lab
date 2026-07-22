# LinguaForge — 語学学習アプリ生成パイプライン（パイロット版）

既存の語学教材（テキスト＋音声）から、学習用Webアプリ（PWA）を自動生成する3層パイプライン。
設計の詳細・理論的根拠は [`/AGENTS.md`](../AGENTS.md) を参照。

現在の対応範囲:

- 入力: `.md` / `.txt` / `.html` / `.rtf` / `.docx` / `.pdf` / `.pptx` テキスト + wav音声
- content_type 5種類すべてに対応: `vocabulary_list`（フラッシュカード）/ `dialogue`
  （ディクテーション・シャドーイング）/ `grammar_note`（意味理解→穴埋め→並べ替えの
  3段階ドリル）/ `reading_passage`（音読フォロー＋理解度チェック）/ `pattern_drill`
  （モデル確認→産出練習→タイマー付き流暢性チェック）
- 出力: 上記6学習方法を実装したNext.js静的PWA。UIは長時間の学習でも疲れにくい配色・
  タイポグラフィと、フリップカードや進捗バー・ステージステッパーなどのマイクロ
  インタラクションで単調にならないよう設計
- 対象言語: 英語のみ（韓国語はフェーズ3）

## ディレクトリ構成

```
linguaforge/
  pipeline.py            CLI エントリポイント
  analysis/               第1層: 解析層（Python）
    extract.py             md/txt/html/rtf/docx/pdf/pptx → 統一テキスト抽出
    parser.py             入力ファイル → 節ごとのRawSection
    classify.py           Claude API による content_type 判定・項目抽出（+ オフラインfallback）
    align.py               MFA (english_mfa) による強制アラインメント（+ 未インストール時fallback）
    difficulty.py          日本語話者向け困難音素・連続音声過程のフラグ付け
    schema.py              第2層: 中間表現（Course/Section/Item）のスキーマ
    report.py              output/report.md 生成
    generator.py           第3層 glue: templates/base-app を output/app にコピーしデータを注入
  data_tables/
    l1_interference_en_ja.json   difficulty.py が参照する困難音素対テーブル（フェーズ3でKO版に差し替え）
  templates/base-app/      第3層: 生成層（Next.js 14 App Router + Tailwind, 固定テンプレート）
  samples/input/           E2Eテスト用の短い教材（テキスト+合成音声+config.yaml、md/html混在）
  tests/                   pytest単体テスト（schema/difficulty/extract/parser/classify/report + パイプラインE2E）
```

## 使い方

```bash
cd linguaforge
pip install -r requirements.txt

# 本番: Claude APIで解析（要 ANTHROPIC_API_KEY）
export ANTHROPIC_API_KEY=sk-...
python pipeline.py --input ./input --output ./output --lang en

# オフライン/CI用: ヒューリスティックfallbackで解析（APIキー不要）
python pipeline.py --input samples/input --output ./output --mock
```

`input/` の構成（教師から受領した教材を配置）:

```
input/
  text/01_intro.md, 02_vocab.pdf, 03_dialogue.docx, ...   # ファイル名の先頭数字がセクションIDになる
  audio/01_intro.wav, 02_vocab.wav, 03_dialogue.wav       # テキストと同じstemで対応付け
  config.yaml                                             # title, level, lang など
```

形式はセクションごとに混在してよい（`extract.py` が拡張子で自動判別する）。旧形式の `.doc`
（バイナリ形式）は非対応 — `.docx` に変換してから配置すること。PDFはテキストレイヤーからの
抽出のみで見出し構造は復元されない（スキャン画像PDFはOCR未対応、フェーズ2で検討）。

出力:

```
output/
  app/       生成されたNext.js静的アプリ（npm install && npm run build で out/ に書き出し）
  data/      中間表現JSON一式（再生成・デバッグ用に保存）
  report.md  解析結果・学習方法選択の根拠・アラインメント警告の一覧（納品前チェック用）
```

## 自動テスト

```bash
cd linguaforge
pip install -r requirements-dev.txt
pytest
```

`analysis/` の各モジュール（schema/difficulty/extract/parser/classify/report）の単体テストに加え、
`tests/test_pipeline_e2e.py` が `samples/input` に対する `--mock` 実行を丸ごと検証する
（6セクション・5 content_typeすべての生成・report.md/data/course.json の存在・生成アプリに
実際にバンドルされる `app/data/course.json` の中身・音声ファイルのコピーまで）。Next.js側の
型チェック・lintは下記のE2Eフローで確認する。

## E2Eテスト（samples/ → 実際にビルド）

```bash
cd linguaforge
python pipeline.py --input samples/input --output /tmp/lf_test --mock
cd /tmp/lf_test/app && npm install && npm run build && npm run lint
```

`samples/input/audio/*.wav` は実音声ではなく合成トーンのプレースホルダーのため、MFAを実行しても
（あるいはMFA未インストール環境でのfallbackでも）アラインメントは低信頼度になる。これは仕様通りの
動作で、`output/report.md` の「アラインメント警告」セクションに列挙され、人手確認の対象として扱われる。
実教材では `input/audio/` に実際の教師音声を置くこと。

## PWA / オフライン対応

生成アプリには `manifest.json`・アイコン一式（`public/icons/`）・オフラインキャッシュ用の
`sw.js`（stale-while-revalidate、初回訪問後はオフラインでも動作）が同梱済みで、スマホの
ホーム画面に追加してアプリのように使える。アイコンは合同会社語音の汎用モノグラム（"LF"）の
プレースホルダーなので、納品前に `templates/base-app/public/icons/` を差し替えれば教材・
クライアントごとのブランドアイコンにできる。

## まだ実装していないもの（次フェーズ以降）

- L1加重ND/FLベースの出題優先度スコア（`difficulty.py` は現在テーブル駆動の単純フラグ付けのみ、
  NGSLベースの語彙指標テーブルは未導入）
- Azure発音評価（`PronunciationCheck.tsx`）、韓国語対応、スキャン画像PDFのOCR
- オフラインヒューリスティック分類器（`--mock`）はタイトルのキーワードや文の形状で
  content_type を推測する簡易ロジック。本番は必ず `ANTHROPIC_API_KEY` を設定した
  `ClaudeClassifier` 経由で解析すること
