# 音声知覚 Identification タスク アプリ 仕様書

このドキュメントは、ブラウザで動作する音声知覚 identification 実験アプリの仕様を
まとめたものです。本アプリは pie/buy 連続体識別タスクとして実装されていますが、
他の連続体（/r/-/l/、VOT、ピッチなど）の identification 実験のベースとしても
利用できます。

---

## 1. 目的

オンライン環境（特にスマホ + イヤホン）で、本格的な音声知覚 identification 実験を
実施するためのスタンドアロン Web アプリ。被験者は配布された URL を開くだけで参加でき、
反応データは Google スプレッドシートに自動的に蓄積される。

### 想定する典型タスク
- **2 強制選択（2AFC） identification**
  - 例: 連続的に変化する音を聞いて pie か buy かを選ぶ
- 連続体上の音素境界（カテゴリ境界）の計測
- 反応時間（RT）の計測
- 言語背景・人口統計学的変数との関連分析

### 対応する分析
- continuumStep × 応答率の心理測定関数（ロジスティック回帰）
- 境界位置（PSE）と勾配（slope）の推定
- 連続体ステップごとの RT 分析
- 個人差・群差の分析（母語別、L2 習熟度別など）

---

## 2. 技術スタック

| 項目 | 採用技術 | 備考 |
|---|---|---|
| 言語 | HTML + CSS + JavaScript | バニラ JS、フレームワーク不使用 |
| ファイル数 | 1 ファイル | `index.html` 単独で完結 |
| ビルド | なし | コピペで動作 |
| 依存 CDN | Chart.js v4 | グラフ描画のみ |
| 音声 | HTML5 `Audio` + WebAudio API | プリロード + 自動再生 + 校正用ビープ |
| サーバー | Google Apps Script | 無料、Sheets と直結 |
| データベース | Google Sheets | 2 シート（participants / results）+ errors |
| 配布 | GitHub Pages / Netlify Drop / 同 Wi-Fi 内 PC | 静的ホスティング |

### 採用しなかった技術と理由
- React / Vue: 単一画面遷移なので不要、ビルドステップ排除を優先
- localStorage / IndexedDB: 中断復帰機能を持たないため不要
- WebSocket / Server-Sent Events: 一度きりのデータ送信なので不要
- jsPsych: 学習コスト・依存追加・カスタマイズ性を考慮し見送り

---

## 3. ファイル構成

```
identification-task-app/
├── index.html        ← アプリ本体（HTML + CSS + JS、全 1 ファイル）
├── stimuli/          ← 音声ファイル（実験ごとに差し替え）
│   ├── stim01.wav
│   ├── ...
│   └── stim11.wav
├── README.md         ← セットアップ手順 / 配布手順 / Apps Script コード
└── SPEC.md           ← 本ファイル
```

`stimuli/` 内のファイル名と数は `index.html` 冒頭の `stimuli` 配列と一致させる。

---

## 4. 設定パラメータ

すべて `index.html` の冒頭付近にある定数で制御する。派生実験はここを書き換えるだけで
おおむね対応できる。

```javascript
// 4-1. 回答とグラフ
const responseOptions          = ["pie", "buy"];   // 表示する回答ボタン（2 個以上可）
const targetResponseForGraph   = "buy";            // グラフ縦軸にとる応答

// 4-2. 試行構造
const repetitionsPerStimulus   = 6;                // 主試行で各刺激を何回提示
const numPracticeTrials        = 6;                // 練習試行数（端点刺激を使用）
const breakAfterNTrials        = 33;               // この試行数経過で休憩
const fixationDurationMs       = 500;              // 注視点（+）の表示時間
const interTrialIntervalMs     = 500;              // 回答後のブランク時間（ITI）

// 4-3. ランダム化
const randomizeTrials          = true;             // 主試行の提示順をランダム化
const counterbalanceResponseOrder = true;          // 回答ボタンの左右配置を 50/50

// 4-4. 再生制御
const allowReplay              = false;            // 同じ試行内での再再生を許可するか

// 4-5. サーバー
const dataServerUrl  = "https://script.google.com/.../exec"; // Apps Script Web App URL
const experimentName = "identification_pie_buy";              // 実験識別子

// 4-6. 刺激リスト
const stimuli = [
  { id: "stim01", file: "stimuli/stim01.wav", continuumStep: 1,  label: "step1"  },
  ...
  { id: "stim11", file: "stimuli/stim11.wav", continuumStep: 11, label: "step11" }
];
```

