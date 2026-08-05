/**
 * e2e_gating.js — run a whole gating session headlessly.
 *
 * A gating session is 288 trials across 18 blocks with a headphone screen, a
 * language switch, breaks on block boundaries, and a payload whose shape the
 * analysis depends on. None of that can be checked by reading the file, and
 * clicking through it by hand costs half an hour per cell. This drives the real
 * index.html in jsdom with audio, network and canvas stubbed, answers every
 * trial, and reports what came out.
 *
 * It has already caught two defects that reading did not: a loop counter named
 * `t` shadowing the translation function t(), and a getElementById on an id
 * that does not exist ("responseArea"). Both would have failed on the first
 * participant.
 *
 * What is NOT covered: anything about sound. jsdom does not decode audio, so
 * this says nothing about whether the stimuli play, how long 270 files take to
 * preload, or whether the antiphase tone actually cancels over speakers. Those
 * need a browser.
 *
 * Usage:
 *   npm install --no-save jsdom
 *   node tools/e2e_gating.js <deployDir> [cond] [list]
 *   node tools/e2e_gating.js <deployDir> <cond> <list> --speaker
 *
 *   <deployDir> holds index.html, lists/, and the stimuli it references.
 *   --speaker answers the headphone check the way someone on loudspeakers
 *   would (picking the antiphase tone, which cancels and so sounds quietest)
 *   and expects to be turned away.
 */
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const WEB = process.argv[2];
const CELL = process.argv[3] || "";
const LIST = process.argv[4] || "1";
const SPEAKER = process.argv.includes("--speaker");
// 送信を落として、リトライ 3 回 + errors シートへの報告が動くかを見るモード
const FAIL_UPLOAD = process.argv.includes("--offline");

if (!WEB || !fs.existsSync(path.join(WEB, "index.html"))) {
  console.error("usage: node tools/e2e_gating.js <deployDir> [cond] [list] [--speaker] [--offline]");
  process.exit(2);
}

