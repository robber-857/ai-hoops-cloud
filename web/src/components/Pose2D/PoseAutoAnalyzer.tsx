"use client";

import React, { useEffect, useRef } from "react";
import type { Results } from "@mediapipe/pose";

import { useMediaPipePose } from "@/hooks/useMediaPipePose";
import type { FrameSample } from "@/store/analysisStore";
import { extractDribbleFrame, type DribbleFrame } from "@/lib/dribbleTemporal";
import type { AnalysisType } from "./types";
import { extractPoseAngles } from "./poseMetrics";

const AUTO_ANALYSIS_FPS = 12;
const MAX_AUTO_ANALYSIS_FRAMES = 420;
const METADATA_TIMEOUT_MS = 6000;
const SEEK_TIMEOUT_MS = 4000;
const VIDEO_FRAME_TIMEOUT_MS = 4000;
const POSE_TIMEOUT_MS = 5000;

export type AutoAnalysisStatus = "idle" | "loading" | "analyzing" | "ready" | "error";

export type AutoAnalysisProgress = {
  status: AutoAnalysisStatus;
  processedFrames: number;
  totalFrames: number;
  coveragePercent: number;
  currentTime: number;
  duration: number;
  message?: string;
};

export type AutoAnalysisResult = {
  frames: FrameSample[];
  drillFrames: DribbleFrame[];
  duration: number;
};

type Props = {
  videoUrl: string;
  analysisType: AnalysisType;
  onProgress: (progress: AutoAnalysisProgress) => void;
  onComplete: (result: AutoAnalysisResult) => void;
  onError: (message: string) => void;
};

function waitForMetadata(video: HTMLVideoElement): Promise<number> {
  if (video.readyState >= 1 && Number.isFinite(video.duration) && video.duration > 0) {
    return Promise.resolve(video.duration);
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while loading uploaded video metadata."));
    }, METADATA_TIMEOUT_MS);
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("loadedmetadata", handleLoaded);
      video.removeEventListener("error", handleError);
    };
    const handleLoaded = () => {
      cleanup();
      if (Number.isFinite(video.duration) && video.duration > 0) {
        resolve(video.duration);
      } else {
        reject(new Error("Video metadata loaded without a valid duration."));
      }
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Video metadata failed to load."));
    };

    video.addEventListener("loadedmetadata", handleLoaded);
    video.addEventListener("error", handleError);
    video.load();
  });
}

function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while waiting for a decodable video frame."));
    }, VIDEO_FRAME_TIMEOUT_MS);
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("loadeddata", handleReady);
      video.removeEventListener("canplay", handleReady);
      video.removeEventListener("error", handleError);
    };
    const handleReady = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Video frame failed to load during automatic analysis."));
    };

    video.addEventListener("loadeddata", handleReady);
    video.addEventListener("canplay", handleReady);
    video.addEventListener("error", handleError);
  });
}

async function seekVideo(video: HTMLVideoElement, targetTime: number): Promise<void> {
  const duration = Number.isFinite(video.duration) ? video.duration : targetTime;
  const safeTarget = Math.min(Math.max(targetTime, 0), Math.max(duration - 0.03, 0));

  if (Math.abs(video.currentTime - safeTarget) < 0.025) {
    await waitForVideoFrame(video);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Timed out while seeking the uploaded video."));
    }, SEEK_TIMEOUT_MS);
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
    };
    const handleSeeked = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Video seek failed during automatic analysis."));
    };

    video.addEventListener("seeked", handleSeeked);
    video.addEventListener("error", handleError);

    try {
      video.currentTime = safeTarget;
    } catch (error) {
      cleanup();
      reject(error instanceof Error ? error : new Error("Video seek failed."));
    }
  });

  await waitForVideoFrame(video);
}

function buildSampleTimes(duration: number): number[] {
  const targetFrames = Math.min(
    MAX_AUTO_ANALYSIS_FRAMES,
    Math.max(1, Math.ceil(duration * AUTO_ANALYSIS_FPS))
  );

  if (targetFrames === 1) return [0];

  const lastFrameTime = Math.max(0, duration - 0.05);
  const step = lastFrameTime / (targetFrames - 1);

  return Array.from({ length: targetFrames }, (_, index) => {
    if (index === targetFrames - 1) return lastFrameTime;
    return index * step;
  });
}

