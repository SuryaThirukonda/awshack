"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { FaceLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { PresenceSummary } from "./api";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm";
const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const FRAME_MS = 100; // ~10 Hz detection
const CALIBRATION_FRAMES = 25;
const SLOUCH_RATIO = 0.82; // nose-to-shoulder height below 82% of baseline = slouching
const TILT_DEG = 8;
const HEAD_DEG = 16;
const GAZE_AWAY = 0.6;

export type PostureState = "good" | "slouch" | "tilt" | "none";
export type LiveState = {
  posture: PostureState;
  eyeContact: boolean | null;
  calibrating: boolean;
};
type Sample = { posture: PostureState; eye: boolean | null };
type Baseline = { ratio: number; yaw: number; pitch: number };

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};
const mode = <T>(xs: T[]): T => {
  const counts = new Map<T, number>();
  xs.forEach((x) => counts.set(x, (counts.get(x) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
};

/** Webcam + MediaPipe pose/face tracking with live posture & eye-contact state. */
export function usePosture(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<LiveState>({ posture: "none", eyeContact: null, calibrating: true });

  const poseRef = useRef<PoseLandmarker | null>(null);
  const faceRef = useRef<FaceLandmarker | null>(null);
  const baselineRef = useRef<Baseline | null>(null);
  const calibRef = useRef<{ ratio: number[]; yaw: number[]; pitch: number[] }>({ ratio: [], yaw: [], pitch: [] });
  const historyRef = useRef<Sample[]>([]);
  const samplesRef = useRef<Sample[]>([]);
  const recordingRef = useRef(false);

  // Camera + models
  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let raf = 0;
    let last = 0;

    async function init() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } });
        if (cancelled) return;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();

        const { FilesetResolver, PoseLandmarker, FaceLandmarker } = await import("@mediapipe/tasks-vision");
        const fileset = await FilesetResolver.forVisionTasks(WASM);
        const [pose, face] = await Promise.all([
          PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: POSE_MODEL, delegate: "GPU" },
            runningMode: "VIDEO",
            numPoses: 1,
          }),
          FaceLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: FACE_MODEL, delegate: "GPU" },
            runningMode: "VIDEO",
            numFaces: 1,
            outputFaceBlendshapes: true,
            outputFacialTransformationMatrixes: true,
          }),
        ]);
        if (cancelled) {
          pose.close();
          face.close();
          return;
        }
        poseRef.current = pose;
        faceRef.current = face;
        setReady(true);
        raf = requestAnimationFrame(loop);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }

    function loop(now: number) {
      raf = requestAnimationFrame(loop);
      if (now - last < FRAME_MS) return;
      last = now;
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !poseRef.current || !faceRef.current) return;
      processFrame(video, now);
    }

    function processFrame(video: HTMLVideoElement, now: number) {
      const poseRes = poseRef.current!.detectForVideo(video, now);
      const faceRes = faceRef.current!.detectForVideo(video, now);

      // --- posture from pose landmarks (nose 0, shoulders 11/12)
      let ratio: number | null = null;
      let tilt = 0;
      const lm = poseRes.landmarks[0];
      if (lm && (lm[11].visibility ?? 1) > 0.5 && (lm[12].visibility ?? 1) > 0.5) {
        const [nose, ls, rs] = [lm[0], lm[11], lm[12]];
        const sw = Math.hypot(ls.x - rs.x, ls.y - rs.y);
        ratio = ((ls.y + rs.y) / 2 - nose.y) / Math.max(sw, 1e-3);
        tilt = Math.abs((Math.atan2(ls.y - rs.y, ls.x - rs.x) * 180) / Math.PI);
        if (tilt > 90) tilt = 180 - tilt;
      }

      // --- head pose + gaze from face landmarker
      let yaw: number | null = null;
      let pitch: number | null = null;
      let gazeAway = false;
      const m = faceRes.facialTransformationMatrixes?.[0]?.data;
      if (m) {
        // column-major 4x4: R[row][col] = m[col*4 + row]
        yaw = (Math.asin(Math.max(-1, Math.min(1, -m[2]))) * 180) / Math.PI;
        pitch = (Math.atan2(m[6], m[10]) * 180) / Math.PI;
      }
      const shapes = faceRes.faceBlendshapes?.[0]?.categories;
      if (shapes) {
        gazeAway = shapes.some((c) => c.categoryName.startsWith("eyeLook") && c.score > GAZE_AWAY);
      }

      // --- calibration (first N good frames)
      if (!baselineRef.current) {
        const c = calibRef.current;
        if (ratio !== null && yaw !== null && pitch !== null) {
          c.ratio.push(ratio);
          c.yaw.push(yaw);
          c.pitch.push(pitch);
        }
        if (c.ratio.length >= CALIBRATION_FRAMES) {
          baselineRef.current = { ratio: median(c.ratio), yaw: median(c.yaw), pitch: median(c.pitch) };
        }
        draw(lm, "calibrating");
        setLive((s) => (s.calibrating ? s : { ...s, calibrating: true }));
        return;
      }

      const b = baselineRef.current;
      let posture: PostureState = "none";
      if (ratio !== null) posture = ratio < b.ratio * SLOUCH_RATIO ? "slouch" : tilt > TILT_DEG ? "tilt" : "good";
      let eye: boolean | null = null;
      if (yaw !== null && pitch !== null) {
        eye = Math.abs(yaw - b.yaw) < HEAD_DEG && Math.abs(pitch - b.pitch) < HEAD_DEG && !gazeAway;
      }

      // smooth over last ~0.6s to avoid flicker
      const hist = historyRef.current;
      hist.push({ posture, eye });
      if (hist.length > 6) hist.shift();
      const smoothed: Sample = { posture: mode(hist.map((h) => h.posture)), eye: mode(hist.map((h) => h.eye)) };
      if (recordingRef.current) samplesRef.current.push(smoothed);

      setLive((s) =>
        s.posture === smoothed.posture && s.eyeContact === smoothed.eye && !s.calibrating
          ? s
          : { posture: smoothed.posture, eyeContact: smoothed.eye, calibrating: false },
      );
      draw(lm, smoothed.posture === "good" ? "good" : smoothed.posture === "none" ? "none" : "bad");
    }

    function draw(lm: { x: number; y: number }[] | undefined, state: "good" | "bad" | "none" | "calibrating") {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;
      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!lm) return;
      const color = { good: "#34d399", bad: "#fb7185", none: "#a1a1aa", calibrating: "#818cf8" }[state];
      const p = (i: number) => [lm[i].x * canvas.width, lm[i].y * canvas.height] as const;
      const [nx, ny] = p(0);
      const [lx, ly] = p(11);
      const [rx, ry] = p(12);
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(rx, ry);
      ctx.moveTo((lx + rx) / 2, (ly + ry) / 2);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      ctx.fillStyle = color;
      for (const [x, y] of [
        [nx, ny],
        [lx, ly],
        [rx, ry],
      ]) {
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    init();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      poseRef.current?.close();
      faceRef.current?.close();
      poseRef.current = null;
      faceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recalibrate = useCallback(() => {
    baselineRef.current = null;
    calibRef.current = { ratio: [], yaw: [], pitch: [] };
    historyRef.current = [];
    setLive({ posture: "none", eyeContact: null, calibrating: true });
  }, []);

  const startTracking = useCallback(() => {
    samplesRef.current = [];
    recordingRef.current = true;
  }, []);

  const stopTracking = useCallback((): PresenceSummary => {
    recordingRef.current = false;
    return summarize(samplesRef.current);
  }, []);

  return { ready, error, live, recalibrate, startTracking, stopTracking };
}