### 派生実験で変えるもの・変えないもの

| 変えるもの | 内容 |
|---|---|
| `responseOptions`, `targetResponseForGraph` | 回答カテゴリ |
| `stimuli` 配列 | 刺激リスト（id, file, continuumStep, label） |
| `experimentName` | スプレッドシート内の識別子 |
| `repetitionsPerStimulus`, `numPracticeTrials`, `breakAfterNTrials` | 試行数 |
| HTML の同意画面・教示画面の文言 | タスク固有の説明 |

| 変えなくてよいもの |
|---|
| 画面遷移ロジック、フォーム、音声プリロード、サーバー送信、フォーカス監視 |
| 設定の文言 / メールアドレス（README に手順あり） |

---

## 5. 画面フロー

10 段階の画面遷移。

```
1. consent          同意・概要
       ↓
2. setup            デモグラフィック入力
       ↓
3. instructions     タスクの教示
       ↓
4. loading          音声プリロード（プログレスバー）
       ↓
5. practice-intro   練習開始の案内
       ↓
6. trial (練習)     練習試行（6 試行）
       ↓
7. practice-done    練習終了の案内
       ↓
8. trial (本試行)   主試行 前半（33 試行）
       ↓
9. break            中盤の休憩
       ↓
8. trial (本試行)   主試行 後半（33 試行）
       ↓
10. uploading       送信中（裏でリトライ）
       ↓
11. result          結果画面（被験者向け、簡易サマリー + グラフ）
```

### 画面ごとの責務

| 画面 | 表示内容 | 主な要素 |
|---|---|---|
| consent | 実験概要、所要時間、収集情報、撤回権、同意チェック | チェックボックス必須 |
| setup | 氏名、生年月日、性別、利き手、母語、L2 情報、生育地、方言 | 5 項目必須・他は任意 |
| instructions | タスク手順 6 項目（注視点 → 自動再生 → 回答 → ITI） | 文章のみ |
| loading | 「音声を準備しています…」 + プログレスバー | プリロード完了で自動遷移 |
| practice-intro | 「これから 6 試行の練習」 | ボタンで遷移 |
| trial | バッジ（練習/本試行）、進捗バー、注視点、回答ボタン | フェーズで表示切替 |
| practice-done | 「練習終了 → 本試行へ」 | ボタンで遷移 |
| break | 「休憩」「33 / 66 試行 完了」 | 再開ボタン |
| uploading | 「結果を送信しています…」「タブを閉じないでください」 | 自動遷移 |
| result | 「✓ 結果を保存しました」 + 簡易サマリー + 2 グラフ | 被験者には常に成功表示 |

---

## 6. 各試行の構造

1 試行は次の 4 フェーズで構成される：

```
┌─ Phase 1: 注視点 ─┐ ┌─ Phase 2: 刺激再生 ─┐ ┌─ Phase 3: 回答 ─┐ ┌─ Phase 4: ITI ─┐
│   "+" を 500 ms  │ │  音声を自動再生      │ │  ボタン押下まで │ │  ブランク 500ms│
│                  │ │  （ジェスチャ要時    │ │  待機（無制限） │ │                │
│                  │ │  は手動再生に降格）  │ │                │ │                │
└──────────────────┘ └──────────────────────┘ └────────────────┘ └────────────────┘
```

