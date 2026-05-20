# ============================================================
#  Go-on Lab. — English Trainer (Praat edition)
#  シャドーイング & 瞬間英作文
#
#  Praat 6.1 以降 (eSpeak-NG ベースの SpeechSynthesizer を使用)
#
#  起動方法:
#    1. Praat を起動
#    2. メニュー: Praat → Open Praat script...
#    3. このファイル (english-trainer.praat) を選択
#    4. スクリプトウィンドウ右下の "Run" ボタンを押す
#       (またはメニュー Run → Run, あるいは Ctrl+R / Cmd+R)
#
#  動作環境メモ:
#    - スクリプトのファイル文字コードは UTF-8。
#    - 音声合成は OS の eSpeak-NG (Praat 同梱) を使うので
#      別途インストールは不要。
#    - 各ダイアログの "Menu" ボタンでメインメニューに戻り、
#      メインメニューの "Quit" で終了します。
# ============================================================

clearinfo
writeInfoLine: "Go-on Lab — English Trainer (Praat edition)"
appendInfoLine: "シャドーイング & 瞬間英作文"
appendInfoLine: ""

# ============================================================
#   Sentence Bank   (en / ja / level がインデックスで対応)
# ============================================================
en$# = {
... "I drink coffee every morning.",
... "He goes to the office by train.",
... "It looks like it will rain today.",
... "My younger sister loves dogs.",
... "We have dinner at eight.",
... "She plays the piano well.",
... "This book is very interesting.",
... "I want to buy new shoes.",
... "They are playing soccer in the park.",
... "The convenience store is on that corner.",
... "If you have time, why don't we go to a movie together?",
... "The movie I watched yesterday was more interesting than I had expected.",
... "He didn't try to explain why he was late for the meeting.",
... "I'm not sure whether I should take on the job.",
... "Could you tell me what you are thinking?",
... "This product can be used for more than ten years.",
... "The more experience you gain, the more confident you become.",
... "I didn't expect her to come back to her country so soon.",
... "I had no choice but to accept the proposal.",
... "If the weather is nice, I'm planning to go hiking tomorrow.",
... "His remarks brilliantly captured the essence of the issue.",
... "If we had made the decision sooner, things wouldn't have come to this.",
... "We shouldn't underestimate the impact the new regulation will have on the entire industry.",
... "Whether the project succeeds depends on the cooperation of everyone involved.",
... "She is less a mere colleague than a trustworthy person to turn to for advice.",
... "Advances in technology are fundamentally changing the way we work.",
... "In order to solve the problem, we first need to identify its cause.",
... "His speech struck a deep chord with the audience.",
... "We have to adjust our strategy flexibly in response to changes in the market.",
... "This is exactly what people mean by 'easier said than done.'"
... }

ja$# = {
... "私は毎朝コーヒーを飲みます。",
... "彼は電車で会社に行きます。",
... "今日は雨が降りそうです。",
... "私の妹は犬が大好きです。",
... "私たちは8時に夕食を食べます。",
... "彼女はピアノを上手に弾きます。",
... "この本はとても面白いです。",
... "私は新しい靴を買いたいです。",
... "彼らは公園でサッカーをしています。",
... "コンビニはあの角にあります。",
... "もし時間があれば、一緒に映画を見に行きませんか？",
... "昨日見た映画は、私が想像していたより面白かったです。",
... "彼は会議に遅れた理由を説明しようとしませんでした。",
... "私はその仕事を引き受けるべきかどうか迷っています。",
... "あなたが何を考えているのか教えてくれませんか？",
... "この製品は10年以上使い続けることができます。",
... "経験を積めば積むほど、自信がついてきます。",
... "彼女がそんなに早く帰国するとは思っていませんでした。",
... "私はその提案を受け入れざるを得ませんでした。",
... "天気が良ければ、明日ハイキングに行く予定です。",
... "彼の発言は、その問題の本質を見事に捉えていた。",
... "もっと早く決断していれば、こんな事態にはならなかっただろう。",
... "新しい規制が業界全体に与える影響を、私たちは過小評価すべきではない。",
... "そのプロジェクトが成功するかどうかは、関係者の協力次第だ。",
... "彼女は単なる同僚というよりも、信頼できる相談相手だ。",
... "技術の進歩は、私たちの働き方を根本から変えつつある。",
... "問題を解決するためには、まずその原因を特定する必要がある。",
... "彼のスピーチは聴衆の心を強く打つものだった。",
... "市場の変化に応じて戦略を柔軟に調整しなければならない。",
... "言うは易く行うは難し、とはまさにこのことだ。"
... }

