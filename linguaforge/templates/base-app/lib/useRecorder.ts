"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Records the learner's own attempt for playback/self-comparison only — no
// upload, no scoring. Matches AGENTS.md's roleplay spec: "録音（再生確認の
// み、採点はしない）".
export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const urlRef = useRef<string | null>(null);

  const revoke = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  useEffect(() => revoke, [revoke]);

  const start = useCallback(async () => {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices) {
      setError("このブラウザは録音に対応していません。");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        revoke();
        urlRef.current = URL.createObjectURL(blob);
        setAudioUrl(urlRef.current);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError("マイクにアクセスできませんでした。ブラウザの権限設定を確認してください。");
    }
  }, [revoke]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    setRecording(false);
  }, []);

  const reset = useCallback(() => {
    revoke();
    setAudioUrl(null);
    setError(null);
  }, [revoke]);

  return { recording, audioUrl, error, start, stop, reset };
}
