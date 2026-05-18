import { isAdminRequest } from "@/app/lib/admin-auth";
import { isValidDesignId } from "@/app/lib/design";
import { getBackend } from "@/app/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

const TRIAL_COLUMNS = [
  "participantId",
  "experimentId",
  "taskType",
  "locale",
  "sessionStartedAt",
  "sessionCompletedAt",
  "block",
  "blockIndex",
  "staircaseId",
  "trialIndexInStaircase",
  "trialIndexInBlock",
  "globalTrialIndex",
  "referenceFrequencyHz",
  "deltaHz",
  "comparisonFrequencyHz",
  "comparisonIntervalIs2",
  "stimulusId",
  "stimulusSrc",
  "stimulusValue",
  "stimulusLabel",
  "response",
  "correct",
  "rtMs",
  "replayCount",
  "undone",
  "staircaseDirectionBefore",
  "reversal",
  "stepFactorBefore",
  "deltaAfter",
  "isiSec",
  "toneDurationSec",
  "rampDurationSec",
  "outputLevel",
  "stimulusOnsetAudioTime",
  "stimulusEndAudioTime",
  "responseDeadlineAudioTime",
  "preStimulusSilenceSec",
  "postStimulusSilenceSec",
  "timestamp",
] as const;

const SESSION_COLUMNS = [
  "participantId",
  "experimentId",
  "taskType",
  "locale",
  "startedAt",
  "completedAt",
  "durationSec",
  "finalThresholdHz",
  "finalThresholdCents",
  "numStaircases",
  "numMainTrials",
  "numPracticeTrials",
  "numIdentMainTrials",
  "numIdentPracticeTrials",
  "practiceAccuracy",
  "headphoneCheckPassed",
  "headphoneCheckCorrect",
  "age",
  "gender",
  "handedness",
  "nativeLanguage",
  "otherLanguages",
  "musicalTrainingYears",
  "hearingImpairment",
  "hearingAids",
  "headphoneType",
  "environmentQuiet",
  "consentInitials",
  "consentAgreedAt",
  "userAgent",
  "sampleRate",
  "appVersion",
  "configVersion",
] as const;

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

interface AnyRecord {
  [key: string]: unknown;
}

function trialRows(session: AnyRecord): string[] {
  const lines: string[] = [];
  const blocks = [
    "practiceTrials",
    "mainTrials",
    "identificationPracticeTrials",
    "identificationMainTrials",
  ];
  for (const block of blocks) {
    const arr = session[block];
    if (!Array.isArray(arr)) continue;
    for (const t of arr) {
      const trial = t as AnyRecord;
      const row = TRIAL_COLUMNS.map((c) => {
        if (c === "participantId") return session.participantId;
        if (c === "experimentId") return session.experimentId;
        if (c === "taskType") return session.taskType;
        if (c === "locale") return session.locale;
        if (c === "sessionStartedAt") return session.startedAt;
        if (c === "sessionCompletedAt") return session.completedAt;
        return trial[c];
      })
        .map(csvEscape)
        .join(",");
      lines.push(row);
    }
  }
  return lines;
}

function sessionRow(session: AnyRecord): string {
  const demo = (session.demographics as AnyRecord | null) ?? {};
  const consent = (session.consent as AnyRecord | null) ?? {};
  const hc = (session.headphoneCheck as AnyRecord | null) ?? {};
  const audioInfo = (session.audioInfo as AnyRecord | null) ?? {};
  const staircases = Array.isArray(session.staircases) ? session.staircases : [];
  const main = Array.isArray(session.mainTrials) ? session.mainTrials : [];
  const practice = Array.isArray(session.practiceTrials)
    ? session.practiceTrials
    : [];
  const identMain = Array.isArray(session.identificationMainTrials)
    ? session.identificationMainTrials
    : [];
  const identPractice = Array.isArray(session.identificationPracticeTrials)
    ? session.identificationPracticeTrials
    : [];
  const practiceCorrect = practice.filter(
    (p) => (p as AnyRecord).correct === true,
  ).length;
  const practiceAccuracy =
    practice.length > 0 ? practiceCorrect / practice.length : null;
  const values: unknown[] = SESSION_COLUMNS.map((c) => {
    switch (c) {
      case "participantId":
        return session.participantId;
      case "experimentId":
        return session.experimentId;
      case "taskType":
        return session.taskType ?? "fdl-2afc";
      case "locale":
        return session.locale;
      case "startedAt":
        return session.startedAt;
      case "completedAt":
        return session.completedAt;
      case "durationSec":
        return session.durationSec;
      case "finalThresholdHz":
        return session.finalThresholdHz;
      case "finalThresholdCents":
        return session.finalThresholdCents;
      case "numStaircases":
        return staircases.length;
      case "numMainTrials":
        return main.length;
      case "numPracticeTrials":
        return practice.length;
      case "numIdentMainTrials":
        return identMain.length;
      case "numIdentPracticeTrials":
        return identPractice.length;
      case "practiceAccuracy":
        return practiceAccuracy;
      case "headphoneCheckPassed":
        return hc.passed;
      case "headphoneCheckCorrect":
        return hc.correctCount;
      case "age":
      case "gender":
      case "handedness":
      case "nativeLanguage":
      case "otherLanguages":
      case "musicalTrainingYears":
      case "hearingImpairment":
      case "hearingAids":
      case "headphoneType":
      case "environmentQuiet":
        return demo[c];
      case "consentInitials":
        return consent.participantInitials;
      case "consentAgreedAt":
        return consent.agreedAt;
      case "userAgent":
        return audioInfo.userAgent;
      case "sampleRate":
        return audioInfo.sampleRate;
      case "appVersion":
        return session.appVersion;
      case "configVersion":
        return session.configVersion;
      default:
        return undefined;
    }
  });
  return values.map(csvEscape).join(",");
}

export async function GET(request: Request, ctx: Ctx) {
  if (!(await isAdminRequest(request))) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!isValidDesignId(id))
    return Response.json({ ok: false, error: "invalid id" }, { status: 400 });

  const url = new URL(request.url);
  const view = url.searchParams.get("view") || "trials";
  const isSession = view === "sessions";

  const backend = await getBackend();
  const files = await backend.results.list(id);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const cols = isSession ? SESSION_COLUMNS : TRIAL_COLUMNS;
      controller.enqueue(enc.encode(cols.join(",") + "\n"));

      for (const f of files) {
        if (f.deletedAt) continue;
        const r = await backend.results.get(id, f.filename);
        if (!r) continue;
        let parsed: AnyRecord;
        try {
          parsed = JSON.parse(r.content) as AnyRecord;
        } catch {
          continue;
        }
        if (isSession) {
          controller.enqueue(enc.encode(sessionRow(parsed) + "\n"));
        } else {
          const rows = trialRows(parsed);
          if (rows.length > 0)
            controller.enqueue(enc.encode(rows.join("\n") + "\n"));
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${id}__${view}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
