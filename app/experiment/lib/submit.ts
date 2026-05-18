import type { ExperimentResult } from "../types";

export interface SubmitState {
  status: "pending" | "ok" | "error" | "queued";
  attempt: number;
  message: string;
  filename?: string;
  sha256?: string;
  duplicated?: boolean;
}

const QUEUE_KEY_PREFIX = "go_on_lab__queued_result__";
const MAX_QUEUE_BYTES = 4_500_000;

function queueKey(participantId: string): string {
  return `${QUEUE_KEY_PREFIX}${participantId}`;
}

export function enqueueResult(result: ExperimentResult): boolean {
  if (typeof localStorage === "undefined") return false;
  const json = JSON.stringify(result);
  if (json.length > MAX_QUEUE_BYTES) return false;
  try {
    localStorage.setItem(queueKey(result.participantId), json);
    return true;
  } catch {
    return false;
  }
}

export function dequeueResult(participantId: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(queueKey(participantId));
  } catch {
    /* noop */
  }
}

export function getQueuedResult(participantId: string): ExperimentResult | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const s = localStorage.getItem(queueKey(participantId));
    if (!s) return null;
    return JSON.parse(s) as ExperimentResult;
  } catch {
    return null;
  }
}

export async function submitResultWithRetry(
  result: ExperimentResult,
  options: {
    idempotencyKey: string;
    onState?: (s: SubmitState) => void;
    maxAttempts?: number;
    signal?: AbortSignal;
  },
): Promise<SubmitState> {
  const max = options.maxAttempts ?? 5;
  enqueueResult(result);

  let attempt = 0;
  let lastError = "";
  while (attempt < max) {
    attempt += 1;
    options.onState?.({
      status: "pending",
      attempt,
      message: attempt > 1 ? `retry ${attempt}/${max}` : "",
    });
    try {
      const resp = await fetch("/api/results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": options.idempotencyKey,
        },
        body: JSON.stringify(result),
        signal: options.signal,
        cache: "no-store",
      });
      if (resp.ok) {
        const j = (await resp.json().catch(() => ({}))) as {
          filename?: string;
          sha256?: string;
          duplicated?: boolean;
        };
        dequeueResult(result.participantId);
        const finalState: SubmitState = {
          status: "ok",
          attempt,
          message: j.filename ?? "",
          filename: j.filename,
          sha256: j.sha256,
          duplicated: j.duplicated,
        };
        options.onState?.(finalState);
        return finalState;
      }
      if (resp.status >= 400 && resp.status < 500 && resp.status !== 429) {
        const j = (await resp.json().catch(() => ({}))) as { error?: string };
        const state: SubmitState = {
          status: "queued",
          attempt,
          message:
            j.error || `HTTP ${resp.status} – データはこの端末に保存されています`,
        };
        options.onState?.(state);
        return state;
      }
      lastError = `HTTP ${resp.status}`;
    } catch (e) {
      lastError = (e as Error).message;
      if (options.signal?.aborted) {
        return {
          status: "queued",
          attempt,
          message: "aborted",
        };
      }
    }
    const delayMs = Math.min(30_000, 2 ** attempt * 500 + Math.random() * 500);
    await new Promise((r) => setTimeout(r, delayMs));
  }
  const queued: SubmitState = {
    status: "queued",
    attempt,
    message: lastError || "ネットワーク不安定。データはこの端末に保存されています。",
  };
  options.onState?.(queued);
  return queued;
}

export function makeIdempotencyKey(participantId: string, startedAt: string): string {
  const safe = `${participantId}__${startedAt}`.replace(/[^A-Za-z0-9_-]/g, "_");
  return safe.slice(0, 120);
}
