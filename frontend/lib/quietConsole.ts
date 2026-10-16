"use client";

/**
 * Third-party libraries log routine, non-actionable messages through console.error, which the Next.js dev
 * overlay surfaces as errors:
 *  - MediaPipe WASM: "INFO: Created TensorFlow Lite XNNPACK delegate for CPU."
 *  - LiveKit (ElevenLabs WebRTC transport): "error reading from signal stream" when a voice call closes.
 * Drop only those exact messages; everything else passes through untouched.
 */
const NOISE = [/^INFO: /, /TensorFlow Lite/, /XNNPACK/, /error reading from signal stream/i];

let installed = false;
export function installConsoleFilter() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const original = console.error;
  console.error = (...args: unknown[]) => {
    const first = typeof args[0] === "string" ? args[0] : args[0] instanceof Error ? args[0].message : "";
    if (NOISE.some((re) => re.test(first))) return;
    original(...args);
  };
}
