# a2b1-textbook

CEFR A2→B1 総合英語テキスト（独習用・紙＋アプリ）。プロジェクト仕様は [`CLAUDE.md`](./CLAUDE.md) を参照してください。

## 現在の状態（Phase 1 プロトタイプ）

Unit 1「Making Plans with Friends」を通しで実装し、コンテンツスキーマとビルドゲートを確定しました。

| コンポーネント | 状態 |
|---|---|
| `content/syllabus.yaml`（20ユニット概要） | ✅ 実装済み |
| `content/vocabulary.csv` + `content/baseline_vocabulary.txt` | ✅ Unit 1 分を実装済み |
| `content/units/unit01/`（unit.yaml + 8 セクション） | ✅ 実装済み |
| `scripts/vocab_check.py`（98%カバー率ゲート） | ✅ 動作確認済み・pytest あり |
| `scripts/export_app.py`（→ LinguaForge JSON） | ✅ 動作確認済み・pytest あり |
| `scripts/audio_gen.py`（TTS → MFA） | ⚠️ インターフェースのみ。TTS API キー・MFA が必要 |
| `scripts/build_pdf.py`（→ Typst PDF） | ⚠️ Markdown→Typst 変換は実装済み・PDF コンパイルには `typst` CLI が必要 |
| `app/`（Next.js PWA） | ❌ 未着手（Phase 2） |
| Supabase 認証・同期 | ❌ 未着手（Phase 2） |
| 法務ページ（`go-on-research` リポジトリ側） | ❌ 未着手（Phase 2） |
| Unit 2–20 コンテンツ | ❌ 未着手（Phase 3。`syllabus.yaml` にトピック・文法の骨格のみ配置） |

## クイックスタート

```bash
cd a2b1-textbook
pip install -r scripts/requirements.txt

# 1. 語彙カバー率ゲートを実行（全ユニット共通・CI で必須）
python3 scripts/vocab_check.py

# 2. アプリ用 JSON を書き出す
python3 scripts/export_app.py --unit 1
cat build/app-export/unit-01.json

# 3. Typst ソースを生成（PDF コンパイルには typst CLI が別途必要）
python3 scripts/build_pdf.py --unit 1 --typ-only
cat build/pdf/unit01.typ

# 4. 音声生成ジョブのプラン確認（実際の TTS 呼び出しはしない）
python3 scripts/audio_gen.py --unit 1 --dry-run

# テスト
python3 -m pytest scripts/tests/ -v
```

## 語彙データについて（重要な注意）

`content/vocabulary.csv` の `ngsl_rank` / `nd` / `fl` / `l1_weighted_nd` は、このプロトタイプでは
**実測データではなく置き換え前提の仮の推定値**です。Phase 3 で NGSL・CLEARPOND・Ehara の
語彙親密度データベース等の実データと突き合わせて確定してください。`hvpt` 列（L/R, TH/S など
日本語話者が知覚しにくい音素対を含む語のフラグ）も同様に仮の判定です。

`content/baseline_vocabulary.txt` は「Unit 1 開始時点で学習者が既に知っている」という前提の
語彙リスト（プロトタイプ用に手作業で選定）です。実際の教材採用時は、想定する入口レベル
（英検準2級・中学卒業程度など）に応じて精査してください。

## 次にやること

1. `scripts/build_pdf.py` の PDF 品質確認（`typst` をインストールして実際にコンパイル）
2. `scripts/audio_gen.py` の TTS/MFA 接続（API キー・MFA モデルのセットアップ）
3. Unit 2 以降のコンテンツ制作（`vocab_check.py` をゲートに、`syllabus.yaml` の骨格から拡張）
4. Next.js アプリ（`learn.goonresearch.jp`）と Supabase 連携の実装（Phase 2）
