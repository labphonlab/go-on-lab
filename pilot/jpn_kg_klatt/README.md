# パイロット実験: 日本語 /k/-/g/ VOT 連続体（Klatt 完全合成）

刺激音セット商品化前の妥当性検証用パイロット。

## 何を検証するか

| 項目 | 期待される結果 | 合格基準 |
|---|---|---|
| **境界位置** | カテゴリ境界が VOT +10〜+25 ms に出る | 全 3 名で境界が step5-7 の範囲 |
| **境界の鋭さ** | 50% 同定確率の前後 ±10 ms で 80% / 20% に変化 | スロープが極端に緩くない |
| **端点識別** | step1 (VOT -40) はほぼ 100% /g/、step11 (VOT +60) はほぼ 100% /k/ | 端点で >90% の正答 |
| **個人間一貫性** | 境界位置が話者間で大きくずれない | 境界位置の SD < 15 ms |

## デプロイ手順（5 分）

### 1. GitHub Pages 経由

このリポジトリが GitHub Pages で公開済みなら、自動的に以下の URL でアクセス可能:

```
https://labphonlab.github.io/go-on-lab/pilot/jpn_kg_klatt/
```

（パブリッシュに数分かかる場合あり）

### 2. ローカルテスト

```bash
cd pilot/jpn_kg_klatt
python3 -m http.server 8000
# ブラウザで http://localhost:8000/ を開く
```

注意: ローカル `file://` 直接アクセスでは Audio 再生が制限されるブラウザがあるため、必ず HTTP サーバー経由でアクセス。

## パイロット参加者への案内文（コピペ用）

> こんにちは。研究用に新しく作成した音声刺激の妥当性チェックにご協力をお願いできますか？
>
> **所要時間**: 約 5 分
> **必要なもの**: イヤホン or ヘッドホン
> **URL**: <https://labphonlab.github.io/go-on-lab/pilot/jpn_kg_klatt/>
>
> 「か」と「が」のどちらに聞こえるか判定するシンプルなタスクです。
> 全 55 試行（練習 6 試行 + 本試行 55 試行）です。
>
> iPhone の場合は消音スイッチを OFF にしてからお開きください。

## データの確認方法

参加者のデータは設定済みの Google Apps Script 経由で Google Sheets に自動保存されます:

- 個人情報: `participants` シート
- 試行データ: `results_identification` シート

各シートで以下を確認:

```
experimentName = "pilot_jpn_kg_vot_klatt_v1"
```

でフィルタすると、本パイロットのデータのみが抽出できます。

## 分析チートシート

3 名のデータを取得したら、以下を確認:

### 心理測定関数のプロット

参加者ごと、continuumStep 別に「か」回答率を集計:

```python
import pandas as pd
df = pd.read_csv("results_identification.csv")
df = df[df.experimentName == "pilot_jpn_kg_vot_klatt_v1"]

# 参加者 × ステップ別の「か」率
ka_rate = df.assign(is_ka=(df.response == "か")) \
            .groupby(["participantId", "continuumStep"])["is_ka"] \
            .mean().unstack()
print(ka_rate)
```

### 境界位置の推定

```python
import numpy as np

# 連続体ステップ → VOT (ms) 変換
step_to_vot = {1: -40, 2: -30, 3: -20, 4: -10, 5: 0,
               6: 10, 7: 20, 8: 30, 9: 40, 10: 50, 11: 60}

# 各参加者の 50% 境界 (線形補間)
for pid, row in ka_rate.iterrows():
    sorted_steps = sorted(row.index)
    rates = [row[s] for s in sorted_steps]
    # 0.5 を境に補間
    for i in range(len(rates) - 1):
        if rates[i] >= 0.5 > rates[i + 1]:
            t1, t2 = step_to_vot[sorted_steps[i]], step_to_vot[sorted_steps[i + 1]]
            r1, r2 = rates[i], rates[i + 1]
            boundary = t1 + (0.5 - r1) * (t2 - t1) / (r2 - r1)
            print(f"{pid}: boundary = {boundary:+.1f} ms")
            break
```

## チューニングの判断基準

パイロット結果から、刺激音をどう調整するか:

| パイロット結果 | 解釈 | 調整 |
|---|---|---|
| 境界が +15-25 ms に出る | ✅ 自然な日本語境界 | チューニング不要、製品化 OK |
| 境界が +30 ms 以上に出る | 帯気が弱すぎ or 母音が無声化しにくい | aspiration_intensity_db を +5、または closure を長く |
| 境界が +5 ms 以下に出る | 無声化が強すぎ or 帯気が過剰 | aspiration_intensity_db を -5 |
| 端点で同定率 < 80% | 端点が中途半端 | VOT 範囲を ±10 ms ずつ拡張 |
| 境界の傾きが緩い | 連続体の中間ステップが不明瞭 | F0、burst spectrum を再確認 |
| 個人差が大きい (SD > 20 ms) | 刺激の問題ではなく被験者の個人差 | 普通の現象、サンプル数を増やす |

## 失敗ケースの対処

### ケース 1: 全員が「か」しか答えない（境界がない）

→ プレボイシング（負 VOT）が弱すぎる。`prevoicing_intensity_db` を 55 → 60 に上げる。

### ケース 2: 全員が「が」しか答えない

→ 帯気（aspiration）が聞こえていない。`aspiration_intensity_db` を 48 → 55 に上げる。

### ケース 3: バラバラで境界が定まらない

→ 刺激の自然さの問題かもしれない。F0 にゆらぎ追加、母音 onset を滑らかに、を検討。

## 次のステップ

パイロット OK の場合:

1. `product/stimuli/synthesis/output/jpn_kg_vot/` を ZIP 化
2. `acoustic_parameters.csv` と `perception_lab_config.json` が含まれていることを確認
3. BASE / Lemon Squeezy に商品登録
4. 同じワークフローで `jpn_td_vot` と `eng_pb_vot` もパイロット

パイロット NG の場合:

1. 上記「チューニングの判断基準」表を参照して config 修正
2. `python3 synthesize_vot_continuum.py configs/jpn_kg_vot.yaml` で再合成
3. このパイロットフォルダの WAV を更新
4. 同じ 3 名で再パイロット（または別の 3 名で確認）