export default function PoseAutoAnalyzer({
  videoUrl,
  analysisType,
  onProgress,
  onComplete,
  onError,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pendingResultRef = useRef<((results: Results) => void) | null>(null);
  const { isReady, error, pose } = useMediaPipePose();

  useEffect(() => {
    if (!pose) return;

    pose.onResults((results: Results) => {
      pendingResultRef.current?.(results);
    });
  }, [pose]);

  useEffect(() => {
    if (!videoUrl) return;

    if (error) {
      onError(error);
      return;
    }

    if (!isReady || !pose) {
      onProgress({
        status: "loading",
        processedFrames: 0,
        totalFrames: 0,
        coveragePercent: 0,
        currentTime: 0,
        duration: 0,
        message: "Loading MediaPipe analysis engine.",
      });
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;

    const sendPoseForCurrentFrame = (): Promise<Results> => {
      return new Promise<Results>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          pendingResultRef.current = null;
          reject(new Error("Timed out while running MediaPipe on a video frame."));
        }, POSE_TIMEOUT_MS);
        const cleanup = () => {
          window.clearTimeout(timeout);
          pendingResultRef.current = null;
        };

        pendingResultRef.current = (results) => {
          cleanup();
          resolve(results);
        };

        pose.send({ image: video }).catch((sendError) => {
          cleanup();
          reject(
            sendError instanceof Error
              ? sendError
              : new Error("MediaPipe failed on the current video frame.")
          );
        });
      });
    };

    const run = async () => {
      try {
        onProgress({
          status: "loading",
          processedFrames: 0,
          totalFrames: 0,
          coveragePercent: 0,
          currentTime: 0,
          duration: 0,
          message: "Preparing uploaded video for full analysis.",
        });

        const duration = await waitForMetadata(video);
        const sampleTimes = buildSampleTimes(duration);
        const frames: FrameSample[] = [];
        const drillFrames: DribbleFrame[] = [];

        for (let index = 0; index < sampleTimes.length; index++) {
          if (cancelled) return;

          const time = sampleTimes[index] ?? 0;
          await seekVideo(video, time);
          if (cancelled) return;

          const results = await sendPoseForCurrentFrame();
          if (cancelled) return;

          if (results.poseLandmarks) {
            const angles = extractPoseAngles(results.poseLandmarks, analysisType);
            if (angles.length > 0) {
              frames.push({ time, angles });
            }

            if (analysisType === "dribbling" || analysisType === "training") {
              drillFrames.push(extractDribbleFrame(results.poseLandmarks, time));
            }
          }

          onProgress({
            status: "analyzing",
            processedFrames: index + 1,
            totalFrames: sampleTimes.length,
            coveragePercent: ((index + 1) / sampleTimes.length) * 100,
            currentTime: time,
            duration,
            message: "Scanning the full uploaded video.",
          });

          await new Promise((resolve) => window.setTimeout(resolve, 0));
        }

        if (frames.length === 0) {
          throw new Error("No pose landmarks were detected in this uploaded video.");
        }

        onProgress({
          status: "ready",
          processedFrames: sampleTimes.length,
          totalFrames: sampleTimes.length,
          coveragePercent: 100,
          currentTime: duration,
          duration,
          message: "Full-video MediaPipe timeline is ready.",
        });
        onComplete({ frames, drillFrames, duration });
      } catch (runError) {
        if (cancelled) return;

        const message =
          runError instanceof Error ? runError.message : "Automatic video analysis failed.";
        onProgress({
          status: "error",
          processedFrames: 0,
          totalFrames: 0,
          coveragePercent: 0,
          currentTime: 0,
          duration: 0,
          message,
        });
        onError(message);
      }
    };

    run();

    return () => {
      cancelled = true;
      pendingResultRef.current = null;
      video.pause();
    };
  }, [analysisType, error, isReady, onComplete, onError, onProgress, pose, videoUrl]);

  return (
    <video
      ref={videoRef}
      src={videoUrl}
      className="pointer-events-none absolute h-px w-px opacity-0"
      style={{ left: -9999, top: -9999 }}
      aria-hidden="true"
      muted
      playsInline
      preload="auto"
      crossOrigin="anonymous"
    />
  );
}