const posted = [];
const alerts = [];
const failures = [];
const check = (ok, what) => {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${what}`);
  if (!ok) failures.push(what);
};

const query = CELL ? `?cond=${CELL}&list=${LIST}` : "";
const dom = new JSDOM(fs.readFileSync(path.join(WEB, "index.html"), "utf8"), {
  url: "http://localhost/index.html" + query,
  runScripts: "dangerously",
  pretendToBeVisual: true,
  beforeParse(w) {
    // 音声は鳴らさず、読み込みと再生の完了だけを即座に返す
    w.HTMLMediaElement.prototype.play = function () {
      setTimeout(() => this.dispatchEvent(new w.Event("ended")), 0);
      return Promise.resolve();
    };
    w.HTMLMediaElement.prototype.load = function () {};
    w.HTMLMediaElement.prototype.pause = function () {};
    Object.defineProperty(w.HTMLMediaElement.prototype, "src", {
      set(v) { this._src = v; setTimeout(() => this.dispatchEvent(new w.Event("canplaythrough")), 0); },
      get() { return this._src; },
      configurable: true,
    });
    // 相対 URL はディスクから、絶対 URL は送信とみなして捕まえる。
    // uploadOnce は res.text() を読むので、そちらも用意しないと送信が失敗と
    // 判定され、リトライ 3 回 + エラー報告という別の経路に入ってしまう。
    w.fetch = (url, opts) => {
      if (String(url).startsWith("http")) {
        posted.push(JSON.parse(opts.body));
        if (FAIL_UPLOAD) return Promise.reject(new Error("network down"));
        return Promise.resolve({ ok: true, status: 200,
                                 text: () => Promise.resolve('{"ok":true}'),
                                 json: () => Promise.resolve({ ok: true }) });
      }
      const p = path.join(WEB, String(url).replace(/^\//, ""));
      return Promise.resolve({ ok: true, status: 200,
                               text: () => Promise.resolve(fs.readFileSync(p, "utf8")),
                               json: () => Promise.resolve(JSON.parse(fs.readFileSync(p, "utf8"))) });
    };
    w.AudioContext = w.webkitAudioContext = function () {
      const gain = { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: () => ({ connect() {} }) };
      return {
        currentTime: 0, destination: {},
        createOscillator: () => ({ connect: () => ({ connect() {} }), start() {}, stop() {}, frequency: { value: 0 }, type: "" }),
        createGain: () => gain,
      };
    };
    w.alert = (m) => alerts.push(m);
    w.confirm = () => true;
  },
});

const w = dom.window;
const D = w.document;
const $ = (id) => D.getElementById(id);
const screen = () => [...D.querySelectorAll("section[id^='screen-']")]
  .filter((s) => !s.classList.contains("hidden")).map((s) => s.id)[0];
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const click = (sel) => { const b = D.querySelector(sel); if (b) { b.click(); return true; } return false; };

(async () => {
  await tick(200);
  console.log(`=== ${CELL || "(no cell)"} list ${LIST}${SPEAKER ? " [speaker]" : ""} ===`);

  const spec = CELL ? JSON.parse(fs.readFileSync(path.join(WEB, "lists", `${CELL}_list${LIST}.json`), "utf8")) : null;
  const wantEn = spec && spec.config && spec.config.uiLang === "en";
  const hasJa = (s) => /[぀-ゟ゠-ヿ一-鿿]/.test(s);

  check(screen() === "screen-consent", "starts on the consent screen");
  if (spec) {
    check(hasJa($("consentBody").textContent) !== wantEn,
          `consent text is in ${wantEn ? "English" : "Japanese"}`);
    check(hasJa(D.querySelector('[data-i18n="consent.2"]').textContent) !== wantEn,
          `UI frame is in ${wantEn ? "English" : "Japanese"}`);
  }

  $("consentCheckbox").checked = true;
  $("consentCheckbox").dispatchEvent(new w.Event("change"));
  $("toSetupBtn").click();
  await tick();
  check(screen() === "screen-setup", "consent -> setup");

  $("participantName").value = "Test Person";
  $("dateOfBirth").value = "1995-04-01";
  D.querySelector('input[name="gender"]').click();
  D.querySelector('input[name="handedness"]').click();
  $("nativeLanguage").value = wantEn ? "English" : "日本語";
  $("startBtn").click();
  await tick();
  check(screen() === "screen-instructions", "setup -> instructions");

  // 288 試行を実時間で待たない
  w.eval("CONFIG.fixationDurationMs = 0; CONFIG.interTrialIntervalMs = 0;");

  // ヘッドホン検査。実際に再生された 3 音の gain と位相を控えて答える
  const tones = [];
  const origTone = w.toneDataURI;
  w.toneDataURI = (f, sec, gain, anti) => { tones.push({ gain, anti }); return origTone(f, sec, gain, anti); };

  click("#screen-instructions button");
  await tick(120);
  check(screen() === "screen-headphone", "instructions -> headphone check");

  $("hpStart").click();
  let hp = 0, sameSlot = 0;
  for (let i = 0; i < 5000 && screen() === "screen-headphone"; i++) {
    await tick(2);
    const btns = [...D.querySelectorAll("#hpArea button")];
    if (btns.length === 3 && tones.length >= 3) {
      const three = tones.slice(-3);
      const antiAt = three.findIndex((x) => x.anti);
      const quietAt = three.findIndex((x) => x.gain === Math.min(...three.map((y) => y.gain)));
      if (antiAt === quietAt) sameSlot++;
      btns[SPEAKER ? antiAt : quietAt].click();
      hp++;
      tones.length = 0;
    }
  }
  check(hp > 0, `answered ${hp} headphone trials`);
  check(sameSlot === 0, "the antiphase tone is never also the quiet one");

  if (SPEAKER) {
    check(screen() === "screen-headphone-fail", "a speaker user is turned away");
    check(posted.length === 0, "nothing is uploaded for a rejected participant");
    return report();
  }
  check(screen() !== "screen-headphone-fail", "a headphone user passes");

  await tick(400);
  const seen = {};
  let guard = 0, answered = 0, rng = 1;
  while (screen() !== "screen-result" && guard++ < 200000) {
    const v = screen();
    seen[v] = (seen[v] || 0) + 1;
    if (v === "screen-practice-intro") click("#screen-practice-intro button");
    else if (v === "screen-practice-done") click("#screen-practice-done button");
    else if (v === "screen-break") click("#screen-break button");
    else if (v === "screen-trial") {
      const rb = [...D.querySelectorAll(".btn-response, #ratingArea button")]
        .filter((b) => !b.disabled && !b.closest(".hidden"));
      if (rb.length) { rb[(rng = (rng * 1103515245 + 12345) >>> 8) % rb.length].click(); answered++; }
    }
    await tick(0);
  }
  check(screen() === "screen-result", `reached the result screen after ${answered} responses`);
  check((seen["screen-break"] || 0) > 0, `took ${seen["screen-break"] || 0} breaks`);
  await tick(300);

  const kinds = posted.map((x) => (x.errorReport ? "errorReport" : "results"));
  if (FAIL_UPLOAD) {
    // 3 回試して駄目なら、全試行データを付けたエラー報告を 1 通投げる
    check(kinds.filter((k) => k === "results").length === 3, `retried 3 times (${kinds.join(",")})`);
    check(kinds[kinds.length - 1] === "errorReport", "sent an error report after the retries");
    check(screen() === "screen-result", "the participant still sees the success screen");
  } else {
    const configured = !!(spec && spec.config && spec.config.dataServerUrl);
    if (!configured) {
      check(false, "dataServerUrl is not set in the list config -- this build would " +
                   "collect nothing; rebuild with the Apps Script /exec URL");
    } else {
      check(posted.length === 1, `uploaded exactly once (got ${posted.length}: ${kinds.join(",")})`);
    }
  }
  if (posted.length) verify(posted[0], spec);
  report();

  function verify(p, spec) {
    const gates = p.results.filter((r) => r.trialKind === "gate");
    const conf = p.results.filter((r) => r.trialKind === "confidence");
    const analysed = spec.blocks.filter((b) => !b.is_practice);
    const nGates = analysed[0].gates.length;

    check(p.paradigm === "gating" && p.condition === spec.condition &&
          String(p.listId) === String(spec.list), "payload carries paradigm, condition and list");
    check(/^\d+\/\d+$/.test(String(p.headphoneCheckScore)), `headphone score recorded (${p.headphoneCheckScore})`);
    check(gates.length === analysed.length * nGates,
          `${gates.length} gate rows = ${analysed.length} items x ${nGates} gates`);
    check(conf.length === analysed.length, `${conf.length} confidence rows, one per item`);

    const items = [...new Set(gates.map((r) => r.itemId))];
    check(items.length === analysed.length, `${items.length} distinct items`);
    check(!gates.some((r) => r.blockPosition < 0), "no practice trials in the uploaded data");

    let outOfOrder = 0, wrongCount = 0;
    items.forEach((id) => {
      const ms = gates.filter((r) => r.itemId === id).map((r) => r.gateMs);
      if (ms.length !== nGates) wrongCount++;
      if (ms.some((v, k) => k && v <= ms[k - 1])) outOfOrder++;
    });
    check(wrongCount === 0, "every item has its full gate sequence");
    check(outOfOrder === 0, "gates are recorded in ascending order within every item");

    const scored = gates.filter((r) =>
      r.isCorrect === ((r.saidRepair === 1) === (r.itemType === "repair") ? 1 : 0));
    check(scored.length === gates.length, "isCorrect agrees with saidRepair and itemType on every row");
    check(gates.every((r) => typeof r.gateMs === "number" && r.file), "every gate row has a gate position and a file");
  }

  function report() {
    console.log(failures.length
      ? `\n  ${failures.length} FAILED:\n` + failures.map((f) => "    - " + f).join("\n")
      : "\n  all checks passed");
    if (alerts.length) console.log("  alerts raised: " + JSON.stringify(alerts));
    process.exit(failures.length ? 1 : 0);
  }
})().catch((e) => { console.error("threw:", e.stack); process.exit(1); });
