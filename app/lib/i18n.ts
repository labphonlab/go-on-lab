export type Locale = "ja" | "en" | "ko" | "zh";
export const LOCALES: Locale[] = ["ja", "en", "ko", "zh"];

export const LOCALE_LABEL: Record<Locale, string> = {
  ja: "日本語",
  en: "English",
  ko: "한국어",
  zh: "中文",
};

export interface LocalizedText {
  ja: string;
  en: string;
  ko: string;
  zh: string;
}

export function emptyLocalized(): LocalizedText {
  return { ja: "", en: "", ko: "", zh: "" };
}

export function pickLocalized(t: LocalizedText, locale: Locale, fallback: Locale = "en"): string {
  return t[locale] || t[fallback] || t.ja || t.en || "";
}

export function detectLocale(
  acceptHeader: string | null | undefined,
  enabled: Locale[],
  fallback: Locale,
): Locale {
  if (!acceptHeader) return enabled.includes(fallback) ? fallback : enabled[0];
  const tags = acceptHeader
    .split(",")
    .map((s) => s.trim().split(";")[0].toLowerCase());
  for (const tag of tags) {
    const base = tag.split("-")[0];
    if (base === "ja" && enabled.includes("ja")) return "ja";
    if (base === "en" && enabled.includes("en")) return "en";
    if (base === "ko" && enabled.includes("ko")) return "ko";
    if ((base === "zh" || base === "yue") && enabled.includes("zh")) return "zh";
  }
  return enabled.includes(fallback) ? fallback : enabled[0];
}

export interface Messages {
  common: {
    next: string;
    back: string;
    continue: string;
    cancel: string;
    submit: string;
    loading: string;
    yes: string;
    no: string;
    language: string;
  };
  header: {
    subtitleDefault: string;
  };
  consent: {
    heading: string;
    intro1: string;
    intro2: string;
    intro3: string;
    intro4: string;
    versionLabel: string;
    institutionLabel: string;
    irbLabel: string;
    contactLabel: string;
    agreementsHeading: string;
    agreeAdult: (minAge: number) => string;
    agreeHearing: string;
    agreeHeadphones: string;
    agreeConsent: string;
    initialsLabel: string;
    initialsHelp: string;
    declineLink: string;
    agreeButton: string;
    progressChecks: (done: number, total: number) => string;
    progressInitials: (ok: boolean) => string;
    needCheckMore: (n: number) => string;
    needInitials: string;
    allReady: string;
  };
  demographics: {
    heading: string;
    age: string;
    ageRange: (min: number, max: number) => string;
    ageInvalid: (min: number, max: number) => string;
    gender: string;
    handedness: string;
    nativeLanguage: string;
    otherLanguages: string;
    otherLanguagesPlaceholder: string;
    musicalTrainingYears: string;
    hearing: string;
    hearingAids: string;
    headphoneType: string;
    environment: string;
    quiet: string;
    noisy: string;
    select: string;
    genderOpts: { female: string; male: string; nonBinary: string; preferNotToSay: string };
    handednessOpts: { right: string; left: string; ambidextrous: string };
    hearingOpts: { none: string; mild: string; moderate: string; severe: string; unsure: string };
    headphoneOpts: { overEar: string; onEar: string; inEar: string; earbuds: string; unknown: string };
  };
  audio: {
    heading: string;
    step1: string;
    step2: string;
    step3: string;
    step4: string;
    startButton: string;
    testButton: string;
    justRight: string;
    adjusting: string;
    errorInit: string;
  };
  headphone: {
    heading: string;
    instructions: string;
    preparing: string;
    playing: string;
    askDirection: string;
    left: string;
    both: string;
    right: string;
    cannotHear: string;
  };
  instructions: {
    headingPractice: string;
    headingMain: string;
    intro: string;
    flowDiagram: string;
    flowDetail: string;
    respondLabel: string;
    forcedChoice: string;
    practiceFeedback: string;
    mainNoFeedback: string;
    breakInfo: string;
    replayHelp: string;
    undoHelp: string;
    startPractice: string;
    startMain: string;
  };
  trial: {
    practiceLabel: string;
    mainLabel: string;
    askHigher: string;
    tone1Higher: string;
    tone2Higher: string;
    replay: string;
    undo: string;
    correct: string;
    incorrect: string;
    playing: string;
    nextTrial: string;
  };
  identification: {
    askLabel: string;
    practiceIntro: string;
    mainIntro: string;
    startPractice: string;
    startMain: string;
  };
  break: {
    heading: string;
    text: string;
    continueButton: string;
    waitSec: (s: number) => string;
    progressLabel: (n: number, pct: number) => string;
  };
  rest: {
    heading: string;
    accuracy: (correct: number, total: number, pct: number) => string;
    passed: string;
    failed: string;
    retry: string;
    proceed: string;
  };
  debrief: {
    heading: string;
    thanks: string;
    dlfLabel: string;
    dlfHelp: string;
    staircaseHeading: string;
    threshold: string;
    trialsLabel: (n: number, r: number) => string;
    dataHeading: string;
    participantIdLabel: string;
    dataIntro: string;
    uploading: string;
    uploaded: string;
    uploadError: string;
    dlMainCsv: string;
    dlMainTsv: string;
    dlPracticeCsv: string;
    dlHeadphoneCsv: string;
    dlAllJson: string;
    closeTab: string;
  };
  ineligible: {
    heading: string;
    text: string;
  };
}