level$# = {
... "beginner", "beginner", "beginner", "beginner", "beginner",
... "beginner", "beginner", "beginner", "beginner", "beginner",
... "intermediate", "intermediate", "intermediate", "intermediate", "intermediate",
... "intermediate", "intermediate", "intermediate", "intermediate", "intermediate",
... "advanced", "advanced", "advanced", "advanced", "advanced",
... "advanced", "advanced", "advanced", "advanced", "advanced"
... }

n_total = size (en$#)

# ============================================================
#   Speech Synthesizer (eSpeak-NG)
# ============================================================
synth = Create SpeechSynthesizer: "English (Great Britain)", "Female1"

# 音声出力の初期設定 (44.1 kHz, word gap 0s, pitch 50/50, 160 wpm, IPA)
Speech output settings: 44100, 0.01, 0.0, 50, 160, "Kirshenbaum_espeak"

# ============================================================
#   Main loop
# ============================================================
quit = 0
while not quit
   beginPause: "Go-on Lab — English Trainer"
      comment: "“Go on to your goal.”"
      comment: "シャドーイングと瞬間英作文の練習アプリ"
      comment: ""
      choice: "Mode", 1
         option: "Shadowing    シャドーイング"
         option: "Composition  瞬間英作文"
      choice: "Level", 1
         option: "Beginner      初級"
         option: "Intermediate  中級"
         option: "Advanced      上級"
      choice: "Speed", 2
         option: "Slow    (130 wpm)"
         option: "Normal  (160 wpm)"
         option: "Fast    (200 wpm)"
   clicked = endPause: "Quit", "Start", 2, 1

   if clicked = 1
      quit = 1
   else
      # ---- selected level string
      if level = 1
         lv$ = "beginner"
      elsif level = 2
         lv$ = "intermediate"
      else
         lv$ = "advanced"
      endif

      # ---- selected wpm
      if speed = 1
         wpm = 130
      elsif speed = 2
         wpm = 160
      else
         wpm = 200
      endif

      # ---- build filtered index list
      n_filtered = 0
      indices# = zero# (n_total)
      for i from 1 to n_total
         if level$#[i] = lv$
            n_filtered += 1
            indices#[n_filtered] = i
         endif
      endfor

      # ---- apply speech rate
      selectObject: synth
      Speech output settings: 44100, 0.01, 0.0, 50, wpm, "Kirshenbaum_espeak"

      if mode = 1
         @shadowing: n_filtered
      else
         @composition: n_filtered
      endif
   endif
endwhile

# ============================================================
#   Cleanup
# ============================================================
selectObject: synth
Remove
appendInfoLine: ""
appendInfoLine: "Session ended. お疲れさまでした。"


# ============================================================
#   PROCEDURE: shadowing
# ============================================================
procedure shadowing: .n
   .i = 1
   .show_ja = 0
   .running = 1
   while .running
      .idx = indices#[.i]
      .en$ = en$#[.idx]
      .ja$ = ja$#[.idx]

      beginPause: "Shadowing  —  シャドーイング"
         comment: "[ " + string$ (.i) + " / " + string$ (.n) + " ]    Level: " + lv$
         comment: ""
         comment: "EN:  " + .en$
         if .show_ja
            comment: "JA:  " + .ja$
         else
            comment: "JA:  (タップして表示 → 'Show JA')"
         endif
         comment: ""
         comment: "▶ Play を押して音声を聴き、0.5〜1秒遅れで影のように発音しましょう。"
      .b = endPause: "Menu", "Prev", "Show JA", "▶ Play", "Next", 4

      if .b = 1
         .running = 0
      elsif .b = 2
         .i -= 1
         if .i < 1
            .i = .n
         endif
         .show_ja = 0
      elsif .b = 3
         .show_ja = 1
      elsif .b = 4
         @speak: .en$
      elsif .b = 5
         .i += 1
         if .i > .n
            .i = 1
         endif
         .show_ja = 0
      endif
   endwhile
endproc


# ============================================================
#   PROCEDURE: composition
# ============================================================
procedure composition: .n
   .i = 1
   .correct = 0
   .total = 0
   .running = 1
   while .running
      .idx = indices#[.i]
      .en$ = en$#[.idx]
      .ja$ = ja$#[.idx]

      beginPause: "Instant Composition  —  瞬間英作文"
         comment: "[ " + string$ (.i) + " / " + string$ (.n) + " ]    Level: " + lv$
         comment: "Score: " + string$ (.correct) + " / " + string$ (.total)
         comment: ""
         comment: "JA:  " + .ja$
         comment: ""
         sentence: "Your english", ""
      .b = endPause: "Menu", "Skip", "Show answer", "Check", 4

      if .b = 1
         .running = 0
      elsif .b = 2
         .i = .i + 1
         if .i > .n
            .i = 1
         endif
      elsif .b = 3
         @show_answer: .en$, "", 0, ""
         .i = .i + 1
         if .i > .n
            .i = 1
         endif
      elsif .b = 4
         @similarity: your_english$, .en$
         .total += 1
         if similarity.score >= 0.99
            .verdict$ = "◎ Perfect — 完璧！"
            .correct += 1
         elsif similarity.score >= 0.7
            .verdict$ = "○ Close — 意味は通じます  (similarity " + fixed$ (similarity.score, 2) + ")"
            .correct += 1
         else
            .verdict$ = "△ Try again  (similarity " + fixed$ (similarity.score, 2) + ")"
         endif
         @show_answer: .en$, your_english$, 1, .verdict$
         .i = .i + 1
         if .i > .n
            .i = 1
         endif
      endif
   endwhile
endproc


# ============================================================
#   PROCEDURE: show_answer
# ============================================================
procedure show_answer: .en$, .your$, .has_verdict, .verdict$
   .keep = 1
   while .keep
      beginPause: "Model answer  —  模範解答"
         if .has_verdict
            comment: .verdict$
            comment: ""
         endif
         comment: "Model:  " + .en$
         if .has_verdict
            comment: "Yours:  " + .your$
         endif
         comment: ""
         comment: "▶ Play で発音を聴いて、3回口に出して繰り返しましょう。"
      .b = endPause: "▶ Play", "Next", 2
      if .b = 1
         @speak: .en$
      else
         .keep = 0
      endif
   endwhile
endproc


# ============================================================
#   PROCEDURE: speak  —  英文を音声合成して再生
# ============================================================
procedure speak: .text$
   selectObject: synth
   sound = To Sound: .text$, "no"
   Play
   removeObject: sound
endproc


# ============================================================
#   PROCEDURE: similarity  (word overlap)
# ============================================================
procedure similarity: .a$, .b$
   @normalize: .a$
   .na$ = normalize.out$
   @normalize: .b$
   .nb$ = normalize.out$

   if .na$ = .nb$
      .score = 1
   elsif length (.na$) = 0 or length (.nb$) = 0
      .score = 0
   else
      @count_words: .na$
      .nA = count_words.count
      @count_words: .nb$
      .nB = count_words.count

      .padded$ = " " + .nb$ + " "
      .matches = 0
      .rest$ = .na$
      while length (.rest$) > 0
         .pos = index (.rest$, " ")
         if .pos > 0
            .w$ = left$ (.rest$, .pos - 1)
            .rest$ = mid$ (.rest$, .pos + 1, length (.rest$))
         else
            .w$ = .rest$
            .rest$ = ""
         endif
         if length (.w$) > 0
            if index (.padded$, " " + .w$ + " ") > 0
               .matches += 1
            endif
         endif
      endwhile

      .maxN = .nA
      if .nB > .maxN
         .maxN = .nB
      endif
      if .maxN > 0
         .score = .matches / .maxN
      else
         .score = 0
      endif
   endif
endproc


# ============================================================
#   PROCEDURE: normalize  (lowercase, strip punctuation)
# ============================================================
procedure normalize: .text$
   .out$ = .text$
   .out$ = replace_regex$ (.out$, "[\.,!?;:""'`]", "", 0)
   .out$ = replace_regex$ (.out$, "\s+", " ", 0)
   .out$ = replace_regex$ (.out$, "^ ", "", 0)
   .out$ = replace_regex$ (.out$, " $", "", 0)
   # Praat の tolower$ は ASCII のみだが、英文判定なので十分。
   .lower$ = ""
   for .k from 1 to length (.out$)
      .ch$ = mid$ (.out$, .k, 1)
      .code = unicode (.ch$)
      if .code >= 65 and .code <= 90
         .ch$ = chr$ (.code + 32)
      endif
      .lower$ = .lower$ + .ch$
   endfor
   .out$ = .lower$
endproc


# ============================================================
#   PROCEDURE: count_words
# ============================================================
procedure count_words: .text$
   .count = 0
   .rest$ = .text$
   while length (.rest$) > 0
      .pos = index (.rest$, " ")
      if .pos > 0
         .w$ = left$ (.rest$, .pos - 1)
         .rest$ = mid$ (.rest$, .pos + 1, length (.rest$))
      else
         .w$ = .rest$
         .rest$ = ""
      endif
      if length (.w$) > 0
         .count += 1
      endif
   endwhile
endproc