### 反応時間（RT）の定義
- **起点**: 音声の再生開始時刻（`performance.now()`）
- **終点**: 回答ボタンが押された時刻
- **記録**: `reactionTimeMs`（整数ミリ秒）

### 自動再生フォールバック
iOS Safari など、自動再生が初回でブロックされる環境では「▶ 再生」ボタンを表示し、
手動でのジェスチャによる再生に降格する。プリロード時に Audio オブジェクトが作成済みなので、
2 試行目以降は自動再生が成功するのが通常。

---

## 7. 収集データ

### 7-1. 被験者情報（`participants` シート）

セッションごとに 1 行。

| 列 | 型 | 例 |
|---|---|---|
| submittedAt | 文字列 | "2026-05-29T14:30:15" |
| sessionId | 文字列 | "s_20260529T143015_a3f9b2" |
| experimentName | 文字列 | "identification_pie_buy" |
| name | 文字列 | "山田太郎" |
| dateOfBirth | 文字列(ISO) | "1995-03-21" |
| age | 数値 | 30（DOB から自動計算） |
| gender | 文字列 | "男性"/"女性"/"その他"/"回答しない" |
| handedness | 文字列 | "右"/"左"/"両" |
| nativeLanguage | 文字列 | "日本語" |
| l2Language | 文字列 | "英語" |
| l2Aoa | 文字列 | "12" |
| l2Proficiency | 文字列 | "初級"/"中級"/"上級"/"ネイティブレベル" |
| otherLanguages | 文字列 | 自由記述 |
| placeOfBirth | 文字列 | "東京都" |
| placeOfUpbringing | 文字列 | "大阪府" |
| dialect | 文字列 | "関西弁" |
| responseButtonOrder | 文字列 | "pie\|buy" or "buy\|pie" |
| focusBlurCount | 数値 | 0 |
| focusBlurEvents | JSON 文字列 | `[{type,t}, ...]` |
| userAgent | 文字列 | ブラウザ識別 |

### 7-2. 試行データ（`results` シート）

試行ごとに 1 行（本試行のみ、練習は除外）。

| 列 | 型 | 例 |
|---|---|---|
| submittedAt | 文字列 | "2026-05-29T14:30:15" |
| sessionId | 文字列 | "s_20260529T143015_a3f9b2" |
| experimentName | 文字列 | "identification_pie_buy" |
| trialNumber | 数値 | 1〜66 |
| stimulusId | 文字列 | "stim05" |
| file | 文字列 | "stimuli/stim05.wav" |
| continuumStep | 数値 | 5 |
| label | 文字列 | "step5" |
| response | 文字列 | "pie" or "buy" |
| reactionTimeMs | 数値 | 850 |
| playCount | 数値 | 1 |
| timestamp | 文字列(ISO) | 端末ローカル時刻 |

### 7-3. エラー報告（`errors` シート）

送信失敗時に裏で書き込まれる。被験者には表示されない。

| 列 | 内容 |
|---|---|
| submittedAt, sessionId, experimentName | セッション識別 |
| participantName | 氏名（連絡用） |
| error | エラーメッセージ |
| userAgent | ブラウザ |
| payloadJSON | 全データ（リカバリ用、被験者情報 + 全試行） |

---

## 8. データ送信フロー

```
[被験者ブラウザ]                                      [Apps Script]
       │                                                     │
       │ 1. 主試行完了                                       │
       │ 2. payload = { participant, results, ... }          │
       │ 3. POST （Content-Type: text/plain で preflight 回避）│
       ├────────────────────────────────────────────────────>│
       │                                                     │ doPost()
       │                                                     │ ├ participants に 1 行
       │ 4. { ok: true }                                     │ └ results に N 行
       │<────────────────────────────────────────────────────│
       │                                                     │
       │ 5. 「✓ 結果を保存しました」表示                       │
```

### リトライとエラー報告
失敗時の挙動（被験者にはすべて非表示で実行）：

