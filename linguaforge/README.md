# LinguaForge — 語学学習アプリ生成パイプライン（パイロット版）

既存の語学教材（テキスト＋音声）から、学習用Webアプリ（PWA）を自動生成する3層パイプライン。
設計の詳細・理論的根拠・実装状況は [`AGENTS.md`](AGENTS.md) を参照
（リポジトリ直下の `/AGENTS.md` はこのサブプロジェクトとは無関係な、別のNext.jsアプリ向けの注意書き）。

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
    priority.py             L1加重ND・FL指標による出題優先度スコア・並び替え
    neighborhood.py          CMUdictベースの音韻近接度(ND)・L1加重ND計算
    schema.py              第2層: 中間表現（Course/Section/Item）のスキーマ
    report.py              output/report.md 生成
    generator.py           第3層 glue: templates/base-app を output/app にコピーしデータを注入
  data_tables/
    l1_interference_en_ja.json   difficulty.py/neighborhood.py が参照するL1干渉音素対テーブル
                                  （IPA用とneighborhood.py用ARPAbet併合ペアの両方を保持。フェーズ3でKO版に差し替え）
    frequency_bands_en.json      priority.py が参照する簡易頻度帯テーブル（NGSL本体に差し替え可能）
    priority_weights.json        priority.pyの合成スコアの重み（nd_weight/nd_half_saturation/flag_weight）
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

`analysis/` の各モジュール（schema/difficulty/priority/extract/parser/classify/report）の単体テストに加え、
`tests/test_pipeline_e2e.py` が `samples/input` に対する `--mock` 実行を丸ごと検証する
（6セクション・5 content_typeすべての生成・report.md/data/course.json の存在・生成アプリに
実際にバンドルされる `app/data/course.json` の中身・音声ファイルのコピーまで）。Next.js側の
型チェック・lintは下記のE2Eフローで確認する。

### ClaudeClassifierのライブAPIテスト

`tests/test_classify_live.py` は `--mock` が使うHeuristicClassifierではなく、本番用の
`ClaudeClassifier` を実際のClaude APIで検証する唯一のテスト。`ANTHROPIC_API_KEY` が
環境変数に無ければ自動的にskipされるため、CI（キーなし）は今まで通り通る。

```bash
# 通常のpytestではskipされる（CIと同じ挙動）
pytest

# 実APIで検証（要 ANTHROPIC_API_KEY）
ANTHROPIC_API_KEY=sk-... pytest -m live

# 一致率・根拠文の所見を docs/live-test-report.md にも出力
ANTHROPIC_API_KEY=sk-... LINGUAFORGE_LIVE_REPORT=1 pytest -m live -s
```

検証内容: (a) content_typeがスキーマ5種別のいずれか、(b) samples/の各セクションで
HeuristicClassifierとの一致率をログ出力、(c) 各セクションの習得目標推定・学習方法選択の
根拠文が空でなく、CLAUDE.mdのSLA原則表にある理論名を最低1つ引用していること。

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

## 出題優先度スコア（L1加重ND・FL指標）

`analysis/priority.py` が各項目に `priority_score` を付与し、`vocabulary_list` /
`grammar_note`（項目同士に会話・文章としての順序依存がなく、並べ替えても安全な種別）は
このスコア昇順に自動配列する。`dialogue` / `reading_passage` / `pattern_drill` は
スコアだけ記録し、会話・文章としての意味を壊さないよう元の順序を保持する。

```
priority = freq_band(FL) - nd_weight × (L1加重ND / (L1加重ND + nd_half_saturation))
                          - flag_weight × len(difficulty_flags)
```

重みは `data_tables/priority_weights.json` で調整可能。

- **FL（頻度レベル）**: `data_tables/frequency_bands_en.json` の5段階簡易頻度帯テーブル。
  ライセンスされたNGSLデータセットそのものではない（手作業で作成した代替）。実データに
  差し替える場合はこのJSONファイルを置き換えるだけでよい設計
- **ND / L1加重ND（音韻近接度）**: `analysis/neighborhood.py` がCMUdict（発音辞書）を使って
  実計算する。通常NDは編集距離1（置換・挿入・削除）の隣接語数（Vitevitch & Luce型）。
  L1加重NDは `data_tables/l1_interference_en_ja.json` の `arpabet_merge_pairs`
  （L/R, B/V, S/TH, Z/DH, IH/IY, F/HH）を同一音素とみなして再計算した近接度で、
  記号の併合は距離を縮めることはあっても広げないため「L1加重ND ≥ 通常ND」は構造的に保証される
  （`tests/test_neighborhood.py` で不変条件として検証）。単語項目（1トークンの項目）のみに
  付与され、CMUdict未収載語は `report.md` に一覧化される
- **NDの母集団**: 現状はCMUdict全体（約12.6万語）。AGENTS.mdが想定するNGSL語彙表への
  絞り込みは、NGSL 1.2データの入手がこの開発環境のネットワークポリシーでブロックされている
  ため未実施（下記参照）

## まだ実装していないもの（次フェーズ以降）

- Azure発音評価（`PronunciationCheck.tsx`）、韓国語対応、スキャン画像PDFのOCR
- **NGSL 1.2本家データセットへの差し替え**: `newgeneralservicelist.org` はこの開発環境の
  ネットワークポリシーで到達不可（プロキシが403で拒否）。PyPIの`ngsl`パッケージも試したが、
  ライセンス表記が無く（`License: UNKNOWN`）、収録語に`pause`/`unclear`のような書き起こし
  由来の語が混じっており本家NGSLと同一のデータか検証できないため、Browne, Culligan, Phillipsの
  著作物として帰属表示するのは不正確になり採用を見送った。実データファイルを直接提供いただくか、
  ネットワークポリシーで当該ドメインへのアクセスを許可いただければ差し替え可能
- オフラインヒューリスティック分類器（`--mock`）はタイトルのキーワードや文の形状で
  content_type を推測する簡易ロジック。本番は必ず `ANTHROPIC_API_KEY` を設定した
  `ClaudeClassifier` 経由で解析すること
