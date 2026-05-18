# スマホで動作確認するまでの最短手順

「自分のPCで起動 → Cloudflare Quick Tunnel で公開 → スマホで開く」 を1コマンドで行うための手順です。

## 必要なもの

- Node.js 20+
- `cloudflared`（Cloudflareアカウント不要・無料・24時間の使い捨てURL）

### `cloudflared` のインストール

| OS | コマンド |
|---|---|
| macOS | `brew install cloudflared` |
| Windows | `winget install --id Cloudflare.cloudflared` |
| Linux (x86_64) | `curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared && chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/` |

## 起動

```bash
git clone https://github.com/labphonlab/go-on-lab.git
cd go-on-lab
npm install
npm run quickstart
```

`quickstart` が以下を自動で行います:

1. `.env.local` を作成し、`ADMIN_PASSWORD` を自動生成
2. 本番ビルドを作成（初回 〜30秒、2回目以降は変更がなければスキップ）
3. `next start` を本番モードで起動
4. `cloudflared tunnel --url http://localhost:3000` を起動
5. 発行された `https://*.trycloudflare.com` URL とパスワードを画面に表示

> なぜ本番モードか — Next.js の開発モード (`next dev`) は WebSocket と DevTools セグメントを使うため、Cloudflare Quick Tunnel + iOS Safari の組み合わせでハイドレーション (JS反映) が安定しません。本番モードはバンドルが小さく副作用が少ないので、スマホで確実に動きます。
>
> コードを書き換えながら自分のスマホで検証したい場合は `QUICKSTART_DEV=1 npm run quickstart` で開発モードに切り替えられます（PCのブラウザ向け）。
>
> ビルドを強制的に作り直したいときは `QUICKSTART_REBUILD=1 npm run quickstart`。

```
  Go-on Lab is live on your phone

  被験者用URL   : https://xxxxxx.trycloudflare.com/e/default
  管理パネル    : https://xxxxxx.trycloudflare.com/admin
  管理パスワード: a1b2c3d4e5f6

  停止: Ctrl+C
```

## 使い方

### 自分のスマホで動作確認

1. 上記の **被験者用URL** をスマホで開く（メールでURL送る／QRコード変換アプリでスキャン）
2. 同意 → デモグラ → 音声有効化 → 音響チェック → 練習 → 本試行 → 結果
3. 結果は自動的にPCの `data/results/default/` に保存される

### 自分で実験設計を作りたい

1. PC側で **管理パネル URL** を開く
2. 表示された管理パスワードでログイン
3. 「新規実験を作成」→ ID入力（例: `pilot01`）
4. タブで設定（基本情報・刺激・階段法・…）→ ステータスを「公開」
5. 「共有 & 結果」タブで `https://xxxxxx.trycloudflare.com/e/pilot01` を取得

### 終了

- `Ctrl+C` で `npm run quickstart` を停止すれば Next.js と cloudflared が同時に終了
- `cloudflared` の Quick Tunnel URL は最大24時間で失効。再起動すると新しいURLになる

## トラブルシューティング

- **「cloudflared が見つかりません」と出る** — 上の表からインストールしてください。`cloudflared --version` で動作確認できればOK。
- **iOS Safari で音が出ない** — `/e/default` の「音声を開始」ボタンを必ずタップしてから音量調整。AudioContext は最初のユーザー操作でしか起動できません。
- **スマホで「安全ではありません」警告** — Quick Tunnel は HTTPS なので通常出ません。出る場合は `.trycloudflare.com` のドメインが取り消された可能性。`Ctrl+C` で再起動してください。

## 本番運用に進むとき

スマホ動作確認に満足したら、データ住所が東京の Cloud Run + Firestore へ移行することを推奨します。詳細は [`DEPLOY.md`](./DEPLOY.md) を参照。
