# Technical Note: [刺激音セット名]

> 各刺激音セットに添付する Technical Note の雛形。
> 購入者はこの文書を論文の Methods 節に引用できます。
> 最終出荷時は PDF に変換してパッケージに含めてください。

---

## 1. セット情報

| 項目 | 値 |
|---|---|
| **セット名** | 日本語 /k/-/g/ VOT 連続体（例） |
| **セット ID** | jpn_kg_vot_v1 |
| **バージョン** | 1.0 |
| **発行日** | 2026-XX-XX |
| **作成者** | labphonlab |
| **連続体次元** | Voice Onset Time (VOT) |
| **ステップ数** | 11 |
| **ステップ範囲** | -40 ms 〜 +60 ms（10 ms 刻み） |
| **言語/対象話者** | 日本語母語話者向け |
| **対立カテゴリ** | /k/（無声・短 VOT） vs /g/（有声・負 VOT） |

## 2. 制作手法

### 2-1. 合成方式

[例] 完全合成。Klatt synthesizer (Klatt 1980; Klatt & Klatt 1990) を使用し、
波形の切り貼り・LPC 操作・既存録音の改変は**一切行っていない**。
音響パラメータの参考値は [出典] から取得した。

> ※「元素材の出所」を必ず明記してください。完全合成 / 自前収録 / コーパス由来など。

### 2-2. 合成パラメータ

| パラメータ | 値 |
|---|---|
| サンプリング | 44.1 kHz, 22.05 kHz, 16 kHz（3 形式提供） |
| 量子化 | 16 bit |
| 全体継続時間 | 250 ms |
| 母音部 | /a/（F1 = 700 Hz, F2 = 1200 Hz, F3 = 2500 Hz） |
| 母音部 F0 | 120 Hz（直線下降） |
| 母音部継続時間 | 200 ms |
| 閉鎖区間 | 50 ms（無音） |
| 破裂バースト | 5 ms（広帯域ノイズ） |
| 後続有声化開始 | ステップにより -40〜+60 ms |
| RMS 正規化 | -23 LUFS（EBU R128） |

### 2-3. 連続体生成式

[例] 各ステップの VOT は以下:

```
step 1: VOT = -40 ms (有声、声帯振動が破裂前から開始)
step 2: VOT = -30 ms
step 3: VOT = -20 ms
step 4: VOT = -10 ms
step 5: VOT =   0 ms (破裂と同時)
step 6: VOT = +10 ms
step 7: VOT = +20 ms
step 8: VOT = +30 ms
step 9: VOT = +40 ms
step 10: VOT = +50 ms
step 11: VOT = +60 ms
```

## 3. 音響パラメータ一覧

詳細値は `acoustic_parameters.csv` を参照。

| step | VOT (ms) | F0 (Hz) | F1 (Hz) | F2 (Hz) | duration (ms) |
|---|---|---|---|---|---|
| 1 | -40 | 120 | 700 | 1200 | 250 |
| 2 | -30 | 120 | 700 | 1200 | 250 |
| ... | ... | ... | ... | ... | ... |
| 11 | +60 | 120 | 700 | 1200 | 250 |

## 4. 推奨利用法

### 4-1. 想定パラダイム

- **Identification**: 各刺激を 5-10 回ランダム提示、「か」/「が」のいずれかを選択
- **AX Discrimination**: 隣接 2 ステップを対にして提示、同/異判定

### 4-2. 推奨被験者数

- 同定実験: 16-30 名
- 個人差分析: 30 名以上推奨

### 4-3. 推奨試行数

- 練習: 6 試行（端点 2 つを 3 回ずつ）
- 本試行: 11 ステップ × 5 回 = 55 試行
- 所要時間: 約 5-7 分

### 4-4. Perception Lab 設定

同梱の `perception_lab_config.json` をそのまま設定パネルにインポート可能。

## 5. 妥当性

### 5-1. 期待される心理測定関数

[Lisker & Abramson 1964 等の] 先行研究に基づき、日本語母語話者では VOT 境界は約 **+15 〜 +25 ms** に位置することが報告されている。
本連続体での同定実験では、step 6-8 付近に境界が現れることが想定される。

### 5-2. 既知の制約

- 母音は /a/ のみ。母音環境による境界シフトを調べる場合は別途連続体が必要
- 単一話者（合成）。話者間変動の研究には不向き
- 単独刺激。文脈効果の研究には別途文中刺激が必要

## 6. 引用情報

### 6-1. 推奨引用形式（日本語論文）

> labphonlab (2026). 日本語 /k/-/g/ VOT 連続体 (jpn_kg_vot_v1) [音声刺激]. Perception Lab 刺激音セット. https://[購入ページ URL]

### 6-2. 推奨引用形式（英語論文 / APA）

> labphonlab. (2026). *Japanese /k/-/g/ VOT continuum (jpn_kg_vot_v1)* [Audio stimuli]. Perception Lab Stimulus Sets. Retrieved from https://[purchase URL]

### 6-3. 参考文献

- Klatt, D. H. (1980). Software for a cascade/parallel formant synthesizer. *JASA*, 67(3), 971-995.
- Klatt, D. H., & Klatt, L. C. (1990). Analysis, synthesis, and perception of voice quality variations among female and male talkers. *JASA*, 87(2), 820-857.
- Lisker, L., & Abramson, A. S. (1964). A cross-language study of voicing in initial stops. *Word*, 20(3), 384-422.
- [その他参考文献]

## 7. ライセンス

本セットは Perception Lab 共通ライセンス B 章（刺激音セット ライセンス）に基づき提供されます。
詳細は `LICENSE.txt` を参照。

**重要**: 本セットを利用した研究を発表する際は、上記引用情報を必ず明記してください。

## 8. 連絡先・サポート

- 技術相談（音響パラメータ等）: [サポートメール]（購入後 30 日間）
- バグ報告・改善要望: [連絡先]