function summarize(samples: Sample[]): PresenceSummary {
  const withPose = samples.filter((s) => s.posture !== "none");
  const withFace = samples.filter((s) => s.eye !== null);
  let slouchEvents = 0;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].posture === "slouch" && samples[i - 1].posture !== "slouch") slouchEvents++;
  }
  const BUCKETS = 48;
  const timeline: PresenceSummary["timeline"] = [];
  if (samples.length) {
    const size = samples.length / BUCKETS;
    for (let b = 0; b < Math.min(BUCKETS, samples.length); b++) {
      const chunk = samples.slice(Math.floor(b * size), Math.max(Math.floor((b + 1) * size), Math.floor(b * size) + 1));
      const bad = chunk.filter((s) => s.posture === "slouch" || s.posture === "tilt").length / chunk.length;
      const away = chunk.filter((s) => s.eye === false).length / chunk.length;
      const none = chunk.filter((s) => s.posture === "none" && s.eye === null).length / chunk.length;
      timeline.push(none > 0.5 ? "none" : bad > 0.5 && away > 0.5 ? "bad" : bad > 0.5 || away > 0.5 ? "warn" : "good");
    }
  }
  return {
    posture_pct: withPose.length
      ? Math.round((100 * withPose.filter((s) => s.posture === "good").length) / withPose.length)
      : 0,
    eye_contact_pct: withFace.length ? Math.round((100 * withFace.filter((s) => s.eye).length) / withFace.length) : 0,
    slouch_events: slouchEvents,
    samples: samples.length,
    timeline,
  };
}