1. **自動リトライ 3 回**（0s / 2s / 5s バックオフ、各 15s タイムアウト）
2. **エラー報告 POST**（`errorReport: true` フラグ + `fetch keepalive`）
3. **Apps Script 側**:
   - `errors` シートに全データ（被験者情報 + 全試行）を payloadJSON として記録
   - `RESEARCHER_EMAIL` に通知メール送信
4. **被験者画面**: 常に「✓ 結果を保存しました」を表示

### CORS の扱い
- リクエストの `Content-Type` を明示せず "text/plain" 扱いにすることで preflight を回避
- Apps Script 側は `e.postData.contents` を JSON.parse する

---

## 9. 品質コントロール

| 機能 | 実装方法 | 目的 |
|---|---|---|
| 同意画面 | チェックボックス必須 + 「次へ」ボタン disabled | インフォームドコンセント |
| 練習試行 | 端点刺激（min / max step）×3 回ずつ、データは保存しない | タスク慣れ |
| 注視点 | "+" を 500 ms 表示 | 注意の準備 |
| 自動再生 | プリロード済み Audio を gestureless で play() | RT 測定の安定化 |
| 再再生禁止 | `allowReplay = false` | RT の試行間比較性 |
| 回答ボタン左右ランダム化 | セッション開始時に 50/50、`responseButtonOrder` に記録 | 応答バイアス相殺 |
| ITI | 回答後 500ms ブランク | 試行間の独立性 |
| 中盤休憩 | 33 試行経過時に休憩画面 | 疲労軽減 |
| Wake Lock | `navigator.wakeLock.request('screen')` | スマホの自動ロック防止 |
| フォーカス監視 | `window.blur/focus` を試行・休憩中のみカウント | 注意逸脱の検出 |
| 音量チェック | WebAudio で 880Hz 0.5s のビープ | iOS の音声アンロック + 音量確認 |
| iPhone 消音スイッチ警告 | チェックリストに明記 | 無音再生の防止 |
| 自動ロック警告 | チェックリストに明記 | Wake Lock が効かない場合の保険 |

---

## 10. UI/UX 設計原則

### モバイルファースト
- viewport: `maximum-scale=1.0, user-scalable=no`（入力フォーカス時ズーム抑止）
- すべての input フォントサイズ ≥ 16px（iOS 自動ズーム回避）
- タップターゲットは 44px 以上
- レスポンシブ（≥600px で 2 カラム、それ以下で 1 カラム）

### 視覚デザイン
- Apple HIG 風（白基調、角丸 10〜16px、影は控えめ）
- アクセントカラー: `#0071e3`（青）
- 成功: `#34c759` / `#34a853`、警告: `#ff9500`、エラー: `#b00020`
- 日本語フォント: `Hiragino Sans`, `Yu Gothic`, `Meiryo`

### アクセシビリティ
- 必須項目は赤い `*` で明示
- セクション見出しで視覚的グルーピング
- ラジオボタンは選択時にハイライト（`:has(input:checked)`）
- エラーメッセージは具体的（どの項目か明示）

---

## 11. ブラウザ対応

### 主要対応
| ブラウザ | 対応状況 |
|---|---|
| iOS Safari 15.4+ | ✓ |
| Android Chrome 90+ | ✓ |
| Desktop Chrome/Edge | ✓ |
| Firefox 100+ | ✓ |
| Desktop Safari 15.4+ | ✓ |

### 既知の挙動差
- **iOS Safari**: 初回の自動再生が blocked される可能性 → 手動再生ボタンに降格
- **iOS Safari の消音スイッチ**: ON だと HTML5 音声が無音再生される
- **HTTPS 必須機能**: Wake Lock API（HTTP では効かない、`http://localhost` は OK）
- **`:has()`**: Safari 15.4+, Chrome 105+, Firefox 121+ で対応

---

## 12. 配布・運用

