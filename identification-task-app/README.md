# 音声知覚 Identification タスク (Web アプリ)

ブラウザで動作する、音声知覚 identification 実験用のシンプルな Web アプリです。
刺激音の提示・参加者の反応記録・**Google Sheets への自動保存**・参加者向けの
簡易結果表示まで、すべてブラウザ上で完結します。

## 概要

- 1試行ごとに 1 つの音声刺激を提示する identification タスク
- 参加者は提示された音を聞き、回答ボタン（初期設定では `/r/` と `/l/`）から選択
- 反応時間は **初回再生ボタンを押した時点から回答までの時間** を記録
- 終了後、反応データを **Google Apps Script 経由で Google Sheets に自動送信**
- 参加者には簡易サマリー + continuumStep ごとの応答率/反応時間グラフのみ表示
  （詳細データ・CSV ダウンロードは表示しない）
- **送信失敗時も参加者には常に「成功」と表示**し、裏で実験者にメール通知する

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

1. 参加者は配布された URL をブラウザで開く
2. 参加者ID（例: `P01`）を入力して「開始する」を押す
3. 試行画面で「▶ 再生」を押して刺激を聞く
4. 再生終了後に回答ボタン（`/r/` または `/l/`）を押す
5. 自動的に次の試行へ進む
6. 全 20 試行終了後、データが自動でサーバー（Google Sheets）に送信される
7. 参加者には「✓ 結果を保存しました」と簡易サマリー・グラフのみ表示される
   詳細データや CSV ダウンロードは参加者には見せない
8. 送信に失敗した場合も参加者には常に成功と表示し、裏で実験者にメール通知する
   （詳細は後述「送信失敗時の挙動」）

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

## サーバー（Google Sheets）への保存設定

実験の反応データは、参加者のブラウザから直接 Google スプレッドシートに送信されます。
研究者は事前に以下の **2 ステップ** を行ってください（初回のみ、約 10 分）。

### ステップ 1: Google Apps Script を作成

1. ブラウザで <https://sheets.new> を開き、新しいスプレッドシートを作る
   （シート名は何でも OK。例: `identification_results`）
