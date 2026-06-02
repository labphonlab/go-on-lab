# VOT 連続体 Klatt 合成スクリプト

著作権クリーンな VOT 連続体を完全合成で生成し、Perception Lab の刺激音セットとして即出荷できる ZIP パッケージまで自動構築するツールです。

## なぜ完全合成か

`stimuli/COPYRIGHT_CHECKLIST.md` で述べた通り、既存録音（IPA illustrations / コーパス等）から派生した連続体は商用販売できません。
本スクリプトは **Praat の KlattGrid** を使って波形を完全に新規生成するため、**元波形の著作権を一切引き継ぎません**。

音響パラメータの「参考値」を先行研究や既存録音から取ること（数値の引用）は問題ありません。

## 出力

設定ファイル 1 つから以下が一式自動生成されます:

```
output/[set_id]/
├── README.txt
├── TECHNICAL_NOTE.md             ← PDF 化前のソース
├── LICENSE.txt
├── wav/
│   ├── 44k1/[set_id]_step01.wav 〜 step11.wav
│   ├── 22k05/[set_id]_step01.wav 〜 step11.wav
│   └── 16k/[set_id]_step01.wav 〜 step11.wav
├── acoustic_parameters.csv
└── perception_lab_config.json
```

そのまま `zip -r [set_id]_v1.zip output/[set_id]/` で商品 ZIP が完成します。

## クイックスタート

```bash
# 1. 依存をインストール
pip install -r requirements.txt

# 2. 同梱の日本語 /k/-/g/ サンプルを合成
python synthesize_vot_continuum.py configs/jpn_kg_vot.yaml

# 3. output/jpn_kg_vot/ に全成果物が生成される
ls output/jpn_kg_vot/wav/44k1/
```

## 設定ファイルの構造

```yaml
set_id: jpn_kg_vot
set_name: "日本語 /k/-/g/ VOT 連続体"
language: jp
contrast: "/k/-/g/"
vowel: a

# 連続体パラメータ
vot_steps_ms: [-40, -30, -20, -10, 0, 10, 20, 30, 40, 50, 60]

# 母音の音響特性 (Hz)
formants:
  f1: { freq: 700, bw: 90 }
  f2: { freq: 1200, bw: 110 }
  f3: { freq: 2600, bw: 170 }
  f4: { freq: 3500, bw: 250 }

# F0 (Hz)
f0:
  start: 130
  end: 100

# タイミング (ms)
timing:
  lead_silence: 50
  closure: 60
  burst: 5
  vowel: 200
  trail_silence: 50

# バースト特性
burst:
  type: velar    # velar / dental / labial
  intensity_db: 70

# 帯気
aspiration:
  intensity_db: 60

# 出力
sample_rates_hz: [44100, 22050, 16000]
```

## 言語・対立別のチューニング

`configs/` に 3 種のサンプルを同梱:

| ファイル | 連続体 | 主な違い |
|---|---|---|
| `jpn_kg_vot.yaml` | 日本語 /k/-/g/ | velar burst、母音 /a/ |
| `jpn_td_vot.yaml` | 日本語 /t/-/d/ | dental burst、母音 /a/ |
| `eng_pb_vot.yaml` | 英語 /p/-/b/ | labial burst、母音 /ɑ/、より高めの帯気 |

新しい連続体を作りたい場合はこれらをコピーして編集してください。

## Praat 単独でも実行可能

Python 環境がない場合、`synthesize_vot_continuum.praat` を Praat のスクリプトエディタで開いて実行できます。
ただしバッチ処理・config 駆動・配信パッケージ自動生成は Python 版のみの機能です。

## 妥当性の確認

合成後は必ず以下を確認してください:

1. **聞いてみる**: 端点（最小・最大 VOT）が明らかに有声・無声（または有気・無気）に聞こえるか
2. **Praat で測定**: 実際の VOT が指定値と一致しているか（オシログラム上で目視）
3. **被験者で予備実験**: 自分または同僚 3 名で同定実験を行い、中間ステップが境界付近にあるか

調整が必要な場合:
- 中間ステップが片側に偏る → ステップ間隔を非線形に（境界付近で密に）
- 識別が困難 → F0、強度、母音長を見直し
- 不自然 → 共鳴ピーク（formants）と帯域幅（bw）を再調整

## チューニングのコツ

Klatt 合成の音は「ロボット感」がやや残ります。自然さを高めるなら:

- **F0 にゆらぎ**: `flutter_percent` を 2〜5% に
- **母音 onset 時に formant 遷移**: 単純化のため省略しているが、burst から vowel への遷移を 30ms 程度で
- **強度に micro-modulation**: ±2 dB の randomization

これらは `synthesize_vot_continuum.py` の `_build_klattgrid()` 関数を編集して追加できます。

## 既知の制約

- 単一話者性（架空話者の単一声）。話者間変動は別連続体として制作
- 母音遷移は省略（CV の transition）。必要なら formant 値を時間変化させる
- 鼻音化・声質変動は実装なし（Klatt の能力はあるが、Setup 簡略化のため未使用）

## ファイル構成

```
synthesis/
├── README.md                            ← このファイル
├── requirements.txt                     ← Python deps
├── synthesize_vot_continuum.py          ← メインスクリプト
├── synthesize_vot_continuum.praat       ← Praat 単独版
└── configs/
    ├── jpn_kg_vot.yaml
    ├── jpn_td_vot.yaml
    └── eng_pb_vot.yaml
```
