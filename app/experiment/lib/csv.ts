import type {
  DiscriminationTrial,
  ExperimentResult,
  HeadphoneTrial,
} from "../types";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\n");
}

const TRIAL_HEADERS: (keyof DiscriminationTrial | "participantId")[] = [
  "participantId",
  "block",
  "blockIndex",
  "staircaseId",
  "trialIndexInStaircase",
  "globalTrialIndex",
  "referenceFrequencyHz",
  "deltaHz",
  "comparisonFrequencyHz",
  "comparisonIntervalIs2",
  "response",
  "correct",
  "rtMs",
  "staircaseDirectionBefore",
  "reversal",
  "stepFactorBefore",
  "deltaAfter",
  "isiSec",
  "toneDurationSec",
  "rampDurationSec",
  "outputLevel",
  "stimulusOnsetAudioTime",
  "responseDeadlineAudioTime",
  "scheduledIntervalOnsets",
  "timestamp",
];

export function trialsToCsv(
  participantId: string,
  trials: DiscriminationTrial[],
): string {
  const headers = TRIAL_HEADERS.map(String);
  const rows = trials.map((t) =>
    TRIAL_HEADERS.map((h) =>
      h === "participantId"
        ? participantId
        : (t as unknown as Record<string, unknown>)[h as string],
    ),
  );
  return rowsToCsv(headers, rows);
}

const HEADPHONE_HEADERS: (keyof HeadphoneTrial | "participantId")[] = [
  "participantId",
  "index",
  "correctSide",
  "responseSide",
  "correct",
  "rtMs",
];

export function headphoneTrialsToCsv(
  participantId: string,
  trials: HeadphoneTrial[],
): string {
  const headers = HEADPHONE_HEADERS.map(String);
  const rows = trials.map((t) =>
    HEADPHONE_HEADERS.map((h) =>
      h === "participantId"
        ? participantId
        : (t as unknown as Record<string, unknown>)[h as string],
    ),
  );
  return rowsToCsv(headers, rows);
}

export function downloadFile(
  filename: string,
  content: string,
  mime = "text/plain;charset=utf-8",
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 250);
}

export function resultToJson(r: ExperimentResult): string {
  return JSON.stringify(r, null, 2);
}