### 配布方法（既存のオプション）
1. **GitHub Pages**: リポジトリを Public にして公開、URL を被験者に送る
2. **Netlify Drop**: フォルダをドラッグ&ドロップ、無料・アカウント不要
3. **同 Wi-Fi 内 PC**: `python -m http.server` を起動、ローカル IP でアクセス（ラボ内対面実施向け）

### 実験者の運用
- 通常時: スプレッドシートの `results` / `participants` シートを見るだけ
- エラー通知メール受信時: `errors` シートの `payloadJSON` 列から手動でデータをリカバリ
- 定期チェック: `participants` シートで期待した被験者ID がすべて記録されているか確認

### 派生実験での Apps Script の扱い
- 1 つの Apps Script Web アプリで複数実験を捌くことが可能
- `experimentName` で実験を識別、同じスプレッドシートに混在で蓄積
- 別シートで分離したい場合は `experimentName` ごとに `SpreadsheetApp.insertSheet` する分岐を Apps Script に追加

---

## 13. 既知の制約・前提

### 仕様上の前提
- 被験者が **イヤホン/ヘッドホン** を装着する想定（スピーカー非推奨）
- 連続体は **1 次元** を想定（多次元は対象外）
- 試行は **ブロック構造なし**（単一ブロック + 1 回の休憩）
- 中断後の **再開機能なし**（タブを閉じると最初から）
- **完全オフライン動作不可**（Apps Script との通信が必要、Chart.js が CDN）

### スケーリングの限界
- Google Apps Script: 同時実行 30、1 日のクォータあり（数百人/日なら問題なし）
- Google Sheets: 1 シート 1000 万セルまで（実質無制限）

### セキュリティ上の注意
- 氏名・生年月日を収集するため、配布 URL の管理に注意（不特定多数公開は要検討）
- Google Sheets の共有権限は最小限に
- Apps Script の RESEARCHER_EMAIL は研究者個人のアドレス

---

## 14. 派生実験を作るときの手順

新しい連続体や別の最小対立を扱う場合の標準手順：

1. **`identification-task-app/` をフォルダごとコピー** して新フォルダを作る
2. **`stimuli/` を入れ替え**（音声ファイルを差し替え）
3. **`index.html` 冒頭の `stimuli` 配列を編集**（id, file, continuumStep, label）
4. **`responseOptions` と `targetResponseForGraph` を編集**（回答カテゴリ）
5. **`experimentName` を編集**（スプレッドシート内の識別子）
6. **HTML の同意画面 (`screen-consent`) と教示画面 (`screen-instructions`) の文言を編集**
   - 単語例、研究目的、所要時間など
7. 必要なら **`repetitionsPerStimulus` などの試行数パラメータを調整**
8. **既存の Apps Script はそのまま流用可能**（`experimentName` で区別可能）
9. **動作確認 → GitHub Pages 等にデプロイ → 配布**

### 大きな変更が必要なケース
- 3 択以上の forced choice: `responseOptions` を増やすだけで対応可能
- discrimination（AX, AXB）タスク: 試行構造を変える必要があり、`runTrial` を改修
- adaptive procedure（QUEST, staircase）: `buildMainTrialList` を動的化、状態管理を追加
- 視覚刺激の併用: 試行画面に画像表示要素を追加、刺激配列に画像パスを加える

---

## 15. 履歴・バージョン

| バージョン | 主な変更 |
|---|---|
| v1（初期） | 単純な反応記録 + CSV ダウンロード |
| v2 | サーバー保存（Google Sheets）追加 |
| v3 | スマホ対応、Wake Lock、iOS 対策 |
| v4 | 失敗時の被験者非表示化、研究者へのメール通知 |
| v5 | デモグラ調査票拡張（性別・利き手・L2・生育地） |
| **v6（現行）** | **練習試行、注視点、ITI、回答ボタン counterbalancing、休憩、注意逸脱トラッキングを追加し、本格的実験プロトコル化** |
