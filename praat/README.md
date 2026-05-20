# Go-on Lab — English Trainer (Praat edition)

シャドーイングと瞬間英作文の練習が Praat 1 本でできるスクリプトです。

## 必要なもの

- [Praat](https://www.fon.hum.uva.nl/praat/) 6.1 以降
  （eSpeak-NG ベースの `SpeechSynthesizer` を内蔵しているバージョン）

## 起動方法

1. Praat を起動する
2. **Praat → Open Praat script…** で `english-trainer.praat` を開く
3. スクリプトウィンドウの **Run → Run** （または `Ctrl+R` / `Cmd+R`）

最初のダイアログでモード・レベル・音声速度を選び、**Start** を押すと
トレーニングが始まります。

## 操作

### Shadowing  シャドーイング

| ボタン   | 動作                              |
| -------- | --------------------------------- |
| ▶ Play   | 英文を合成音声で再生              |
| Show JA  | 日本語訳を表示                    |
| Prev / Next | 前 / 次の例文へ                |
| Menu     | メインメニューに戻る              |

### Composition  瞬間英作文

| ボタン        | 動作                                            |
| ------------- | ----------------------------------------------- |
| Your english  | 入力欄に英訳をタイプ                            |
| Check         | 入力と模範解答を比較し ◎/○/△ を判定             |
| Show answer   | 入力せずに模範解答を表示                        |
| Skip          | 答え合わせをせず次へ                            |
| Menu          | メインメニューに戻る                            |

判定後の **Model answer** ダイアログで **▶ Play** を押すと
模範解答の発音が再生されます。

## 音声が出ないとき

- OS の音量・出力デバイスを確認
- メインメニューで **Speed: Slow** を選んで再試行
  （遅い方が eSpeak の合成が安定しやすい）
- Praat の **Info ウィンドウ** にエラーが出ていないか確認

## カスタマイズ

例文は `english-trainer.praat` 冒頭の `en$#` / `ja$#` / `level$#` を
編集すれば差し替えできます（3 つの配列は同じインデックスで対応）。
