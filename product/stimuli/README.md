# 刺激音セット 出荷ワークフロー（販売者向け）

> このディレクトリは、刺激音セットを「商品」として準備するための作業フォルダ・テンプレ・出荷チェックリストの保管場所です。

## 全体フロー

```
1. 著作権クリアランス  →  COPYRIGHT_CHECKLIST.md でゲート
2. 音響パラメータ生成  →  Praat / Python
3. WAV 3 形式出力      →  44.1 / 22.05 / 16 kHz
4. 音響パラメータ表    →  CSV 出力
5. Technical Note 執筆 →  TECHNICAL_NOTE_TEMPLATE.md ベース
6. Perception Lab JSON →  即時インポート可能な設定
7. ZIP パッケージング   →  販売用配信ファイル
8. 出荷チェックリスト   →  最終確認
```

## 標準パッケージ構成

各セットは以下の構造で出荷します:

```
[set_id]_v[version].zip
├── README.txt                          ← 購入者向け 1 枚目（概要）
├── TECHNICAL_NOTE.pdf                  ← 詳細仕様・引用情報
├── LICENSE.txt                         ← 利用許諾（共通ライセンスのコピー）
├── wav/
│   ├── 44k1/
│   │   ├── [set_id]_step01.wav
│   │   ├── [set_id]_step02.wav
│   │   └── ...
│   ├── 22k05/
│   └── 16k/
├── acoustic_parameters.csv             ← 各刺激の音響値
└── perception_lab_config.json          ← 即時インポート用
```

### 例: 日本語 /k/-/g/ VOT 連続体

```
jpn_kg_vot_v1.zip
├── README.txt
├── TECHNICAL_NOTE.pdf
├── LICENSE.txt
├── wav/
│   ├── 44k1/jpn_kg_vot_step01.wav  (VOT = -40 ms)
│   ├── 44k1/jpn_kg_vot_step02.wav  (VOT = -30 ms)
│   ├── ...
│   └── 44k1/jpn_kg_vot_step11.wav  (VOT = +60 ms)
├── acoustic_parameters.csv
└── perception_lab_config.json
```

## 命名規則

- セット ID: `[lang]_[contrast]_[dimension]`
  - `jpn_kg_vot`, `eng_rl_f3onset`, `jpn_ie_f1f2`
- ステップ番号: `_step01`, `_step02`, ...（2 桁ゼロ詰め）
- バージョン: `_v1`, `_v2`（破壊的変更時のみ繰り上げ）

## acoustic_parameters.csv のスキーマ

```csv
step,filename,vot_ms,f0_hz,f1_hz,f2_hz,duration_ms,intensity_db
1,jpn_kg_vot_step01.wav,-40,120,500,1500,250,70
2,jpn_kg_vot_step02.wav,-30,120,500,1500,250,70
...
```

連続体次元に応じて列を変更してください。

## perception_lab_config.json のスキーマ

```json
{
  "version": 1,
  "paradigm": "identification",
  "stimuliBaseUrl": "./wav/44k1/",
  "stimuli": [
    { "id": "step01", "filename": "jpn_kg_vot_step01.wav", "continuumStep": 1 },
    { "id": "step02", "filename": "jpn_kg_vot_step02.wav", "continuumStep": 2 }
  ],
  "responseLabels": ["か", "が"],
  "instructions": "聞こえた音が「か」か「が」かを選んでください",
  "trialsPerStimulus": 5,
  "practiceTrials": 6,
  "breakEvery": 22
}
```

実際のスキーマは `identification-task-app/` の最新設定パネルが書き出すフォーマットに合わせて随時更新。

## 出荷前 最終チェックリスト

各セットの出荷前に:

- [ ] `COPYRIGHT_CHECKLIST.md` 全項目クリア
- [ ] WAV 3 形式すべて再生確認（クリッピング・無音・ステップ抜けなし）
- [ ] `acoustic_parameters.csv` の数値が WAV と一致
- [ ] `perception_lab_config.json` が設定パネルでエラーなく読み込める
- [ ] `TECHNICAL_NOTE.pdf` に引用情報・参考文献あり
- [ ] `LICENSE.txt` が `/product/LICENSE.md` の B 章のコピー
- [ ] `README.txt` に Quickstart（5 行以内）あり
- [ ] ZIP ファイルの解凍テスト（Win / Mac 両方）

## 配信方法（推奨）

- **BASE**: 日本語、即時自動配信、デジタル商品対応
- **Lemon Squeezy**: 国際対応、ファイル配信、ライセンスキー対応
- **Gumroad**: 海外市場、レビュー機能

ZIP ファイルは各プラットフォームの配信機能で直接配布。
GitHub Releases も併用可能（プライベートリポジトリで「購入者のみ collaborator として招待」運用も可）。