export const MESSAGES: Record<Locale, Messages> = {
  ja: {
    common: {
      next: "次へ →",
      back: "戻る",
      continue: "続ける →",
      cancel: "中止",
      submit: "送信",
      loading: "読み込み中…",
      yes: "はい",
      no: "いいえ",
      language: "言語",
    },
    header: { subtitleDefault: "周波数弁別タスク" },
    consent: {
      heading: "研究参加へのご協力のお願い",
      intro1:
        "本実験は音声知覚に関する基礎研究の一環として実施されます。参加者は1000 Hz付近の純音を聴き、2区間のうち「より高い音」がどちらに含まれていたかを判断します。所要時間はおよそ15〜20分です。",
      intro2:
        "収集するデータ: 年齢・性別・利き手・母語・音楽訓練歴・聴覚状態などの基本情報、各試行の刺激パラメータ・反応・反応時間。氏名・連絡先などの個人を特定する情報は収集しません。データは匿名化IDの下で保存され、学術目的にのみ使用されます。",
      intro3:
        "リスクと利益: 短時間の音刺激のみを使用するため、身体的・心理的リスクは日常生活で経験する程度を超えません。参加への直接的な金銭的報酬はありません。",
      intro4:
        "任意性: 参加は完全に任意です。理由を述べることなく、いつでもブラウザのタブを閉じることで中断できます。中断時点までに収集されたデータは破棄されます。",
      versionLabel: "同意書バージョン",
      institutionLabel: "実施機関",
      irbLabel: "倫理審査番号",
      contactLabel: "問い合わせ先",
      agreementsHeading: "以下のすべてに同意して参加します",
      agreeAdult: (min) => `私は${min}歳以上であり、自らの意思で参加します。`,
      agreeHearing:
        "私の聴覚は実験を実施するうえで支障がないと自己判断しています（耳鳴り・難聴の急性症状はありません）。",
      agreeHeadphones: "ヘッドホンまたはイヤホンを装着し、静かな環境で実験を行います。",
      agreeConsent: "上記の説明を読み、研究目的でのデータ利用に同意します。",
      initialsLabel: "イニシャル (例: T.S.)",
      initialsHelp: "個人特定には使用されません。同意記録の一部として保存されます。",
      declineLink: "参加しない",
      agreeButton: "同意して参加する →",
      progressChecks: (d, total) => `同意項目 ${d}/${total}`,
      progressInitials: (ok) => (ok ? "イニシャル ✓" : "イニシャル 未入力"),
      needCheckMore: (n) => `あと ${n} 項目チェックしてください`,
      needInitials: "イニシャルを入力してください (2文字以上)",
      allReady: "準備OK · ボタンを押してください",
    },
    demographics: {
      heading: "基本情報",
      age: "年齢",
      ageRange: (min, max) => `${min}〜${max}歳`,
      ageInvalid: (min, max) => `${min}〜${max}の範囲で入力してください。`,
      gender: "性別",
      handedness: "利き手",
      nativeLanguage: "母語",
      otherLanguages: "その他に流暢な言語 (任意, カンマ区切り)",
      otherLanguagesPlaceholder: "English, 中文 など",
      musicalTrainingYears: "音楽の訓練・実技年数 (年)",
      hearing: "聴覚の自己評価",
      hearingAids: "補聴器の使用",
      headphoneType: "使用するヘッドホン/イヤホン",
      environment: "現在の環境は静かですか?",
      quiet: "静か",
      noisy: "騒がしい",
      select: "選択してください",
      genderOpts: { female: "女性", male: "男性", nonBinary: "ノンバイナリー", preferNotToSay: "回答しない" },
      handednessOpts: { right: "右利き", left: "左利き", ambidextrous: "両利き" },
      hearingOpts: { none: "問題なし", mild: "軽度", moderate: "中等度", severe: "重度", unsure: "わからない" },
      headphoneOpts: { overEar: "オーバーイヤー型", onEar: "オンイヤー型", inEar: "イヤホン (カナル型)", earbuds: "イヤホン (インナーイヤー型)", unknown: "わからない" },
    },
    audio: {
      heading: "音量の調整",
      step1: "ヘッドホンまたはイヤホンを装着してください。",
      step2: "下の「音声を開始」ボタンを押し、ブラウザの音声を有効化します。",
      step3: "「テスト音を再生」を押し、はっきり聞こえるが大きすぎない音量にデバイス側で調整してください。",
      step4: "本実験ではこの基準音より大きな音は出ません。",
      startButton: "音声を開始",
      testButton: "テスト音を再生",
      justRight: "ちょうど良い",
      adjusting: "調整中",
      errorInit: "音声システムを初期化できませんでした。ブラウザの音声権限を許可するか、別のブラウザをお試しください。",
    },
    headphone: {
      heading: "音響チェック",
      instructions: "音が再生されます。どちらの耳から聞こえたかを選んでください。両耳から同じように聞こえた場合は「両耳」を選びます。",
      preparing: "準備中...",
      playing: "再生中...",
      askDirection: "どちらから聞こえましたか?",
      left: "左耳",
      both: "両耳",
      right: "右耳",
      cannotHear: "音が聞こえない / 中止する",
    },
    instructions: {
      headingPractice: "練習試行の説明",
      headingMain: "本試行の説明",
      intro: "これから各試行で2つの音が連続して再生されます。2つの音はほぼ同じ高さですが、片方だけがわずかに高い音です。",
      flowDiagram: "音① → 短い無音 → 音② → 回答",
      flowDetail: "200 ms tone · 500 ms ISI · 200 ms tone · response",
      respondLabel: "どちらの音がより高かったかを、画面のボタン (または 1 / 2 キー) で回答してください。",
      forcedChoice: "正しいかどうか分からなくても、必ずどちらかを選んでください。違いが小さくて分からない場合も、感覚で選択して構いません。",
      practiceFeedback: "まず練習を行います。練習では正誤フィードバックが表示されます。",
      mainNoFeedback: "本試行ではフィードバックは表示されません。測定の妥当性を保つため、刺激の再生は1回のみです。",
      breakInfo: "一定の試行ごとに短い休憩が入ります。全体で約 10〜15 分です。",
      replayHelp: "練習中に音を聞き逃した場合は、回答前に「もう一度聴く」(Rキー) を押すと再生できます。",
      undoHelp: "押し間違いに気づいた場合は、回答直後に「↶ 前の回答を取り消す」(Uキー) を押すと、その試行をやり直せます。",
      startPractice: "練習を始める →",
      startMain: "本試行を始める →",
    },
    trial: {
      practiceLabel: "練習試行",
      mainLabel: "本試行",
      askHigher: "どちらの音が より高かった ですか?",
      tone1Higher: "音① が高かった",
      tone2Higher: "音② が高かった",
      replay: "もう一度聴く",
      undo: "↶ 前の回答を取り消す",
      correct: "○ 正解",
      incorrect: "× 不正解",
      playing: "音を再生中",
      nextTrial: "次の試行を準備中…",
    },
    identification: {
      askLabel: "どちらに聞こえましたか?",
      practiceIntro:
        "音節が再生されます。「ば」と「ぱ」のどちらに聞こえたかをタップしてください。練習では数試行のみ行います。",
      mainIntro:
        "音節が再生されます。「ば」と「ぱ」のどちらに聞こえたかをタップしてください。よく分からない場合も必ずどちらかを選んでください。",
      startPractice: "練習を始める →",
      startMain: "本試行を始める →",
    },
    break: {
      heading: "小休憩",
      text: "少し休んでください。準備ができたら下のボタンで続行してください。",
      continueButton: "続ける →",
      waitSec: (s) => `あと ${s} 秒…`,
      progressLabel: (n, pct) => `進捗: ${n} 試行完了 / 約 ${pct}%`,
    },
    rest: {
      heading: "練習完了",
      accuracy: (c, t, p) => `練習試行の正答率: ${p}%（${c} / ${t}）`,
      passed: "タスクを理解できているようです。本試行に進みます。",
      failed: "正答率が低めです。タスクをもう一度確認するために、練習をやり直すこともできます。",
      retry: "練習をやり直す",
      proceed: "本試行を開始 →",
    },
    debrief: {
      heading: "実験が完了しました",
      thanks: "ご協力ありがとうございました。",
      dlfLabel: "あなたの周波数差分閾値 (DLF)",
      dlfHelp: "この値は、1000 Hz の純音について、あなたが 70.7% の正答率で「より高い音」を判別できる最小の周波数差の推定値です（2-down/1-up 法による収束推定）。一般成人の典型値は 1〜5 Hz 程度です。",
      staircaseHeading: "階段法の収束",
      threshold: "閾値",
      trialsLabel: (n, r) => `${n} trials · ${r} reversals`,
      dataHeading: "データ",
      participantIdLabel: "参加者ID",
      dataIntro: "全データはCSV/TSV/JSON形式でダウンロードできます。",
      uploading: "サーバへ送信中…",
      uploaded: "✓ サーバ保存完了",
      uploadError: "⚠ サーバ送信に失敗。下のボタンからローカルへ保存してください。",
      dlMainCsv: "本試行 CSV",
      dlMainTsv: "本試行 TSV",
      dlPracticeCsv: "練習 CSV",
      dlHeadphoneCsv: "音響チェック CSV",
      dlAllJson: "全体 JSON",
      closeTab: "このタブを閉じて終了してください。",
    },
    ineligible: {
      heading: "参加を完了できませんでした",
      text: "ご協力ありがとうございました。前提条件を満たさなかったため、データは記録されませんでした。タブを閉じて終了してください。",
    },
  },
  en: {
    common: {
      next: "Next →",
      back: "Back",
      continue: "Continue →",
      cancel: "Cancel",
      submit: "Submit",
      loading: "Loading…",
      yes: "Yes",
      no: "No",
      language: "Language",
    },
    header: { subtitleDefault: "Frequency Discrimination Task" },
    consent: {
      heading: "Invitation to Participate",
      intro1:
        "This experiment is part of basic research on auditory perception. You will listen to pairs of pure tones near 1000 Hz and judge which of two intervals contained the higher-pitched tone. The session takes about 15–20 minutes.",
      intro2:
        "Data collected: age, gender, handedness, native language, musical training, self-reported hearing status, and per-trial stimulus parameters, responses, and reaction times. No personally identifying information (name, contact details) is collected. Data are stored under an anonymous ID and used only for academic purposes.",
      intro3:
        "Risks and benefits: The stimuli are brief tones at safe listening levels; physical and psychological risks do not exceed those of everyday life. There is no direct financial compensation.",
      intro4:
        "Voluntariness: Participation is entirely voluntary. You may stop at any time by closing the browser tab without giving a reason. Partial data collected up to that point will be discarded.",
      versionLabel: "Consent version",
      institutionLabel: "Institution",
      irbLabel: "IRB reference",
      contactLabel: "Contact",
      agreementsHeading: "I agree to all of the following and wish to participate",
      agreeAdult: (min) => `I am at least ${min} years old and am participating of my own free will.`,
      agreeHearing:
        "I believe my hearing is adequate for the task (no acute tinnitus or hearing loss).",
      agreeHeadphones: "I will wear headphones or earphones in a quiet environment.",
      agreeConsent: "I have read the above and consent to my data being used for research.",
      initialsLabel: "Initials (e.g., T.S.)",
      initialsHelp: "Used as part of the consent record only; not used to identify you.",
      declineLink: "I do not wish to participate",
      agreeButton: "I consent and want to begin →",
      progressChecks: (d, total) => `Agreements ${d}/${total}`,
      progressInitials: (ok) => (ok ? "Initials ✓" : "Initials missing"),
      needCheckMore: (n) =>
        `Please check ${n} more agreement${n === 1 ? "" : "s"}`,
      needInitials: "Please enter your initials (2+ characters)",
      allReady: "All set · tap the button to continue",
    },
    demographics: {
      heading: "Background Information",
      age: "Age",
      ageRange: (min, max) => `${min}–${max} years`,
      ageInvalid: (min, max) => `Please enter a value between ${min} and ${max}.`,
      gender: "Gender",
      handedness: "Handedness",
      nativeLanguage: "Native language",
      otherLanguages: "Other fluent languages (optional, comma-separated)",
      otherLanguagesPlaceholder: "e.g., Japanese, Chinese",
      musicalTrainingYears: "Years of musical training",
      hearing: "Self-reported hearing",
      hearingAids: "Use of hearing aids",
      headphoneType: "Headphones / earphones in use",
      environment: "Is your current environment quiet?",
      quiet: "Quiet",
      noisy: "Noisy",
      select: "Please select",
      genderOpts: { female: "Female", male: "Male", nonBinary: "Non-binary", preferNotToSay: "Prefer not to say" },
      handednessOpts: { right: "Right-handed", left: "Left-handed", ambidextrous: "Ambidextrous" },
      hearingOpts: { none: "No issues", mild: "Mild", moderate: "Moderate", severe: "Severe", unsure: "Unsure" },
      headphoneOpts: { overEar: "Over-ear", onEar: "On-ear", inEar: "In-ear (canal)", earbuds: "Earbuds", unknown: "Unsure" },
    },
    audio: {
      heading: "Adjust volume",
      step1: "Please put on headphones or earphones.",
      step2: "Tap “Start audio” below to enable browser audio.",
      step3: "Tap “Play test tone” and adjust your device volume so the tone is clearly audible but not too loud.",
      step4: "This experiment will not play anything louder than this reference tone.",
      startButton: "Start audio",
      testButton: "Play test tone",
      justRight: "Just right",
      adjusting: "Adjusting",
      errorInit: "Could not initialise audio. Please allow audio permissions or try a different browser.",
    },
    headphone: {
      heading: "Audio check",
      instructions: "A tone will play. Select which ear you heard it in. If you hear it equally in both, choose “Both”.",
      preparing: "Preparing…",
      playing: "Playing…",
      askDirection: "Which side did you hear?",
      left: "Left",
      both: "Both",
      right: "Right",
      cannotHear: "Can’t hear / cancel",
    },
    instructions: {
      headingPractice: "Practice instructions",
      headingMain: "Main task instructions",
      intro: "On each trial you will hear two short tones in succession. The two tones are almost the same pitch, but one of them is slightly higher.",
      flowDiagram: "Tone ① → short silence → Tone ② → response",
      flowDetail: "200 ms tone · 500 ms ISI · 200 ms tone · response",
      respondLabel: "Tap the button (or press 1 / 2) for the tone that sounded higher.",
      forcedChoice: "Even if you’re not sure, please make a guess. The task adapts to your performance, so it’s normal to feel uncertain.",
      practiceFeedback: "First, a short practice block. Feedback on accuracy is shown during practice only.",
      mainNoFeedback: "During the main task, no feedback is shown. To preserve measurement validity, replays are not allowed.",
      breakInfo: "Short breaks are inserted at intervals. The whole task takes about 10–15 minutes.",
      replayHelp: "During practice, if you missed a tone, tap “Replay” (R key) before responding.",
      undoHelp: "If you tap the wrong button by mistake, tap “Undo” (U key) immediately after to redo that trial.",
      startPractice: "Start practice →",
      startMain: "Start main task →",
    },
    trial: {
      practiceLabel: "PRACTICE",
      mainLabel: "MAIN TASK",
      askHigher: "Which tone was HIGHER?",
      tone1Higher: "Tone ① was higher",
      tone2Higher: "Tone ② was higher",
      replay: "Replay",
      undo: "↶ Undo previous response",
      correct: "○ Correct",
      incorrect: "× Incorrect",
      playing: "Playing tone",
      nextTrial: "Preparing next trial…",
    },
    identification: {
      askLabel: "Which one did you hear?",
      practiceIntro:
        "A syllable will play. Tap which one you heard. Just a few practice trials first.",
      mainIntro:
        "A syllable will play. Tap which one you heard. Please guess even if you're unsure.",
      startPractice: "Start practice →",
      startMain: "Start main task →",
    },
    break: {
      heading: "Short break",
      text: "Take a brief rest. Tap the button when you are ready to continue.",
      continueButton: "Continue →",
      waitSec: (s) => `${s} s remaining…`,
      progressLabel: (n, pct) => `Progress: ${n} trials done · about ${pct}%`,
    },
    rest: {
      heading: "Practice complete",
      accuracy: (c, t, p) => `Practice accuracy: ${p}% (${c} / ${t})`,
      passed: "Looks like you understand the task. Proceeding to the main block.",
      failed: "Your accuracy is a bit low. You can re-do the practice if you’d like.",
      retry: "Redo practice",
      proceed: "Start main task →",
    },
    debrief: {
      heading: "Experiment complete",
      thanks: "Thank you for your participation.",
      dlfLabel: "Your frequency difference limen (DLF)",
      dlfHelp: "This value is the smallest frequency difference at which you can identify the higher tone with 70.7% accuracy, estimated via a 2-down/1-up adaptive staircase converging on the reference of 1000 Hz. Typical adult values are 1–5 Hz.",
      staircaseHeading: "Staircase convergence",
      threshold: "Threshold",
      trialsLabel: (n, r) => `${n} trials · ${r} reversals`,
      dataHeading: "Your data",
      participantIdLabel: "Participant ID",
      dataIntro: "All data are available for download as CSV / TSV / JSON.",
      uploading: "Submitting to server…",
      uploaded: "✓ Saved to server",
      uploadError: "⚠ Server submission failed. Please download a copy locally.",
      dlMainCsv: "Main trials CSV",
      dlMainTsv: "Main trials TSV",
      dlPracticeCsv: "Practice CSV",
      dlHeadphoneCsv: "Audio check CSV",
      dlAllJson: "Full session JSON",
      closeTab: "You may close this tab now.",
    },
    ineligible: {
      heading: "Session could not be completed",
      text: "Thank you for your interest. Your responses were not recorded because the prerequisites were not met. You may close this tab.",
    },
  },
  ko: {
    common: {
      next: "다음 →",
      back: "뒤로",
      continue: "계속 →",
      cancel: "취소",
      submit: "제출",
      loading: "불러오는 중…",
      yes: "예",
      no: "아니오",
      language: "언어",
    },
    header: { subtitleDefault: "주파수 변별 과제" },
    consent: {
      heading: "연구 참여 안내",
      intro1:
        "본 실험은 음성 지각에 관한 기초 연구의 일환입니다. 참가자는 1000 Hz 부근의 순음을 듣고 두 구간 중 어느 쪽이 더 높은 음인지 판단합니다. 소요 시간은 약 15~20분입니다.",
      intro2:
        "수집 데이터: 연령, 성별, 손잡이, 모국어, 음악 훈련 경험, 청각 자가 평가 등의 기초 정보와 시행별 자극 매개변수·반응·반응 시간. 이름·연락처 등 개인 식별 정보는 수집하지 않으며, 데이터는 익명 ID로 저장되어 학술 목적에만 사용됩니다.",
      intro3:
        "위험과 이익: 사용되는 음 자극은 짧고 안전한 수준이며, 신체적·심리적 위험은 일상생활을 넘지 않습니다. 직접적인 금전적 보상은 없습니다.",
      intro4:
        "임의성: 참여는 전적으로 자율적입니다. 사유를 밝히지 않고 언제든 브라우저 탭을 닫아 중단할 수 있으며, 그 시점까지의 데이터는 폐기됩니다.",
      versionLabel: "동의서 버전",
      institutionLabel: "시행 기관",
      irbLabel: "윤리 심사 번호",
      contactLabel: "문의처",
      agreementsHeading: "다음 사항에 모두 동의하고 참여합니다",
      agreeAdult: (min) => `저는 만 ${min}세 이상이며 자유의지로 참여합니다.`,
      agreeHearing:
        "저의 청각은 본 과제 수행에 문제가 없다고 스스로 판단합니다(이명·급성 난청 증상 없음).",
      agreeHeadphones: "헤드폰 또는 이어폰을 착용하고 조용한 환경에서 진행합니다.",
      agreeConsent: "위 설명을 읽고 연구 목적의 데이터 사용에 동의합니다.",
      initialsLabel: "이니셜 (예: T.S.)",
      initialsHelp: "개인 식별에 사용되지 않으며 동의 기록의 일부로만 저장됩니다.",
      declineLink: "참여하지 않음",
      agreeButton: "동의하고 시작 →",
      progressChecks: (d, total) => `동의 항목 ${d}/${total}`,
      progressInitials: (ok) => (ok ? "이니셜 ✓" : "이니셜 미입력"),
      needCheckMore: (n) => `${n}개 항목을 더 체크하세요`,
      needInitials: "이니셜을 입력하세요 (2자 이상)",
      allReady: "준비 완료 · 버튼을 눌러 진행하세요",
    },
    demographics: {
      heading: "기본 정보",
      age: "나이",
      ageRange: (min, max) => `${min}~${max}세`,
      ageInvalid: (min, max) => `${min}~${max} 범위로 입력하세요.`,
      gender: "성별",
      handedness: "주 사용 손",
      nativeLanguage: "모국어",
      otherLanguages: "유창한 다른 언어 (선택, 쉼표로 구분)",
      otherLanguagesPlaceholder: "예: 일본어, 중국어",
      musicalTrainingYears: "음악 훈련 연수 (년)",
      hearing: "청각 자가 평가",
      hearingAids: "보청기 사용",
      headphoneType: "사용 헤드폰/이어폰",
      environment: "현재 주변 환경이 조용합니까?",
      quiet: "조용함",
      noisy: "시끄러움",
      select: "선택하세요",
      genderOpts: { female: "여성", male: "남성", nonBinary: "논바이너리", preferNotToSay: "응답하지 않음" },
      handednessOpts: { right: "오른손잡이", left: "왼손잡이", ambidextrous: "양손잡이" },
      hearingOpts: { none: "이상 없음", mild: "경도", moderate: "중등도", severe: "중도", unsure: "잘 모름" },
      headphoneOpts: { overEar: "오버이어형", onEar: "온이어형", inEar: "인이어 (커널)", earbuds: "이어버드", unknown: "잘 모름" },
    },
    audio: {
      heading: "음량 조정",
      step1: "헤드폰 또는 이어폰을 착용해 주세요.",
      step2: "아래 「오디오 시작」을 눌러 브라우저 오디오를 활성화하세요.",
      step3: "「테스트음 재생」을 누르고 또렷이 들리지만 너무 크지 않은 음량으로 기기에서 조정하세요.",
      step4: "본 실험에서 이 기준음보다 큰 소리는 나오지 않습니다.",
      startButton: "오디오 시작",
      testButton: "테스트음 재생",
      justRight: "적당함",
      adjusting: "조정 중",
      errorInit: "오디오 시스템을 초기화할 수 없습니다. 브라우저 권한을 허용하거나 다른 브라우저를 사용해 주세요.",
    },
    headphone: {
      heading: "오디오 점검",
      instructions: "음이 재생됩니다. 어느 쪽 귀에서 들렸는지 선택하세요. 양쪽에서 동일하게 들리면 “양쪽”을 선택합니다.",
      preparing: "준비 중...",
      playing: "재생 중...",
      askDirection: "어느 쪽에서 들렸습니까?",
      left: "왼쪽",
      both: "양쪽",
      right: "오른쪽",
      cannotHear: "들리지 않음 / 중단",
    },
    instructions: {
      headingPractice: "연습 시행 안내",
      headingMain: "본 시행 안내",
      intro: "각 시행에서 두 개의 음이 연이어 재생됩니다. 두 음의 높이는 거의 같지만, 한쪽이 약간 더 높습니다.",
      flowDiagram: "음 ① → 짧은 무음 → 음 ② → 응답",
      flowDetail: "200 ms tone · 500 ms ISI · 200 ms tone · response",
      respondLabel: "어느 음이 더 높았는지 화면 버튼(또는 1 / 2 키)으로 응답하세요.",
      forcedChoice: "확신이 없더라도 반드시 한쪽을 선택하세요. 과제는 정답률에 따라 난이도가 자동 조정됩니다.",
      practiceFeedback: "먼저 연습을 진행합니다. 연습에서는 정오 피드백이 제공됩니다.",
      mainNoFeedback: "본 시행에서는 피드백이 제공되지 않습니다. 측정의 타당성을 위해 자극 재생은 1회만 허용됩니다.",
      breakInfo: "일정 시행마다 짧은 휴식이 있습니다. 전체 약 10~15분이 소요됩니다.",
      replayHelp: "연습 중 음을 놓친 경우 응답 전에 「다시 듣기」(R 키)를 누르세요.",
      undoHelp: "잘못 눌렀음을 알아챈 경우 응답 직후 「↶ 이전 응답 취소」(U 키)를 누르면 해당 시행을 다시 진행합니다.",
      startPractice: "연습 시작 →",
      startMain: "본 시행 시작 →",
    },
    trial: {
      practiceLabel: "연습",
      mainLabel: "본 시행",
      askHigher: "어느 음이 더 높았습니까?",
      tone1Higher: "음 ①이 더 높았음",
      tone2Higher: "음 ②가 더 높았음",
      replay: "다시 듣기",
      undo: "↶ 이전 응답 취소",
      correct: "○ 정답",
      incorrect: "× 오답",
      playing: "음 재생 중",
      nextTrial: "다음 시행 준비 중…",
    },
    identification: {
      askLabel: "어느 쪽으로 들렸습니까?",
      practiceIntro:
        "음절이 재생됩니다. 「바」와 「파」 중 어느 쪽으로 들렸는지 탭하세요. 먼저 짧은 연습을 진행합니다.",
      mainIntro:
        "음절이 재생됩니다. 어느 쪽으로 들렸는지 탭하세요. 확실치 않더라도 반드시 한쪽을 선택하세요.",
      startPractice: "연습 시작 →",
      startMain: "본 시행 시작 →",
    },
    break: {
      heading: "짧은 휴식",
      text: "잠시 쉬어 주세요. 준비되면 아래 버튼을 눌러 계속하세요.",
      continueButton: "계속 →",
      waitSec: (s) => `${s} 초 남음…`,
      progressLabel: (n, pct) => `진행: ${n} 시행 완료 · 약 ${pct}%`,
    },
    rest: {
      heading: "연습 완료",
      accuracy: (c, t, p) => `연습 정답률: ${p}% (${c} / ${t})`,
      passed: "과제를 이해한 것으로 보입니다. 본 시행으로 진행합니다.",
      failed: "정답률이 낮습니다. 원하시면 연습을 다시 진행할 수 있습니다.",
      retry: "연습 다시 진행",
      proceed: "본 시행 시작 →",
    },
    debrief: {
      heading: "실험이 완료되었습니다",
      thanks: "참여해 주셔서 감사합니다.",
      dlfLabel: "주파수 차이 식별 역치 (DLF)",
      dlfHelp: "이 값은 1000 Hz 순음에서 70.7% 정답률로 더 높은 음을 식별할 수 있는 최소 주파수 차의 추정값입니다(2-down/1-up 적응적 계단법). 일반 성인의 전형값은 1~5 Hz 정도입니다.",
      staircaseHeading: "계단법 수렴",
      threshold: "역치",
      trialsLabel: (n, r) => `${n} trials · ${r} reversals`,
      dataHeading: "데이터",
      participantIdLabel: "참가자 ID",
      dataIntro: "전체 데이터는 CSV / TSV / JSON으로 다운로드할 수 있습니다.",
      uploading: "서버로 전송 중…",
      uploaded: "✓ 서버 저장 완료",
      uploadError: "⚠ 서버 전송 실패. 아래 버튼에서 로컬로 저장하세요.",
      dlMainCsv: "본 시행 CSV",
      dlMainTsv: "본 시행 TSV",
      dlPracticeCsv: "연습 CSV",
      dlHeadphoneCsv: "오디오 점검 CSV",
      dlAllJson: "세션 전체 JSON",
      closeTab: "이 탭을 닫고 종료해 주세요.",
    },
    ineligible: {
      heading: "참여를 완료할 수 없습니다",
      text: "협조에 감사드립니다. 사전 조건을 충족하지 않아 데이터는 기록되지 않았습니다. 탭을 닫고 종료해 주세요.",
    },
  },
  zh: {
    common: {
      next: "下一步 →",
      back: "返回",
      continue: "继续 →",
      cancel: "取消",
      submit: "提交",
      loading: "加载中…",
      yes: "是",
      no: "否",
      language: "语言",
    },
    header: { subtitleDefault: "频率辨别任务" },
    consent: {
      heading: "研究参与邀请",
      intro1:
        "本实验是听觉感知基础研究的一部分。您将听到 1000 Hz 附近的纯音对，并判断两个间隔中哪一个包含较高的音。所需时间约为 15–20 分钟。",
      intro2:
        "收集数据：年龄、性别、惯用手、母语、音乐训练经验、自评听力状态，以及每次试次的刺激参数、反应和反应时间。不收集姓名、联系方式等可识别个人身份的信息。数据以匿名 ID 存储，仅用于学术目的。",
      intro3:
        "风险与收益：刺激为短时安全声压级的纯音，身体与心理风险不超过日常生活水平。无直接金钱补偿。",
      intro4:
        "自愿性：参与完全自愿。您可以在任何时候关闭浏览器标签页中止参与，无需说明理由，已收集的部分数据将被销毁。",
      versionLabel: "知情同意版本",
      institutionLabel: "实施机构",
      irbLabel: "伦理审查编号",
      contactLabel: "联系方式",
      agreementsHeading: "我同意以下所有条款并愿意参与",
      agreeAdult: (min) => `本人已满 ${min} 岁，并自愿参加本研究。`,
      agreeHearing: "本人自评听力可胜任本任务（无急性耳鸣或听力丧失）。",
      agreeHeadphones: "本人将佩戴耳机/入耳式耳机，并在安静环境下进行实验。",
      agreeConsent: "本人已阅读上述说明并同意数据用于研究目的。",
      initialsLabel: "姓名缩写 (例: T.S.)",
      initialsHelp: "不用于个人识别，仅作为同意记录的一部分保存。",
      declineLink: "不参与",
      agreeButton: "同意并开始 →",
      progressChecks: (d, total) => `同意项 ${d}/${total}`,
      progressInitials: (ok) => (ok ? "姓名缩写 ✓" : "姓名缩写 未填"),
      needCheckMore: (n) => `还需勾选 ${n} 项`,
      needInitials: "请填写姓名缩写（2 字以上）",
      allReady: "准备就绪 · 点击按钮继续",
    },
    demographics: {
      heading: "基本信息",
      age: "年龄",
      ageRange: (min, max) => `${min}–${max} 岁`,
      ageInvalid: (min, max) => `请输入 ${min}–${max} 之间的值。`,
      gender: "性别",
      handedness: "惯用手",
      nativeLanguage: "母语",
      otherLanguages: "其他流利语言 (可选，逗号分隔)",
      otherLanguagesPlaceholder: "例如：日语、英语",
      musicalTrainingYears: "音乐训练年数",
      hearing: "自评听力",
      hearingAids: "是否使用助听器",
      headphoneType: "使用的耳机类型",
      environment: "当前环境是否安静?",
      quiet: "安静",
      noisy: "嘈杂",
      select: "请选择",
      genderOpts: { female: "女", male: "男", nonBinary: "非二元", preferNotToSay: "不愿回答" },
      handednessOpts: { right: "右利手", left: "左利手", ambidextrous: "双利手" },
      hearingOpts: { none: "无异常", mild: "轻度", moderate: "中度", severe: "重度", unsure: "不确定" },
      headphoneOpts: { overEar: "包耳式", onEar: "压耳式", inEar: "入耳式（耳道式）", earbuds: "平头耳塞", unknown: "不确定" },
    },
    audio: {
      heading: "音量调整",
      step1: "请佩戴耳机或入耳式耳机。",
      step2: "点击下方“启动音频”以开启浏览器音频。",
      step3: "点击“播放测试音”，在设备上调节到清晰可闻但不过响的音量。",
      step4: "本实验不会播放比该参考音更响的声音。",
      startButton: "启动音频",
      testButton: "播放测试音",
      justRight: "刚好",
      adjusting: "调整中",
      errorInit: "无法初始化音频。请允许浏览器音频权限或更换浏览器。",
    },
    headphone: {
      heading: "音频检查",
      instructions: "将播放一个音。请选择您从哪一侧听到。若两侧均匀听到，选“双耳”。",
      preparing: "准备中…",
      playing: "播放中…",
      askDirection: "从哪一侧听到的?",
      left: "左耳",
      both: "双耳",
      right: "右耳",
      cannotHear: "听不到 / 中止",
    },
    instructions: {
      headingPractice: "练习说明",
      headingMain: "正式试次说明",
      intro: "每个试次将连续播放两个音。两音音高几乎相同，仅其中一个略高。",
      flowDiagram: "音 ① → 短暂静音 → 音 ② → 作答",
      flowDetail: "200 ms tone · 500 ms ISI · 200 ms tone · response",
      respondLabel: "请使用屏幕按钮（或 1 / 2 键）选择更高的那个音。",
      forcedChoice: "即使不确定，请也务必选择其中一个。任务难度会根据您的表现自动调整。",
      practiceFeedback: "先进行练习。练习中会显示正误反馈。",
      mainNoFeedback: "正式试次不显示反馈。为保证测量有效性，刺激不可重播。",
      breakInfo: "每隔若干试次会有短暂休息。整个实验约 10–15 分钟。",
      replayHelp: "练习中如错过声音，可在作答前按“重播”(R 键) 重新播放。",
      undoHelp: "如发现按错，作答后立即按“↶ 撤销上次回答”(U 键) 可重做该试次。",
      startPractice: "开始练习 →",
      startMain: "开始正式试次 →",
    },
    trial: {
      practiceLabel: "练习",
      mainLabel: "正式试次",
      askHigher: "哪个音更高?",
      tone1Higher: "音 ① 更高",
      tone2Higher: "音 ② 更高",
      replay: "重播",
      undo: "↶ 撤销上次回答",
      correct: "○ 正确",
      incorrect: "× 错误",
      playing: "正在播放",
      nextTrial: "准备下一试次…",
    },
    identification: {
      askLabel: "听到的是哪个?",
      practiceIntro:
        "将播放一个音节。请点击你听到的那个。先做几次练习。",
      mainIntro:
        "将播放一个音节。请点击你听到的那个。不确定时也务必选择一个。",
      startPractice: "开始练习 →",
      startMain: "开始正式试次 →",
    },
    break: {
      heading: "短暂休息",
      text: "请稍作休息。准备好后点击下方按钮继续。",
      continueButton: "继续 →",
      waitSec: (s) => `还剩 ${s} 秒…`,
      progressLabel: (n, pct) => `进度：已完成 ${n} 试次 · 约 ${pct}%`,
    },
    rest: {
      heading: "练习完成",
      accuracy: (c, t, p) => `练习正确率：${p}% (${c} / ${t})`,
      passed: "看起来您已理解任务。即将进入正式试次。",
      failed: "正确率较低。如愿意，可重新进行练习。",
      retry: "重新练习",
      proceed: "开始正式试次 →",
    },
    debrief: {
      heading: "实验完成",
      thanks: "感谢您的参与。",
      dlfLabel: "频率差异阈 (DLF)",
      dlfHelp: "该值为 1000 Hz 纯音条件下，您以 70.7% 正确率判别“较高音”的最小频率差估计（2-down/1-up 自适应阶梯法）。一般成人典型值约为 1–5 Hz。",
      staircaseHeading: "阶梯法收敛",
      threshold: "阈值",
      trialsLabel: (n, r) => `${n} trials · ${r} reversals`,
      dataHeading: "数据",
      participantIdLabel: "参与者 ID",
      dataIntro: "所有数据均可下载为 CSV / TSV / JSON 格式。",
      uploading: "正在提交到服务器…",
      uploaded: "✓ 已保存到服务器",
      uploadError: "⚠ 服务器提交失败。请通过下方按钮保存到本地。",
      dlMainCsv: "正式试次 CSV",
      dlMainTsv: "正式试次 TSV",
      dlPracticeCsv: "练习 CSV",
      dlHeadphoneCsv: "音频检查 CSV",
      dlAllJson: "完整 JSON",
      closeTab: "请关闭此标签页。",
    },
    ineligible: {
      heading: "无法完成参与",
      text: "感谢您的关注。由于不满足前提条件，您的数据未被记录。请关闭此标签页。",
    },
  },
};
