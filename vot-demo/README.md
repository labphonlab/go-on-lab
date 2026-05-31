# VOT 知覚デモ（音声学クラス用）

英語の `/pa/`-`/ba/` 連続体（VOT = Voice Onset Time が 0〜50 ms の 11 段階）を聞いて、
聞こえた音を選んでもらう **音声学授業デモ用 Web アプリ** です。

学生が個別にリンクを開いて受験し、最後に **自分のカテゴリ境界**（perceptual boundary）を
psychometric function として確認できます。データは裏で Google スプレッドシートに送信され、
教員は **`?teacher=1`** を付けたリンクから **クラス全体の集計グラフ** を表示できます。

## 特徴（識別実験本体との違い）

| 項目 | identification-task-app（本格実験） | vot-demo（このデモ） |
|---|---|---|
| 同意画面 | あり | なし（簡潔なイントロのみ） |
| デモグラフィック調査 | フル（氏名・生年月日・性別・利き手・L2 など） | ニックネームのみ任意 |
| 練習試行 | あり | なし |
| 試行数 | 66 + 練習 6 | 44（11 × 4 提示） |
| 休憩 | あり | なし |
| 結果画面 | 簡易サマリー + グラフ | **個人の psychometric function を表示** |
| 教員モード | なし | **`?teacher=1`** でクラス全体の集計グラフ |
| 所要時間 | 約 7〜10 分 | 約 4〜5 分 |

## フォルダ構成

```
vot-demo/
├── index.html       ← アプリ本体（単一ファイル）
├── stimuli/         ← VOT 連続体音声（11 ファイル、identification-task-app から流用）
│   ├── stim01.wav   ← VOT 0 ms
│   ├── stim02.wav   ← VOT 5 ms
│   ├── ...
│   └── stim11.wav   ← VOT 50 ms
└── README.md
```

`stimuli/` の音声ファイルは `identification-task-app/stimuli/` と同じものです（複製済み）。
VOT 値のマッピングは `index.html` 内の `CONFIG.stimuli` 配列で編集できます。

## 学生からの見え方

1. 配布された URL を開く
2. （任意）ニックネーム or ID を入力 → 「開始する」
3. 11 音 × 4 回 = 44 試行を順次提示（注視点 → 自動再生 → /pa/ or /ba/ を選択 → 次へ）
4. 結果画面で **自分の心理測定関数** と **カテゴリ境界** を表示
5. データはバックグラウンドで自動送信（学生は意識しない）

## 教員モード

URL に `?teacher=1` を付けると教員用画面が開きます:

```
https://.../vot-demo/?teacher=1
```

表示される内容:
- **参加人数 / 総試行数 / クラス平均境界 / 境界の SD**
- **クラス全体の心理測定関数**（個人の細線 + クラス平均の太線）
- **カテゴリ境界の分布**（ヒストグラム）

## デプロイ手順

### 1. Apps Script に `doGet` を追加（教員モードで必要）

既存の Apps Script（identification-task-app と共用）に **以下の `doGet` 関数を追加** してください:

```javascript
function doGet(e) {
  const params = e.parameter || {};
  if (params.action === "aggregate") {
    return aggregateForExperiment_(params.experimentName);
  }
  return jsonOut_({ ok: true, info: "Use POST to submit data." });
}

function aggregateForExperiment_(experimentName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("results_identification");
  if (!sheet) return jsonOut_({ ok: false, error: "results_identification sheet not found" });

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return jsonOut_({ ok: true, results: [] });

  const headers = data[0];
  const results = [];
  for (let i = 1; i < data.length; i++) {
    const row = {};
    headers.forEach((h, j) => { row[h] = data[i][j]; });
    if (!experimentName || row.experimentName === experimentName) {
      results.push(row);
    }
  }
  return jsonOut_({ ok: true, count: results.length, results: results });
}
```

> 既存の `doPost`, `handleResults`, `handleErrorReport`, `notifyResearcher_`, `jsonOut_` はそのまま残してください。

保存 → 「デプロイを管理」→ 鉛筆 → バージョン「新バージョン」→ デプロイ。

### 2. データ送信先 URL の設定

`vot-demo/index.html` の `CONFIG.dataServerUrl` が、identification-task-app と同じ
Apps Script Web App URL を指していることを確認してください（既定値は設定済み）。

### 3. 配布

GitHub Pages 等で公開した上で、以下を配布:

- **学生用**: `https://.../vot-demo/`
- **教員用**: `https://.../vot-demo/?teacher=1`

## データ収集の流れ

```
[学生 A] ───POST───┐
[学生 B] ───POST───┼──→ Apps Script ──→ Google Sheets
[学生 C] ───POST───┘                     (results_identification シート、
                                          experimentName = "vot_demo_pa_ba")
                                                    │
[教員] ?teacher=1 ──GET──→ Apps Script ─集計→ チャート表示
```

すべてのデータは `experimentName: "vot_demo_pa_ba"` でタグ付けされ、
本格実験のデータ（`identification_pie_buy`）とは混ざりません。

## VOT 値のマッピング

既存の `stim01.wav` 〜 `stim11.wav` を VOT 0〜50 ms の 11 段階としてマッピングしています。
実際の刺激の VOT が異なる場合は、`index.html` 内の `CONFIG.stimuli` 配列の
`continuumStep` と `label` を実測値に変更してください:

```javascript
const CONFIG = {
  ...
  stimuli: [
    { id: "vot00", file: "stimuli/stim01.wav", continuumStep: 0,  label: "0 ms"  },
    { id: "vot05", file: "stimuli/stim02.wav", continuumStep: 5,  label: "5 ms"  },
    ...
  ]
};
```

## 授業での使い方（例）

1. 授業開始前にスクリーンに **`https://.../vot-demo/`** の QR コードを表示
2. 学生がスマホでスキャン → 4〜5 分でデモ完了
3. 全員終わったら教員が **`?teacher=1`** で集計グラフを表示
4. 「カテゴリ境界の分布」を示しながら、知覚境界・個人差・カテゴリ知覚の話を展開

## カスタマイズのヒント

- **試行数を減らしたい**: `repetitionsPerStimulus` を 4 → 2 にすると 22 試行（約 2 分）
- **試行数を増やしたい**: 6 にすると 66 試行（約 7 分、本格実験並み）
- **他の連続体に変える**: `stimuli` 配列と `responseOptions` を入れ替えるだけ
- **/da/-/ta/** などのデモにする: `responseOptions = ["da", "ta"]` に変更
