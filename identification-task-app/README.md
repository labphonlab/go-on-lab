# 音声知覚 Identification タスク (Web アプリ)

ローカルPC上のブラウザで動作する、音声知覚 identification 実験用のシンプルな
Webアプリです。刺激音の提示・参加者の反応記録・集計・グラフ表示・CSV保存まで
すべてブラウザ上で完結します。サーバー側処理・データベースは不要です。

## 概要

- 1試行ごとに1つの音声刺激を提示する identification タスク
- 参加者は提示された音を聞き、回答ボタン（初期設定では `/r/` と `/l/`）から選択
- 反応時間は **初回再生ボタンを押した時点から回答までの時間** を記録
- 終了後に結果表 + continuumStep ごとの応答率/反応時間グラフを表示
- 結果は UTF-8 BOM 付き CSV としてダウンロード可能

## フォルダ構成

```
identification-task-app/
├── index.html        ← アプリ本体（HTML + CSS + JS）
├── stimuli/          ← 音声ファイルを置くフォルダ
│   ├── stim01.wav
│   ├── stim02.wav
│   ├── ...
│   └── stim20.wav
└── README.md         ← このファイル
```

## 刺激ファイルの配置方法

1. `identification-task-app/stimuli/` フォルダを作成する（既にあれば不要）
2. 音声ファイル（`.wav` 推奨。`.mp3` `.ogg` などブラウザが再生できる形式も可）を
   `stim01.wav`, `stim02.wav`, ... のようなファイル名で配置する
3. `index.html` 内の `stimuli` 配列に書かれた `file` プロパティのパスと
   実際のファイル名が一致していることを確認する

ファイル名や数を変更する場合は、後述「刺激数・continuumStep の変更方法」を参照。

## 起動方法

### 推奨: Python の簡易サーバーを使う

ターミナル（Windows なら PowerShell やコマンドプロンプト）で
`identification-task-app/` フォルダに移動し、以下を実行する。

```bash
cd identification-task-app
python -m http.server 8000
```

Python 2 環境の場合は `python -m SimpleHTTPServer 8000`。

その後、ブラウザで以下の URL を開く。

```
http://localhost:8000
```

`index.html` が自動的に表示される。ポート番号 (`8000`) は任意に変更可能。

### VS Code Live Server を使う

1. VS Code に拡張機能「Live Server」をインストール
2. `identification-task-app/` フォルダを VS Code で開く
3. `index.html` を右クリック → **Open with Live Server**

### file:// で直接開く（非推奨）

`index.html` をダブルクリックしてブラウザで開くこともできますが、ブラウザによっては
ローカルファイル（`file://`）からの音声読み込みに制限がかかり、音声が再生できない・
読み込みエラーになる場合があります（特に Chrome 系）。**ローカルサーバー経由の起動を強く推奨します。**

## 使い方

1. ブラウザでアプリを開く
2. 参加者ID（例: `P01`）を入力して「開始する」を押す
3. 試行画面で「▶ 再生」を押して刺激を聞く
4. 再生終了後に回答ボタン（`/r/` または `/l/`）を押す
5. 自動的に次の試行へ進む
6. 全 20 試行終了後、結果画面が表示される
7. 「CSV をダウンロード」を押して結果を保存

## 設定の変更方法

`index.html` の冒頭付近の `<script>` ブロックで以下の設定を編集できる。

```javascript
const responseOptions = ["/r/", "/l/"];       // 回答選択肢
const targetResponseForGraph = "/r/";          // 応答率グラフのターゲット
const randomizeTrials = true;                  // 提示順をランダム化するか
const allowReplay = true;                      // 再再生を許可するか
```

### 回答選択肢の変更

`responseOptions` を変更する。例:

```javascript
const responseOptions = ["/ra/", "/la/"];
// 3択以上も可能
const responseOptions = ["A", "B", "わからない"];
```

`targetResponseForGraph` には `responseOptions` のいずれかを指定する
（応答率グラフはこの選択肢の応答率を表示する）。

### 再生回数の制限

`allowReplay = false` にすると、各試行で 1 回だけ再生可能になる。
`true` の場合は何回でも再生できる（CSV に `playCount` として記録される）。

### 刺激数・continuumStep の変更

`index.html` の `stimuli` 配列を編集する。各要素は以下の形式。

```javascript
{ id: "stim01", file: "stimuli/stim01.wav", continuumStep: 1, label: "step1" }
```

- `id`: 刺激の識別子（CSV に保存される）
- `file`: 音声ファイルへのパス（`index.html` から見た相対パス）
- `continuumStep`: 連続体上のステップ番号（グラフの横軸）
- `label`: 任意のラベル（CSV に保存される）

試行数 (`trialTotal`) は `stimuli` 配列の長さから自動的に決まるため、
配列に項目を増減すればそのまま反映される。

### ランダム化

`randomizeTrials = true` のとき、実験開始時に `stimuli` 配列が
Fisher–Yates 法でシャッフルされる。CSV に保存される `trialNumber` は
実際の提示順、`stimulusId` はその試行で提示された刺激の ID。

## CSV 出力

ファイル名: `identification_results_<参加者ID>_<日時>.csv`

文字コード: UTF-8 (BOM 付き) — Excel で開いても日本語が文字化けしにくい。

保存される列:

| 列名 | 内容 |
| --- | --- |
| `participantId` | 参加者ID |
| `trialNumber` | 提示順（1〜） |
| `stimulusId` | 刺激ID |
| `file` | 音声ファイルのパス |
| `continuumStep` | 連続体上のステップ |
| `label` | ラベル |
| `response` | 参加者の回答 |
| `reactionTimeMs` | 反応時間（ms、初回再生〜回答） |
| `playCount` | その試行で再生した回数 |
| `timestamp` | 回答時刻（ISO 風） |

## 注意事項

- **file:// 直開きの制限**: ブラウザ（特に Chrome / Edge）はローカルファイルからの
  音声リソース読み込みを制限することがあります。音声が読み込めない場合は、
  Python 簡易サーバーや VS Code Live Server 経由で開いてください。
- **ブラウザ自動再生制限**: ユーザー操作（「再生」ボタンのクリック）をきっかけに
  音声を再生する設計のため、通常は問題ありませんが、ブラウザの設定によっては
  最初の再生が失敗することがあります。その場合は画面に表示されるエラーメッセージに
  従ってください。
- **対応ブラウザ**: 最新版の Chrome / Edge / Firefox / Safari で動作確認を推奨。

## ライセンス

研究・教育目的での自由な改変・利用が可能です。