2. メニュー **「拡張機能」→「Apps Script」** を開く
3. 表示されたエディタの内容をすべて削除し、以下を貼り付ける:

   ```javascript
   // ========== 設定 ==========
   const RESULTS_SHEET = "results";
   const PARTICIPANTS_SHEET = "participants";
   const ERROR_SHEET = "errors";
   // エラー時に通知メールを受け取りたいアドレスを書く (空文字なら送らない)
   const RESEARCHER_EMAIL = "";
   // ==========================

   function doPost(e) {
     const lock = LockService.getScriptLock();
     lock.waitLock(20000);
     try {
       const data = JSON.parse(e.postData.contents);
       if (data.errorReport) {
         return handleErrorReport(data);
       }
       return handleResults(data);
     } catch (err) {
       try { notifyResearcher_("parse error", String(err), null); } catch (_) {}
       return jsonOut_({ ok: false, error: String(err) });
     } finally {
       lock.releaseLock();
     }
   }

   function handleResults(data) {
     const ss = SpreadsheetApp.getActiveSpreadsheet();
     const submittedAt = data.submittedAt || new Date().toISOString();
     const sessionId = data.sessionId || "";
     const p = data.participant || {};

     // 1. participants シート (セッションごとに 1 行、被験者情報)
     let pSheet = ss.getSheetByName(PARTICIPANTS_SHEET);
     if (!pSheet) {
       pSheet = ss.insertSheet(PARTICIPANTS_SHEET);
       pSheet.appendRow([
         "submittedAt", "sessionId", "experimentName",
         "name", "dateOfBirth", "age",
         "gender", "handedness",
         "nativeLanguage",
         "l2Language", "l2Aoa", "l2Proficiency",
         "otherLanguages",
         "placeOfBirth", "placeOfUpbringing", "dialect",
         "userAgent"
       ]);
     }
     pSheet.appendRow([
       submittedAt, sessionId, data.experimentName || "",
       p.name || "", p.dateOfBirth || "", p.age || "",
       p.gender || "", p.handedness || "",
       p.nativeLanguage || "",
       p.l2Language || "", p.l2Aoa || "", p.l2Proficiency || "",
       p.otherLanguages || "",
       p.placeOfBirth || "", p.placeOfUpbringing || "", p.dialect || "",
       data.userAgent || ""
     ]);

     // 2. results シート (試行ごとに 1 行)。sessionId で participants と結合可
     let rSheet = ss.getSheetByName(RESULTS_SHEET);
     if (!rSheet) {
       rSheet = ss.insertSheet(RESULTS_SHEET);
       rSheet.appendRow([
         "submittedAt", "sessionId", "experimentName",
         "trialNumber", "stimulusId", "file",
         "continuumStep", "label", "response",
         "reactionTimeMs", "playCount", "timestamp"
       ]);
     }
     const rows = (data.results || []).map(r => [
       submittedAt, sessionId, data.experimentName || "",
       r.trialNumber, r.stimulusId, r.file,
       r.continuumStep, r.label, r.response,
       r.reactionTimeMs, r.playCount, r.timestamp
     ]);
     if (rows.length > 0) {
       rSheet.getRange(rSheet.getLastRow() + 1, 1, rows.length, rows[0].length)
             .setValues(rows);
     }
     return jsonOut_({ ok: true, n: rows.length });
   }

   function handleErrorReport(data) {
     const ss = SpreadsheetApp.getActiveSpreadsheet();
     let sheet = ss.getSheetByName(ERROR_SHEET);
     if (!sheet) {
       sheet = ss.insertSheet(ERROR_SHEET);
       sheet.appendRow([
         "submittedAt", "sessionId", "experimentName",
         "participantName", "error", "userAgent", "payloadJSON"
       ]);
     }
     const p = data.participant || {};
     sheet.appendRow([
       data.submittedAt || new Date().toISOString(),
       data.sessionId || "",
       data.experimentName || "",
       p.name || "",
       data.error || "",
       data.userAgent || "",
       JSON.stringify(data)
     ]);
     notifyResearcher_(p.name || data.sessionId, data.error, data);
     return jsonOut_({ ok: true, errorReport: true });
   }

   function notifyResearcher_(who, error, data) {
     if (!RESEARCHER_EMAIL) return;
     const subject = "[Identification Task] エラー報告: " + (who || "unknown");
     const p = (data && data.participant) || {};
     const body =
       "実験データの送信時にクライアント側でエラーが発生しました。\n\n" +
       "セッションID: " + (data && data.sessionId ? data.sessionId : "") + "\n" +
       "氏名: "       + (p.name || "(不明)") + "\n" +
       "生年月日: "   + (p.dateOfBirth || "") + "\n" +
       "母語: "       + (p.nativeLanguage || "") + "\n" +
       "実験名: "     + (data && data.experimentName ? data.experimentName : "") + "\n" +
       "送信時刻: "   + (data && data.submittedAt ? data.submittedAt : "") + "\n" +
       "エラー内容: " + (error || "") + "\n" +
       "User-Agent: " + (data && data.userAgent ? data.userAgent : "") + "\n\n" +
       "詳細データは『" + ERROR_SHEET + "』シートをご確認ください。";
     MailApp.sendEmail(RESEARCHER_EMAIL, subject, body);
   }

   function jsonOut_(obj) {
     return ContentService
       .createTextOutput(JSON.stringify(obj))
       .setMimeType(ContentService.MimeType.JSON);
   }
   ```

   > 💡 **メール通知**: `RESEARCHER_EMAIL` に自分のメールアドレスを書いておくと、
   > 被験者側で送信に失敗したときに自動でメール通知が届きます。
   > 通知メールには参加者ID・エラー内容・全試行データ（JSON）が `errors` シートに
   > 記録されるので、後から手動でリカバリ可能です。

4. 「保存」（フロッピーアイコン）を押す
5. 右上の **「デプロイ」→「新しいデプロイ」** を押す
6. 「種類を選択」歯車 → **ウェブアプリ** を選択
7. 以下のように設定:
   - **次のユーザーとして実行**: 自分
   - **アクセスできるユーザー**: **全員**（参加者の Google ログインを不要にするため）
8. 「デプロイ」を押す
9. 初回はアクセス許可ダイアログが出るので「許可」（Google アカウントの確認画面が出たら
   「詳細」→「（プロジェクト名）に移動」を選んで進める）
10. 表示された **ウェブアプリ URL**（`https://script.google.com/macros/s/.../exec`）をコピー

