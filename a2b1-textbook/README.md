# a2b1-textbook

CEFR A2→B1 総合英語テキスト（独習用・紙＋アプリ、KDP出版）。プロジェクト仕様は [`CLAUDE.md`](./CLAUDE.md) を参照してください。

## 現在の状態

**全20ユニットの本文執筆が完了し、印刷用PDF（199ページ）も実際にコンパイル・目視確認済みです。**
語彙の重複も解消済み。残るのは、表紙のプロデザイン化・音声生成・KDPアカウントでの実際の出版操作など、
専門作業/発行者本人の判断が必要な工程です（下表参照）。

| コンポーネント | 状態 |
|---|---|
| `content/syllabus.yaml`（20ユニット概要） | ✅ 実装済み |
| `content/vocabulary.csv`（644語・重複なし） + `content/baseline_vocabulary.txt` | ✅ 全20ユニット分実装済み |
| `content/units/unit01/` 〜 `unit20/` | ✅ **全20ユニット実装済み**（unit.yaml + 8セクション、Unit 5/10/15/20 は復習ユニット） |
| `scripts/vocab_check.py`（98%カバー率ゲート + can_do ID重複チェック） | ✅ 全20ユニットで100%カバー率、動作確認済み・pytest あり |
| `scripts/export_app.py`（→ LinguaForge JSON） | ✅ 全20ユニットで動作確認済み・pytest あり |
| `scripts/audio_gen.py`（TTS → MFA） | ⚠️ インターフェースのみ。TTS API キー・MFA が必要 |
| `scripts/build_pdf.py`（→ Typst PDF、`--unit` / `--full-book`） | ✅ **実際にコンパイル済み**（typst 0.13.1、199ページ、目次・QR・表組み・語彙索引すべて正常表示） |
| `scripts/build_epub.py`（→ Kindle EPUB） | ✅ 実装・検証済み（全20ユニット・25章、zip構造・XHTML整形式まで確認） |
| `scripts/build_cover.py`（→ 電子版カバー PNG） | ✅ 実装済み（プレースホルダーデザイン） |
| `scripts/build_paperback_cover.py`（→ 紙版フルラップ表紙 PDF） | ✅ 実装・コンパイル確認済み（背表紙幅は目安値、KDP計算ツールでの確認が必要） |
| `docs/kdp-metadata.md`（KDP出版ガイド） | ✅ 作成済み |
| セクション QR 動線（`content/app_config.yaml` + `build/qr-map.json`） | ✅ 全20ユニット・100個のQRで動作確認済み・pytest あり（`goon.jp` 側リダイレクト実装は Phase 2） |
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
- ペーパーバックのフルラップ表紙（背表紙込み）はまだ未生成です。`typst` で実際に PDF をコンパイルして
  最終ページ数を確定してから、`docs/kdp-metadata.md` の手順でデザインしてください

## クイックスタート

```bash
cd a2b1-textbook
pip install -r scripts/requirements.txt

# 1. 語彙カバー率ゲートを実行（全20ユニット、CI で必須）
python3 scripts/vocab_check.py

# 2. アプリ用 JSON を書き出す（全ユニット分）
python3 scripts/export_app.py --all

# 3. 紙版原稿を生成（typst がインストール済みなら実際にPDFまで生成）
python3 scripts/build_pdf.py --unit 1        # 単一ユニットのみ
python3 scripts/build_pdf.py --full-book     # 前付け・後付け込みの全20ユニット（199ページ）
#   → typst 未インストールの場合は --typ-only を付けて .typ 生成のみ行う

# 4. Kindle 用 EPUB を生成（全20ユニット・25章）
python3 scripts/build_epub.py

# 5. 表紙を生成
python3 scripts/build_cover.py                              # 電子版カバー PNG
python3 scripts/build_paperback_cover.py --pages 199         # 紙版フルラップ表紙 PDF（要 typst）

# 6. 音声生成ジョブのプラン確認（実際の TTS 呼び出しはしない）
python3 scripts/audio_gen.py --unit 1 --dry-run

# テスト
python3 -m pytest scripts/tests/ -v
```

## ユニット構成

