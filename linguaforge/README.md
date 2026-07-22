# LinguaForge — 語学学習アプリ生成パイプライン（フェーズ1 MVP）

既存の語学教材（テキスト＋音声）から、学習用Webアプリ（PWA）を自動生成する3層パイプライン。
設計の詳細・理論的根拠は [`/AGENTS.md`](../AGENTS.md) を参照。

フェーズ1（このMVP）の対応範囲:

- 入力: Markdownテキスト + wav音声、`vocabulary_list` / `dialogue` の2種別
- 出力: フラッシュカード（SRS/SM-2）、ディクテーション、シャドーイングを実装したNext.js静的PWA
- 対象言語: 英語のみ（韓国語はフェーズ3）

## ディレクトリ構成

```
linguaforge/
  pipeline.py            CLI エントリポイント
  analysis/               第1層: 解析層（Python）
    parser.py             Markdown入力 → 節ごとのRawSection
    classify.py           Claude API による content_type 判定・項目抽出（+ オフラインfallback）
    align.py               MFA (english_mfa) による強制アラインメント（+ 未インストール時fallback）
    difficulty.py          日本語話者向け困難音素・連続音声過程のフラグ付け
    schema.py              第2層: 中間表現（Course/Section/Item）のスキーマ
    report.py              output/report.md 生成
    generator.py           第3層 glue: templates/base-app を output/app にコピーしデータを注入
  data_tables/
    l1_interference_en_ja.json   difficulty.py が参照する困難音素対テーブル（フェーズ3でKO版に差し替え）
  templates/base-app/      第3層: 生成層（Next.js 14 App Router + Tailwind, 固定テンプレート）
  samples/input/           E2Eテスト用の短い教材（テキスト+合成音声+config.yaml）
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
  text/01_intro.md, 02_vocab.md, ...   # ファイル名の先頭数字がセクションIDになる
  audio/01_intro.wav, 02_vocab.wav     # テキストと同じstemで対応付け
  config.yaml                          # title, level, lang など
```

出力:

```
output/
  app/       生成されたNext.js静的アプリ（npm install && npm run build で out/ に書き出し）
  data/      中間表現JSON一式（再生成・デバッグ用に保存）
  report.md  解析結果・学習方法選択の根拠・アラインメント警告の一覧（納品前チェック用）
```

## E2Eテスト（samples/）

```bash
cd linguaforge
python pipeline.py --input samples/input --output /tmp/lf_test --mock
cd /tmp/lf_test/app && npm install && npm run build
```

`samples/input/audio/*.wav` は実音声ではなく合成トーンのプレースホルダーのため、MFAを実行しても
（あるいはMFA未インストール環境でのfallbackでも）アラインメントは低信頼度になる。これは仕様通りの
動作で、`output/report.md` の「アラインメント警告」セクションに列挙され、人手確認の対象として扱われる。
実教材では `input/audio/` に実際の教師音声を置くこと。

## フェーズ1で未実装のもの（次フェーズ以降）

- `grammar_note` / `reading_passage` / `pattern_drill` の学習方法コンポーネント（content_typeの判定・
  report.mdへの記載までは実施、UIコンポーネント未実装）
- L1加重ND/FLベースの出題優先度スコア（`difficulty.py` は現在テーブル駆動の単純フラグ付けのみ）
- Azure発音評価、docx入力、韓国語対応