### ステップ 2: index.html に URL を貼り付け

`index.html` 冒頭の `dataServerUrl` に、コピーした URL を貼り付ける:

```javascript
const dataServerUrl = "https://script.google.com/macros/s/AKfycb.../exec";
const experimentName = "identification_rl";
```

これで実験終了時に、自動でスプレッドシートの `results` シートに 1 行ずつ追加されます。

### スプレッドシートに記録される列

データは 2 つのシートに分かれて記録されます。`sessionId` で結合できます。

**`participants` シート** (セッションごとに 1 行)

| 列名 | 内容 |
| --- | --- |
| `submittedAt` | アプリから送信された時刻 |
| `sessionId` | セッションID (自動生成。`participants` と `results` を結合するキー) |
| `experimentName` | `index.html` で設定した実験名 |
| `name` | 氏名 |
| `dateOfBirth` | 生年月日 |
| `age` | 年齢 (生年月日から自動計算) |
| `gender` | 性別 (男性 / 女性 / その他 / 回答しない) |
| `handedness` | 利き手 (右 / 左 / 両) |
| `nativeLanguage` | 第一言語 (母語) |
| `l2Language` | 主な第二言語 |
| `l2Aoa` | 第二言語の学習開始年齢 (Age of Acquisition) |
| `l2Proficiency` | 第二言語の習熟度 (初級 / 中級 / 上級 / ネイティブレベル) |
| `otherLanguages` | その他の使用言語 (自由記述) |
| `placeOfBirth` | 出生地 (都道府県) |
| `placeOfUpbringing` | 主に育った地域 (都道府県) |
| `dialect` | 使用する方言 |
| `userAgent` | 参加者ブラウザの User-Agent |

**`results` シート** (試行ごとに 1 行)

| 列名 | 内容 |
| --- | --- |
| `submittedAt` | アプリから送信された時刻 |
| `sessionId` | セッションID (`participants` と結合するキー) |
| `experimentName` | 実験名 |
| `trialNumber` | 提示順 |
| `stimulusId` | 刺激ID |
| `file` | 音声ファイルのパス |
| `continuumStep` | 連続体上のステップ |
| `label` | ラベル |
| `response` | 参加者の回答 (`pie` または `buy`) |
| `reactionTimeMs` | 反応時間 (ms、初回再生〜回答) |
| `playCount` | その試行で再生した回数 |
| `timestamp` | 回答時刻 (参加者端末ローカル時刻) |

### Apps Script のコードを更新した場合

コード変更後は **「デプロイ」→「デプロイを管理」** で既存のデプロイを編集（鉛筆アイコン）
し、バージョンを「新しいバージョン」にして再デプロイしてください。URL は変わりません。

### 送信失敗時の挙動（被験者には完全に隠す）

被験者は常に「✓ 結果を保存しました」を見るだけで、失敗には気付きません。
裏側では次の順で処理されます:

1. **自動リトライ**: 送信失敗時、間隔 0 秒 → 2 秒 → 5 秒で最大 3 回まで自動再送信
2. **エラー報告の自動送信**: 3 回とも失敗した場合、別フラグ (`errorReport: true`)
   をつけて再度 POST します（`fetch` の `keepalive: true` でタブを閉じられても送信継続）
3. **`errors` シートへの記録 + メール通知**: Apps Script 側で `errorReport` を受け取ると、
   `errors` シートに全試行データ（JSON）を記録し、`RESEARCHER_EMAIL` が設定されていれば
   実験者にメール通知します

> ⚠️ ただし完全にネットワークが切れている場合や、`dataServerUrl` 自体が間違っている場合は
> エラー報告すら届きません。実験開始前に一度自分の端末で動作確認をしてください。
> また、定期的に `results` シートを見て期待した参加者ID がすべて記録されているか
> 確認することをおすすめします。

### 研究者用の操作

- 結果画面の何もないところを **5 回連続でタップ**、または URL に `?admin=1` を付けると、
  「最初に戻る」ボタンが表示されます（同じ端末で次の参加者を実施する場合に使用）

## スマートフォンで実施する方法

参加者がスマホ（iPhone / Android）と普段使いのイヤホン・ヘッドホンで実施することを想定しています。
スマホで実施するには、アプリを「スマホからアクセスできる場所」にホスティングする必要があります。
以下のいずれかの方法を選んでください。

