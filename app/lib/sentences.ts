export type Sentence = {
  id: number;
  en: string;
  ja: string;
  level: "beginner" | "intermediate" | "advanced";
};

export type Level = Sentence["level"];

export const LEVEL_LABEL: Record<Level, string> = {
  beginner: "初級",
  intermediate: "中級",
  advanced: "上級",
};

export const SENTENCES: Sentence[] = [
  // ---- Beginner ----
  { id: 1, level: "beginner", ja: "私は毎朝コーヒーを飲みます。", en: "I drink coffee every morning." },
  { id: 2, level: "beginner", ja: "彼は電車で会社に行きます。", en: "He goes to the office by train." },
  { id: 3, level: "beginner", ja: "今日は雨が降りそうです。", en: "It looks like it will rain today." },
  { id: 4, level: "beginner", ja: "私の妹は犬が大好きです。", en: "My younger sister loves dogs." },
  { id: 5, level: "beginner", ja: "私たちは8時に夕食を食べます。", en: "We have dinner at eight." },
  { id: 6, level: "beginner", ja: "彼女はピアノを上手に弾きます。", en: "She plays the piano well." },
  { id: 7, level: "beginner", ja: "この本はとても面白いです。", en: "This book is very interesting." },
  { id: 8, level: "beginner", ja: "私は新しい靴を買いたいです。", en: "I want to buy new shoes." },
  { id: 9, level: "beginner", ja: "彼らは公園でサッカーをしています。", en: "They are playing soccer in the park." },
  { id: 10, level: "beginner", ja: "コンビニはあの角にあります。", en: "The convenience store is on that corner." },

  // ---- Intermediate ----
  { id: 11, level: "intermediate", ja: "もし時間があれば、一緒に映画を見に行きませんか？", en: "If you have time, why don't we go to a movie together?" },
  { id: 12, level: "intermediate", ja: "昨日見た映画は、私が想像していたより面白かったです。", en: "The movie I watched yesterday was more interesting than I had expected." },
  { id: 13, level: "intermediate", ja: "彼は会議に遅れた理由を説明しようとしませんでした。", en: "He didn't try to explain why he was late for the meeting." },
  { id: 14, level: "intermediate", ja: "私はその仕事を引き受けるべきかどうか迷っています。", en: "I'm not sure whether I should take on the job." },
  { id: 15, level: "intermediate", ja: "あなたが何を考えているのか教えてくれませんか？", en: "Could you tell me what you are thinking?" },
  { id: 16, level: "intermediate", ja: "この製品は10年以上使い続けることができます。", en: "This product can be used for more than ten years." },
  { id: 17, level: "intermediate", ja: "経験を積めば積むほど、自信がついてきます。", en: "The more experience you gain, the more confident you become." },
  { id: 18, level: "intermediate", ja: "彼女がそんなに早く帰国するとは思っていませんでした。", en: "I didn't expect her to come back to her country so soon." },
  { id: 19, level: "intermediate", ja: "私はその提案を受け入れざるを得ませんでした。", en: "I had no choice but to accept the proposal." },
  { id: 20, level: "intermediate", ja: "天気が良ければ、明日ハイキングに行く予定です。", en: "If the weather is nice, I'm planning to go hiking tomorrow." },

  // ---- Advanced ----
  { id: 21, level: "advanced", ja: "彼の発言は、その問題の本質を見事に捉えていた。", en: "His remarks brilliantly captured the essence of the issue." },
  { id: 22, level: "advanced", ja: "もっと早く決断していれば、こんな事態にはならなかっただろう。", en: "If we had made the decision sooner, things wouldn't have come to this." },
  { id: 23, level: "advanced", ja: "新しい規制が業界全体に与える影響を、私たちは過小評価すべきではない。", en: "We shouldn't underestimate the impact the new regulation will have on the entire industry." },
  { id: 24, level: "advanced", ja: "そのプロジェクトが成功するかどうかは、関係者の協力次第だ。", en: "Whether the project succeeds depends on the cooperation of everyone involved." },
  { id: 25, level: "advanced", ja: "彼女は単なる同僚というよりも、信頼できる相談相手だ。", en: "She is less a mere colleague than a trustworthy person to turn to for advice." },
  { id: 26, level: "advanced", ja: "技術の進歩は、私たちの働き方を根本から変えつつある。", en: "Advances in technology are fundamentally changing the way we work." },
  { id: 27, level: "advanced", ja: "問題を解決するためには、まずその原因を特定する必要がある。", en: "In order to solve the problem, we first need to identify its cause." },
  { id: 28, level: "advanced", ja: "彼のスピーチは聴衆の心を強く打つものだった。", en: "His speech struck a deep chord with the audience." },
  { id: 29, level: "advanced", ja: "市場の変化に応じて戦略を柔軟に調整しなければならない。", en: "We have to adjust our strategy flexibly in response to changes in the market." },
  { id: 30, level: "advanced", ja: "言うは易く行うは難し、とはまさにこのことだ。", en: "This is exactly what people mean by 'easier said than done.'" },
];

export function sentencesByLevel(level: Level): Sentence[] {
  return SENTENCES.filter((s) => s.level === level);
}
