# a2b1-textbook

CEFR A2→B1 総合英語テキスト（独習用・紙＋アプリ、KDP出版）。プロジェクト仕様は [`CLAUDE.md`](./CLAUDE.md) を参照してください。

## 現在の状態

Unit 1「Making Plans with Friends」を通しで実装し、コンテンツスキーマとビルドゲートを確定しました。
KDP（紙版・電子版）向けの出版パイプラインも一式実装済みです。Unit 2〜20 の本文は執筆を継続中です
（進捗は下表参照）。

| コンポーネント | 状態 |
|---|---|
| `content/syllabus.yaml`（20ユニット概要） | ✅ 実装済み |
| `content/vocabulary.csv` + `content/baseline_vocabulary.txt` | ✅ Unit 1 分を実装済み（Unit 2〜20 分は執筆中） |
| `content/units/unit01/`（unit.yaml + 8 セクション） | ✅ 実装済み |
| Unit 2–20 コンテンツ | 🚧 執筆中（`vocab_check.py` をゲートに、cumulative coverage を維持しながら執筆） |
| `scripts/vocab_check.py`（98%カバー率ゲート） | ✅ 動作確認済み・pytest あり |
| `scripts/export_app.py`（→ LinguaForge JSON） | ✅ 動作確認済み・pytest あり |
| `scripts/audio_gen.py`（TTS → MFA） | ⚠️ インターフェースのみ。TTS API キー・MFA が必要 |
| `scripts/build_pdf.py`（→ Typst PDF、`--unit` / `--full-book`） | ⚠️ 生成は実装・検証済み。PDF コンパイルには `typst` CLI が必要（未検証） |
| `scripts/build_epub.py`（→ Kindle EPUB） | ✅ 実装・検証済み（zip構造・XHTML整形式まで確認） |
| `scripts/build_cover.py`（→ 電子版カバー PNG） | ✅ 実装済み（プレースホルダーデザイン） |
| `docs/kdp-metadata.md`（KDP出版ガイド） | ✅ 作成済み |
| セクション QR 動線（`content/app_config.yaml` + `build/qr-map.json`） | ✅ 動作確認済み・pytest あり（`goon.jp` 側リダイレクト実装は Phase 2） |
| `app/`（Next.js PWA） | ❌ 未着手（Phase 2） |
| Supabase 認証・同期 | ❌ 未着手（Phase 2） |
| 法務ページ（`go-on-research` リポジトリ側） | ❌ 未着手（Phase 2） |

## KDP出版について

紙版・電子版の原稿生成から出版までの手順は **[`docs/kdp-metadata.md`](./docs/kdp-metadata.md)**
にまとめています。書誌情報（タイトル・著者・トリムサイズ等）は `content/book_meta.yaml` が
単一ソースです。

要点：
- 原稿ファイル（印刷用 `.typ`／`.epub`／カバー PNG）の生成はこのリポジトリのスクリプトで完結します
- KDP アカウントでのアップロード・銀行口座/税務情報の登録・実際の「出版」操作は、発行者本人が
  KDP 管理画面（kdp.amazon.com）で行う必要があります（このリポジトリのスクリプトは代行できません）
- ペーパーバックのフルラップ表紙（背表紙込み）は最終ページ数が必要なため未生成です。全ユニット
  執筆完了後にデザインしてください

## クイックスタート

```bash
cd a2b1-textbook
pip install -r scripts/requirements.txt

# 1. 語彙カバー率ゲートを実行（全ユニット共通・CI で必須）
python3 scripts/vocab_check.py

# 2. アプリ用 JSON を書き出す（全ユニット分）
python3 scripts/export_app.py --all

# 3. 紙版原稿を生成
python3 scripts/build_pdf.py --unit 1 --typ-only        # 単一ユニットのみ
python3 scripts/build_pdf.py --full-book --typ-only      # 前付け・後付け込みの全書籍
#   → typst インストール後は --typ-only を外すとPDFまで生成

# 4. Kindle 用 EPUB を生成
python3 scripts/build_epub.py

# 5. 電子版カバー画像を生成
python3 scripts/build_cover.py

# 6. 音声生成ジョブのプラン確認（実際の TTS 呼び出しはしない）
python3 scripts/audio_gen.py --unit 1 --dry-run

# テスト
python3 -m pytest scripts/tests/ -v
```

## 語彙データについて（重要な注意）

`content/vocabulary.csv` の `ngsl_rank` / `nd` / `fl` / `l1_weighted_nd` は、このプロトタイプでは
**実測データではなく置き換え前提の仮の推定値**です。実データと突き合わせて確定する前提の
プレースホルダーです（NGSL・CLEARPOND・Ehara の語彙親密度データベース等）。`hvpt` 列（L/R, TH/S など
日本語話者が知覚しにくい音素対を含む語のフラグ）も同様に仮の判定です。

Units 2〜20 は各ユニットを独立したエージェントに執筆させているため（`vocab_check.py` の
カバー率ゲートは各ユニットが「既習語彙＋自ユニットの新出語」だけで98%以上を満たせば通過する
設計）、ユニット間で同じ単語が重複してターゲット語に選ばれることがあります（例: "weekend" が
Unit 1 と Unit 2 の両方の新出語になっている）。ビルドは通りますが、巻末の語彙索引に同じ語が
複数回出てしまう点は既知の課題です。全ユニット執筆完了後、重複語を洗い出して片方を別の語に
差し替えるクリーンアップを行ってください。

`content/baseline_vocabulary.txt` は「Unit 1 開始時点で学習者が既に知っている」という前提の
語彙リスト（プロトタイプ用に手作業で選定）です。実際の教材採用時は、想定する入口レベル
（英検準2級・中学卒業程度など）に応じて精査してください。

## QR 動線（紙⇄アプリ）について

`scripts/build_pdf.py` は `app_components` を持つセクションごとに、`content/app_config.yaml` の
`deep_link_base`（`https://learn.goonresearch.jp`）を使ってディープリンク QR（SVG）を自動生成し、
`goon.jp/u{unit}s{n}` 形式の短縮 URL を併記します（`--full-book` でも同様）。生成した対応表は
`build/qr-map.json`（`short_code → deep_link`）に蓄積され、これが Phase 2 で実装する `goon.jp`
側リダイレクトの入力になります。QR を紙面に手貼りすることはなく、必ずこのスクリプト経由で
生成されるため、印刷される URL とアプリのルーティングが常に一致することをビルド時に保証します。
電子版（EPUB）では QR の代わりにテキストリンクとして同じディープリンクを埋め込みます。

セッションの継続・再開（開いたままならアプリ内ナビゲーション、閉じたら QR 再スキャンで
IndexedDB の保存状態から復元）は Next.js アプリ側の実装（Phase 2）に依存します。

## 次にやること

1. Unit 2〜20 の本文執筆（進行中）
2. `scripts/build_pdf.py` の PDF 品質確認（`typst` をインストールして実際にコンパイル）
3. ペーパーバックのフルラップ表紙デザイン（全ユニット執筆完了後、最終ページ数確定後）
4. `scripts/audio_gen.py` の TTS/MFA 接続（API キー・MFA モデルのセットアップ）
5. Next.js アプリ（`learn.goonresearch.jp`）と Supabase 連携の実装（Phase 2）
6. `goon.jp` 短縮ドメインのリダイレクト実装（`build/qr-map.json` を入力に）（Phase 2）