### 方法 A: 同じ Wi-Fi 内の PC から配信（ラボ内・対面実施に最適）

研究者の PC でサーバーを起動し、参加者のスマホを同じ Wi-Fi に接続して PC の IP アドレスにアクセスします。

1. PC で `identification-task-app/` フォルダに入り、サーバーを起動:
   ```bash
   python -m http.server 8000
   ```
2. PC の **ローカル IP アドレス** を調べる:
   - Mac: `ifconfig | grep "inet " | grep -v 127.0.0.1` （例: `192.168.1.42`）
   - Windows (PowerShell): `ipconfig` で "IPv4 アドレス" を確認
3. スマホを **同じ Wi-Fi** に接続
4. スマホのブラウザ（Safari / Chrome）で以下にアクセス:
   ```
   http://192.168.1.42:8000
   ```
   （IP は手順 2 で調べたもの。`localhost` ではなく実際の IP を使う）

**ファイアウォール注意点:**
- Mac の場合、初回アクセス時に「ネットワーク接続を許可しますか？」と聞かれたら許可
- Windows の場合、Windows Defender Firewall でポート 8000 のインバウンドを許可する必要あり

### 方法 B: GitHub Pages で公開（リモート実施・複数参加者向け）

リポジトリが GitHub にある場合、無料で静的サイトとして公開できます。

1. GitHub のリポジトリ設定 → **Pages** を開く
2. **Source** を `main` ブランチの `/` (root) または `/identification-task-app` フォルダに設定
3. 数分後、`https://<ユーザー名>.github.io/<リポジトリ名>/identification-task-app/` でアクセス可能になる
4. その URL を参加者に共有する

⚠️ プライベートリポジトリの音声ファイルを公開したくない場合は方法 A か C を使ってください。

### 方法 C: Netlify Drop / Cloudflare Pages（GitHub なしで公開）

1. [Netlify Drop](https://app.netlify.com/drop) を開く
2. `identification-task-app/` フォルダを丸ごとブラウザ画面にドラッグ&ドロップ
3. 発行された URL を参加者に共有

無料・アカウント登録なしで使えますが、URL は公開されるため URL を知っている人なら誰でもアクセスできます。

### スマホ参加者への案内（テンプレート）

> 実験への協力ありがとうございます。以下の手順で進めてください。
>
> 1. **イヤホンまたはヘッドホン** を接続してください（普段使っているもので OK）
> 2. **iPhone の方は本体側面の「消音スイッチ」を OFF**（オレンジが見えない状態）にしてください
> 3. 静かな環境で、URL をブラウザで開いてください: `https://...`
> 4. 「音量チェック」ボタンでテスト音を再生し、聞きやすい音量に合わせてください
> 5. 参加者ID を入力して開始してください
> 6. 全 20 試行が終わると、「✓ 結果を保存しました」と表示されます。
>    お疲れさまでした。ブラウザを閉じていただいて構いません。

## 注意事項

- **file:// 直開きの制限**: ブラウザ（特に Chrome / Edge）はローカルファイルからの
  音声リソース読み込みを制限することがあります。音声が読み込めない場合は、
  Python 簡易サーバーや VS Code Live Server 経由で開いてください。
- **iPhone の消音スイッチ**: iOS Safari は本体側面の消音スイッチが ON だと
  HTML5 音声が再生されません。スイッチをご確認ください。
- **画面ロック**: スマホで実施する場合、実験中に画面が自動ロックすると
  実験が中断されます。本アプリは Wake Lock API で自動ロックを抑制しますが、
  HTTPS でアクセスしないと動作しないため、念のため設定アプリで
  「自動ロック」を長め（または「なし」）に設定することをおすすめします。
- **ブラウザ自動再生制限**: ユーザー操作（「再生」ボタンのクリック）をきっかけに
  音声を再生する設計のため、通常は問題ありません。
- **対応ブラウザ**: 最新版の Chrome / Edge / Firefox / Safari（iOS / macOS / Windows / Android）。
- **音声ファイルの形式**: `.wav` のほか `.mp3` / `.m4a` / `.ogg` などブラウザが
  対応する形式が使えます。スマホ通信量を抑えたい場合は `.mp3` 等の圧縮形式を推奨。

## ライセンス

研究・教育目的での自由な改変・利用が可能です。
