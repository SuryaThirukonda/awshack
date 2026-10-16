"use client";

import { useCallback, useRef } from "react";

/** Records the candidate's mic for the whole session so it can be sent to ElevenLabs Scribe. */
export function useRecorder() {
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunksRef.current = [];
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.start(1000);
    recRef.current = rec;
    startedAtRef.current = performance.now();
  }, []);

  const stop = useCallback(
    () =>
      new Promise<Blob | null>((resolve) => {
        const rec = recRef.current;
        if (!rec || rec.state === "inactive") return resolve(null);
        rec.onstop = () => {
          rec.stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" }));
        };
        rec.stop();
      }),
    [],
  );

  /** Seconds since recording started (0 if not recording). */
  const elapsed = useCallback(
    () => (startedAtRef.current ? (performance.now() - startedAtRef.current) / 1000 : 0),
    [],
  );

  return { start, stop, elapsed };
}