| Unit | タイトル | CEFR-J | 文法フォーカス |
|---|---|---|---|
| 1 | Making Plans with Friends | A2.2 | be going to vs will、shall we / why don't we |
| 2 | Talking About Your Week | A2.2 | 過去形（規則・不規則）、時系列表現 |
| 3 | Have You Ever...? | A2.2 | 現在完了（経験） |
| 4 | Comparing Things | A2.2 | 比較級・最上級・as...as |
| 5 | Consolidation 1 | A2.2 | Units 1–4 総復習 |
| 6 | Asking for Directions | A2.2 | 命令文、場所の前置詞、Could you / Would you |
| 7 | Ordering Food and Making Requests | A2.2 | would like、Could I have...?、丁寧な依頼 |
| 8 | Describing People and Things | B1.1 | 関係代名詞 who / which / that |
| 9 | What's Wrong? Health and Advice | A2.2 | should/shouldn't、have to/don't have to |
| 10 | Consolidation 2 | A2.2/B1.1 | Units 6–9 総復習 |
| 11 | Talking About the Past in Detail | B1.1 | 過去進行形 vs 過去形、while/when |
| 12 | If I Have Time... | B1.1 | 第1条件文 |
| 13 | Asking Indirectly | B1.1 | 間接疑問 |
| 14 | Passive Voice in Everyday Life | B1.1 | 受動態（現在形・過去形） |
| 15 | Consolidation 3 | B1.1 | Units 11–14 総復習 |
| 16 | Hopes and Plans | B1.1 | 不定詞 vs 動名詞をとる動詞 |
| 17 | Giving Opinions and Agreeing/Disagreeing | B1.1 | I think / I agree / So do I |
| 18 | Telling a Story | B1.1 | 物語のテンス、伝聞（軽い導入） |
| 19 | Travel and Problems | B1.1 | 第2条件文（軽い導入）、should have |
| 20 | Looking Back, Looking Forward | B1.1 | Units 16–19 総復習＋学習計画ガイド |

## 語彙データについて（重要な注意）

`content/vocabulary.csv` の `ngsl_rank` / `nd` / `fl` / `l1_weighted_nd` は、このプロトタイプでは
**実測データではなく置き換え前提の仮の推定値**です。実データと突き合わせて確定する前提の
プレースホルダーです（NGSL・CLEARPOND・Ehara の語彙親密度データベース等）。`hvpt` 列（L/R, TH/S など
日本語話者が知覚しにくい音素対を含む語のフラグ）も同様に仮の判定です。

各ユニットは独立したエージェントに執筆させたため（`vocab_check.py` のカバー率ゲートは各ユニットが
「既習語彙＋自ユニットの新出語」だけで98%以上を満たせば通過する設計）、当初はユニット間で同じ単語が
重複してターゲット語に選ばれていました（759語中93語）。**この重複は解消済みです**：各語を最初に
登場するユニットのみのターゲットとして残し、後続ユニットの `vocabulary_targets`/`vocabulary.csv`
からは削除しました（対話本文の変更は不要 — `vocab_check.py` の累積カバー率モデル上、後続ユニットに
とってその語はすでに「既習語彙」になっているため）。現在 644語、重複ゼロです。

`content/baseline_vocabulary.txt` は「Unit 1 開始時点で学習者が既に知っている」という前提の
語彙リスト（プロトタイプ用に手作業で選定、全ユニット執筆を通して段階的に拡充）です。実際の教材
採用時は、想定する入口レベル（英検準2級・中学卒業程度など）に応じて精査してください。

## QR 動線（紙⇄アプリ）について

`scripts/build_pdf.py` は `app_components` を持つセクションごとに、`content/app_config.yaml` の
`deep_link_base`（`https://learn.goonresearch.jp`）を使ってディープリンク QR（SVG）を自動生成し、
`goon.jp/u{unit}s{n}` 形式の短縮 URL を併記します（`--full-book` でも同様。全20ユニットで100個の
QRを生成）。生成した対応表は `build/qr-map.json`（`short_code → deep_link`）に蓄積され、これが
Phase 2 で実装する `goon.jp` 側リダイレクトの入力になります。QR を紙面に手貼りすることはなく、
必ずこのスクリプト経由で生成されるため、印刷される URL とアプリのルーティングが常に一致することを
ビルド時に保証します。電子版（EPUB）では QR の代わりにテキストリンクとして同じディープリンクを
埋め込みます。

セッションの継続・再開（開いたままならアプリ内ナビゲーション、閉じたら QR 再スキャンで
IndexedDB の保存状態から復元）は Next.js アプリ側の実装（Phase 2）に依存します。

## 次にやること

1. 本番用の日本語フォント（`Noto Sans CJK JP` 等）をインストールした環境での最終PDF再コンパイル
2. のど余白・フルラップ表紙の背表紙幅（現在は目安値）を KDP 公式ツールで確認・調整
3. 表紙（電子版・紙版とも）をプロのデザインに差し替え
4. `scripts/audio_gen.py` の TTS/MFA 接続（API キー・MFA モデルのセットアップ、全20ユニット分の音声生成）
5. KDPアカウント登録・原稿アップロード・出版（`docs/kdp-metadata.md` のチェックリスト参照、発行者本人の作業）
6. Next.js アプリ（`learn.goonresearch.jp`）と Supabase 連携の実装（Phase 2）
7. `goon.jp` 短縮ドメインのリダイレクト実装（`build/qr-map.json` を入力に）（Phase 2）
