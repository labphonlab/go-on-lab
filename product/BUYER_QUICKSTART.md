# 購入者向けクイックスタートガイド

ご購入ありがとうございます。最短 **30 分** で実験を開始できます。

## ステップ概要

```
1. リポジトリにアクセス             [3 分]
2. Apps Script を準備               [10 分]
3. アプリ側に URL を貼り付け        [3 分]
4. GitHub Pages 等で公開            [5 分]
5. 自分でフルテスト                  [10 分]
─────────────────────────────────────
合計約 30 分
```

## ステップ 1: リポジトリへのアクセス

購入確認メールに記載された GitHub プライベートリポジトリへの招待リンクをクリックし、
ご自身の GitHub アカウントで accept してください。

clone:
```bash
git clone https://github.com/[組織名]/[購入者リポジトリ名].git
cd [購入者リポジトリ名]
```

## ステップ 2: Apps Script の準備

データ保存先となる Google Sheets と、それに紐づく Apps Script を設定します。

### 2-1. 空のスプレッドシートを作成

ブラウザで以下を開く（自動で新規シートが作成されます）:
```
https://sheets.new
```

任意の名前を付ける（例: `<研究名>_data`）。

### 2-2. Apps Script エディタを開く

「拡張機能」 → 「Apps Script」

### 2-3. コードを貼り付け

`identification-task-app/APPS_SCRIPT.gs` の内容を**全文コピー**して
Apps Script エディタに**貼り付け** → 💾 保存。

コード内の以下を編集:
```javascript
const RESEARCHER_EMAIL = "your-email@example.com";  // エラー通知先
```

### 2-4. デプロイ

1. 右上「デプロイ」→「新しいデプロイ」
2. 種類: **ウェブアプリ**
3. 設定:
   - 次のユーザーとして実行: **自分**
   - アクセスできるユーザー: **全員**
4. 「デプロイ」
5. 権限承認ダイアログで「許可」
6. 表示された**ウェブアプリ URL**をコピー

## ステップ 3: アプリ側の URL 設定

`identification-task-app/index.html` を編集し、`dataServerUrl` をステップ 2-4 でコピーした URL に書き換え:

```javascript
const DEFAULT_CONFIG = {
  ...
  dataServerUrl: "https://script.google.com/macros/s/.../exec",  // ← ここに貼り付け
  ...
};
```

## ステップ 4: 公開（被験者がアクセスできるようにする）

### 方法 A: GitHub Pages（推奨、無料）

1. リポジトリの **Settings → Pages**
2. **Source**: `Deploy from a branch`
3. **Branch**: `main`、**Folder**: `/ (root)`
4. **Save**
5. 数分待つ → 表示された URL が公開アドレス
   例: `https://[organization].github.io/[repo]/identification-task-app/`

### 方法 B: 大学・組織サーバー
`identification-task-app/` フォルダ全体を、お使いの Web サーバーにアップロード。

### 方法 C: Netlify Drop（即時、アカウント不要）
<https://app.netlify.com/drop> に `identification-task-app/` フォルダをドラッグ＆ドロップ。

## ステップ 5: 動作確認

公開された URL を**自分のスマホで**開いて、フル試行（同意 → デモグラフィック → 練習 → 本試行 → 結果）を 1 回完走してください。

確認ポイント:
- [ ] 音声が再生される（iPhone は消音スイッチ OFF）
- [ ] 各画面で次へ進める
- [ ] 結果画面が表示される
- [ ] スプレッドシートに **`participants` と `results_identification` の 2 シート**が自動作成される
- [ ] 各シートにデータが入っている

## ステップ 6: 実験設定の調整（任意）

設定パネル `?config=1` から GUI で設定変更:

```
https://[your-url]/identification-task-app/?config=1
```

変更可能項目:
- パラダイム（Identification / AX / AXB / Rating）
- 刺激リスト
- 試行数・休憩設定
- 回答ボタンのラベル
- 同意・教示文言

「保存して実験を開始」を押すと、設定が `localStorage` に永続化されます。

## ステップ 7: 被験者への配布

以下を含めた募集メール / 募集ポスターを作成:

- 実験 URL
- 所要時間（約 7〜10 分）
- 必要なもの（イヤホン）
- iPhone の方は消音スイッチ OFF の注意

## トラブルシューティング

| 症状 | 対処 |
|---|---|
| 音声が再生されない | HTTPS 経由か確認。iPhone は消音スイッチ OFF |
| データがシートに入らない | `dataServerUrl` の URL が正しいか、Apps Script の「全員」アクセス設定か確認 |
| エラーメールが大量に来る | 設定確認後に来なくなる。詳細は `errors` シートで |
| 設定パネルが出ない | `?config=1` の `?` を `#` と間違えていないか |

## サポート

| プラン | サポート期間 | 連絡先 |
|---|---|---|
| Standard | 購入後 30 日 | `support@labphonlab.example` |
| Pro | 購入後 6 ヶ月 + Zoom 1 回 | `pro-support@labphonlab.example` |

メールには下記を含めるとスムーズです:
- ライセンス購入時のメールアドレス
- 該当する URL（公開 URL や設定パネル）
- スクリーンショット
- 試したこと
