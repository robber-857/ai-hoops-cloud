"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Activity, CheckCircle2, Loader2, Sparkles } from "lucide-react";

import PoseAutoAnalyzer, {
  type AutoAnalysisProgress,
  type AutoAnalysisResult,
} from "./PoseAutoAnalyzer";
import Pose2DCanvas from "./Pose2DCanvas";
import Scrubber from "./Scrubber";
import Controls from "./Controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAnalysisStore, FrameSample } from "@/store/analysisStore";
import { getAllTemplates } from "@/config/templates/index";
import { calculateRealScore } from "@/lib/scoring";
import { routes } from "@/lib/routes";
import { DribbleFrame } from "@/lib/dribbleTemporal";
import { aggregateDribbleSequence } from "@/lib/dribbleCalculator";
import { aggregateTrainingSequence } from "@/lib/trainingCalculator";
import { reportService } from "@/services/reports";
import type { CompletedUploadSession } from "@/services/uploads";
import type { AnalysisType, AngleData } from "./types";

export type { AnalysisType, AngleData } from "./types";

const MIN_ANALYSIS_FRAMES = 12;
const MIN_TEMPORAL_ANALYSIS_FRAMES = 12;
const MIN_SCORING_METRICS = 3;
const MIN_ANALYSIS_COVERAGE_PERCENT = 90;
const LOOP_TOLERANCE_SECONDS = 0.25;

type CaptureStats = {
  samples: number;
  coveredSeconds: number;
  coveragePercent: number;
  latestTime: number;
  ready: boolean;
};

const EMPTY_CAPTURE_STATS: CaptureStats = {
  samples: 0,
  coveredSeconds: 0,
  coveragePercent: 0,
  latestTime: 0,
  ready: false,
};

const EMPTY_AUTO_ANALYSIS_PROGRESS: AutoAnalysisProgress = {
  status: "idle",
  processedFrames: 0,
  totalFrames: 0,
  coveragePercent: 0,
  currentTime: 0,
  duration: 0,
};

function buildCaptureStats(frames: FrameSample[], duration: number): CaptureStats {
  if (frames.length === 0) return EMPTY_CAPTURE_STATS;

  const times = frames
    .map((frame) => frame.time)
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b);

  if (times.length === 0) return EMPTY_CAPTURE_STATS;

  const firstTime = times[0] ?? 0;
  const latestTime = times[times.length - 1] ?? 0;
  const coveredSeconds = Math.max(0, latestTime - firstTime);
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const coveragePercent =
    safeDuration > 0
      ? Math.min(100, Math.max(0, (coveredSeconds / safeDuration) * 100))
      : Math.min(100, frames.length * 5);
  const reachedEnd = safeDuration > 0 && firstTime <= 1 && latestTime >= safeDuration - 0.75;
  const ready =
    frames.length >= MIN_ANALYSIS_FRAMES &&
    (safeDuration === 0 ||
      coveragePercent >= MIN_ANALYSIS_COVERAGE_PERCENT ||
      reachedEnd);

  return {
    samples: frames.length,
    coveredSeconds,
    coveragePercent,
    latestTime,
    ready,
  };
}

function buildTemporalStats(frames: DribbleFrame[], duration: number): CaptureStats {
  if (frames.length === 0) return EMPTY_CAPTURE_STATS;

  const frameSamples: FrameSample[] = frames.map((frame) => ({
    time: frame.t,
    angles: [{ name: "temporalFrame", value: 1 }],
  }));
  const stats = buildCaptureStats(frameSamples, duration);

  return {
    ...stats,
    ready:
      frames.length >= MIN_TEMPORAL_ANALYSIS_FRAMES &&
      (duration <= 0 || stats.coveragePercent >= MIN_ANALYSIS_COVERAGE_PERCENT),
  };
}

function needsTemporalTimeline(analysisType: AnalysisType): boolean {
  return analysisType === "dribbling" || analysisType === "training";
}

type Props = {
  file?: File | null;
  videoUrl?: string | null;
  uploadSession?: CompletedUploadSession | null;
  onClear: () => void;
  analysisType?: AnalysisType;
  templateCode?: string | null;
  templateVersion?: string | null;
};

function aggregateFrames(frames: FrameSample[]): AngleData[] {
  if (frames.length === 0) return [];

  const keys = new Set<string>();
  frames.forEach((frame) => frame.angles.forEach((angle) => keys.add(angle.name)));

  const result: AngleData[] = [];

  keys.forEach((key) => {
    const values = frames
      .map((frame) => frame.angles.find((angle) => angle.name === key))
      .filter((angle) => angle !== undefined)
      .map((angle) => angle!.value);

    if (values.length > 0) {
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const unit = frames
        .find((frame) => frame.angles.find((angle) => angle.name === key))
        ?.angles.find((angle) => angle.name === key)?.unit;

      result.push({ name: key, value: avg, unit });
    }
  });

  return result;
}

function AngleDisplayCard({ title, angles }: { title: string; angles: AngleData[] }) {
  return (
    <Card className="analysis-surface h-full overflow-hidden rounded-[28px] border border-white/10 bg-[#090b10]/92 py-0">
      <CardHeader className="border-b border-white/8 px-5 py-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[0.68rem] uppercase tracking-[0.28em] text-white/42">
              Live panel
            </div>
            <CardTitle className="mt-2 text-xl text-white">{title}</CardTitle>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-white/50">
            {angles.length.toString().padStart(2, "0")} metrics
          </div>
        </div>
      </CardHeader>

      <CardContent className="max-h-[32rem] overflow-y-auto px-5 py-5">
        {angles.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {angles.map((angle) => (
              <div
                key={angle.name}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 shadow-[0_14px_32px_rgba(0,0,0,0.18)]"
              >
                <div className="text-[0.72rem] uppercase tracking-[0.24em] text-white/40">
                  {angle.name}
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <span className="text-3xl font-semibold tracking-[-0.04em] text-sky-300 tabular-nums">
                    {angle.value.toFixed(1)}
                  </span>
                  <span className="rounded-full border border-sky-300/15 bg-sky-300/10 px-2.5 py-1 text-xs uppercase tracking-[0.24em] text-sky-100/80">
                    {angle.unit || "deg"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] py-14 text-center text-white/52">
            <Activity className="h-8 w-8 opacity-50" />
            <p className="mt-3 text-sm font-medium text-white/70">No data to analyze yet</p>
            <p className="mt-1 max-w-xs text-xs leading-6 text-white/42">
              Press play and let the clip run for a few seconds to populate the live metrics panel.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PoseAnalysisView({
  file,
  videoUrl: propVideoUrl,
  uploadSession,
  onClear,
  analysisType = "shooting",
  templateCode,
  templateVersion,
}: Props) {
  const router = useRouter();
  const setAnalysisResult = useAnalysisStore((state) => state.setAnalysisResult);

  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [pendingSeek, setPendingSeek] =
    React.useState<{ time: number; requestId: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [displayAngles, setDisplayAngles] = useState<AngleData[]>([]);
  const [captureStats, setCaptureStats] = useState<CaptureStats>(EMPTY_CAPTURE_STATS);
  const [temporalStats, setTemporalStats] = useState<CaptureStats>(EMPTY_CAPTURE_STATS);
  const [autoAnalysisProgress, setAutoAnalysisProgress] =
    useState<AutoAnalysisProgress>(EMPTY_AUTO_ANALYSIS_PROGRESS);
  const [analysisWarning, setAnalysisWarning] = useState<string | null>(null);

  const localUrlRef = useRef<string | null>(null);
  const allFramesRef = useRef<FrameSample[]>([]);
  const dribbleFramesRef = useRef<DribbleFrame[]>([]);
  const trainingFramesRef = useRef<DribbleFrame[]>([]);
  const latestAnglesRef = useRef<AngleData[]>([]);
  const seekRequestIdRef = useRef(0);
  const autoAnalysisStartedAtRef = useRef<string | null>(null);
  const autoAnalysisFinishedAtRef = useRef<string | null>(null);

  useEffect(() => {
    if (propVideoUrl) {
      if (localUrlRef.current) {
        URL.revokeObjectURL(localUrlRef.current);
        localUrlRef.current = null;
      }
      setVideoUrl(propVideoUrl);
    } else if (file) {
      if (localUrlRef.current) URL.revokeObjectURL(localUrlRef.current);
      const url = URL.createObjectURL(file);
      localUrlRef.current = url;
      setVideoUrl(url);
    } else {
      setVideoUrl("");
    }

    setCurrentTime(0);
    setDuration(0);
    setPendingSeek(null);
    setIsPlaying(false);
    setDisplayAngles([]);
    latestAnglesRef.current = [];
    allFramesRef.current = [];
    dribbleFramesRef.current = [];
    trainingFramesRef.current = [];
    autoAnalysisStartedAtRef.current = null;
    autoAnalysisFinishedAtRef.current = null;
    setIsProcessing(false);
    setCaptureStats(EMPTY_CAPTURE_STATS);
    setTemporalStats(EMPTY_CAPTURE_STATS);
    setAutoAnalysisProgress(EMPTY_AUTO_ANALYSIS_PROGRESS);
    setAnalysisWarning(null);
  }, [file, propVideoUrl]);

  const handleFrameCaptured = useCallback(
    (frame: DribbleFrame) => {
      if (!isPlaying) return;

      if (analysisType === "dribbling") {
        const currentData = dribbleFramesRef.current;
        if (
          currentData.length > 0 &&
          frame.t < currentData[currentData.length - 1].t - LOOP_TOLERANCE_SECONDS
        ) {
          return;
        }
        dribbleFramesRef.current.push(frame);
        setTemporalStats(buildTemporalStats(dribbleFramesRef.current, duration));
      } else if (analysisType === "training") {
        const currentData = trainingFramesRef.current;
        if (
          currentData.length > 0 &&
          frame.t < currentData[currentData.length - 1].t - LOOP_TOLERANCE_SECONDS
        ) {
          return;
        }
        trainingFramesRef.current.push(frame);
        setTemporalStats(buildTemporalStats(trainingFramesRef.current, duration));
      }
    },
    [isPlaying, analysisType, duration]
  );

  const handleAnglesUpdate = useCallback(
    (angles: AngleData[], time: number) => {
      latestAnglesRef.current = angles;
      setDisplayAngles(angles);

      if (isPlaying && angles.length > 0) {
        const history = allFramesRef.current;

        if (history.length > 0) {
          const lastTime = history[history.length - 1].time;
          if (time < lastTime - LOOP_TOLERANCE_SECONDS) {
            return;
          }
        }

        allFramesRef.current.push({ time, angles });
        setCaptureStats(buildCaptureStats(allFramesRef.current, duration));
        setAnalysisWarning((current) => (current ? null : current));
      }
    },
    [isPlaying, duration]
  );

  const handleProcessingChange = useCallback((processing: boolean) => {
    setIsProcessing(processing);
  }, []);

  const handleTimeUpdate = useCallback((curr: number, dur: number) => {
    setCurrentTime(curr);
    setDuration(dur);
  }, []);

  const handleVideoEnd = useCallback(() => {
    setIsPlaying(false);
    setIsProcessing(false);
    setCaptureStats(buildCaptureStats(allFramesRef.current, duration));
    const currentTemporalFrames =
      analysisType === "dribbling"
        ? dribbleFramesRef.current
        : analysisType === "training"
          ? trainingFramesRef.current
          : [];
    setTemporalStats(buildTemporalStats(currentTemporalFrames, duration));
  }, [analysisType, duration]);

  const handleAutoAnalysisProgress = useCallback((progress: AutoAnalysisProgress) => {
    setAutoAnalysisProgress(progress);

    if (progress.status === "loading" || progress.status === "analyzing") {
      if (!autoAnalysisStartedAtRef.current) {
        autoAnalysisStartedAtRef.current = new Date().toISOString();
      }
      autoAnalysisFinishedAtRef.current = null;

      setCaptureStats((current) =>
        current.ready
          ? current
          : {
              samples: progress.processedFrames,
              coveredSeconds: progress.currentTime,
              coveragePercent: progress.coveragePercent,
              latestTime: progress.currentTime,
              ready: false,
          }
      );
    } else if (progress.status === "ready" || progress.status === "error") {
      autoAnalysisFinishedAtRef.current = new Date().toISOString();
    }
  }, []);

  const handleAutoAnalysisComplete = useCallback(
    ({ frames, drillFrames, duration: analyzedDuration }: AutoAnalysisResult) => {
      allFramesRef.current = frames;
      if (analysisType === "dribbling") {
        dribbleFramesRef.current = drillFrames;
      } else if (analysisType === "training") {
        trainingFramesRef.current = drillFrames;
      }

      const latestFrame = frames[frames.length - 1];
      latestAnglesRef.current = latestFrame?.angles ?? [];
      setDisplayAngles(latestFrame?.angles ?? []);
      setDuration(analyzedDuration);

      const latestStats = buildCaptureStats(frames, analyzedDuration);
      const latestTemporalStats = buildTemporalStats(drillFrames, analyzedDuration);
      setCaptureStats(latestStats);
      setTemporalStats(needsTemporalTimeline(analysisType) ? latestTemporalStats : EMPTY_CAPTURE_STATS);
      autoAnalysisFinishedAtRef.current = autoAnalysisFinishedAtRef.current ?? new Date().toISOString();
      setAnalysisWarning(
        latestStats.ready && (!needsTemporalTimeline(analysisType) || latestTemporalStats.ready)
          ? null
          : "Automatic analysis finished, but it did not capture enough usable motion frames. Try a clearer clip or play the clip once manually."
      );
    },
    [analysisType]
  );

  const handleAutoAnalysisError = useCallback((message: string) => {
    setAnalysisWarning(`${message} You can still play the clip once to collect frames manually.`);
  }, []);

  const handleGenerateReport = async () => {
    setIsPlaying(false);
    setAnalysisWarning(null);

    if (
      autoAnalysisProgress.status === "loading" ||
      autoAnalysisProgress.status === "analyzing"
    ) {
      setAnalysisWarning("Full-video analysis is still running. Please wait until it finishes.");
      return;
    }

    if (allFramesRef.current.length === 0 && latestAnglesRef.current.length > 0) {
      allFramesRef.current.push({ time: currentTime, angles: latestAnglesRef.current });
    }

    const latestStats = buildCaptureStats(allFramesRef.current, duration);
    setCaptureStats(latestStats);

    if (!latestStats.ready) {
      setAnalysisWarning(
        "Automatic analysis has not captured enough frames yet. Wait for it to finish or play the clip once manually."
      );
      return;
    }

    const currentTemporalFrames =
      analysisType === "dribbling"
        ? dribbleFramesRef.current
        : analysisType === "training"
          ? trainingFramesRef.current
          : [];
    const latestTemporalStats = buildTemporalStats(currentTemporalFrames, duration);
    setTemporalStats(
      needsTemporalTimeline(analysisType) ? latestTemporalStats : EMPTY_CAPTURE_STATS,
    );

    if (needsTemporalTimeline(analysisType) && !latestTemporalStats.ready) {
      setAnalysisWarning(
        `${analysisType} reports need a full motion sequence. Collected ${currentTemporalFrames.length}/${MIN_TEMPORAL_ANALYSIS_FRAMES} sequence frames; wait for automatic analysis or play the clip once manually.`
      );
      return;
    }

    setIsGeneratingReport(true);

    try {
      const templates = getAllTemplates(analysisType);
      const activeTemplate =
        templates.find((template) => template.templateId === templateCode) ?? templates[0];

      if (!activeTemplate) {
        alert("No analysis template is available for this mode.");
        setIsGeneratingReport(false);
        return;
      }

      if (!uploadSession?.sessionPublicId) {
        alert("Upload session is missing. Please upload the video again.");
        setIsGeneratingReport(false);
        return;
      }

      let finalInputForScoring: AngleData[] = [];
      let detectedHandness = "right";

      if (analysisType === "dribbling") {
        const dribbleFrames = dribbleFramesRef.current;

        const { computedValues, handUsed } = aggregateDribbleSequence(
          dribbleFrames,
          activeTemplate
        );
        detectedHandness = handUsed;

        const dynamicMetrics: AngleData[] = Object.entries(computedValues).map(
          ([key, value]) => ({
            name: key,
            value,
            unit: "calc",
          })
        );

        const staticMetrics = aggregateFrames(allFramesRef.current);
        finalInputForScoring = [...staticMetrics, ...dynamicMetrics];
      } else if (analysisType === "training") {
        const trainingFrames = trainingFramesRef.current;

        console.log("Analyzing Training Data:", trainingFrames.length, "frames");
        const computedStats = aggregateTrainingSequence(
          trainingFrames,
          activeTemplate,
          allFramesRef.current
        );

        const dynamicMetrics: AngleData[] = Object.entries(computedStats)
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => ({
            name: key,
            value: value as number,
            unit: "calc",
          }));

        finalInputForScoring = dynamicMetrics;
      } else {
        finalInputForScoring = aggregateFrames(allFramesRef.current);
      }

      if (finalInputForScoring.length < MIN_SCORING_METRICS) {
        setAnalysisWarning(
          `Only ${finalInputForScoring.length}/${MIN_SCORING_METRICS} scoring metrics were collected. Use a clearer full-body clip and try again.`
        );
        setIsGeneratingReport(false);
        return;
      }

      const realScoreResult = calculateRealScore(activeTemplate, finalInputForScoring, {
        handedness: detectedHandness,
      });

      let longTermVideoUrl = videoUrl;

      if (longTermVideoUrl.startsWith("blob:")) {
        alert("Cloud upload not ready. Please wait a moment or re-upload.");
        console.error("Blocking save: Video URL is still a local blob.", longTermVideoUrl);
        setIsGeneratingReport(false);
        return;
      }

      const scoreDataToSave = {
        ...realScoreResult,
        saved_metrics: finalInputForScoring,
      };
      const captureSource =
        autoAnalysisProgress.status === "ready" ? "auto_full_video" : "manual_playback";
      const analysisStartedAt =
        captureSource === "auto_full_video" ? autoAnalysisStartedAtRef.current : null;
      const analysisFinishedAt =
        captureSource === "auto_full_video" ? autoAnalysisFinishedAtRef.current : null;

      const savedReport = await reportService.saveReport({
        session_public_id: uploadSession.sessionPublicId,
        template_code: activeTemplate.templateId,
        template_version: templateVersion ?? "v1",
        overall_score: realScoreResult.overall,
        grade: realScoreResult.grade,
        score_data: scoreDataToSave,
        timeline_data: allFramesRef.current,
        summary_data: {
          analysis_type: analysisType,
          handedness: detectedHandness,
          metrics_count: finalInputForScoring.length,
          template_name: activeTemplate.displayName,
          capture_source: captureSource,
          timeline_frames: allFramesRef.current.length,
          timeline_duration_seconds: duration,
          timeline_coverage_percent: Math.round(latestStats.coveragePercent * 100) / 100,
          temporal_frames: currentTemporalFrames.length,
          temporal_coverage_percent:
            Math.round(latestTemporalStats.coveragePercent * 100) / 100,
          min_analysis_frames: MIN_ANALYSIS_FRAMES,
          min_temporal_analysis_frames: MIN_TEMPORAL_ANALYSIS_FRAMES,
          min_scoring_metrics: MIN_SCORING_METRICS,
          analysis_data_ready:
            latestStats.ready &&
            (!needsTemporalTimeline(analysisType) || latestTemporalStats.ready) &&
            finalInputForScoring.length >= MIN_SCORING_METRICS,
          auto_analysis_status: autoAnalysisProgress.status,
          auto_analysis_processed_frames: autoAnalysisProgress.processedFrames,
          auto_analysis_total_frames: autoAnalysisProgress.totalFrames,
        },
        analysis_started_at: analysisStartedAt,
        analysis_finished_at: analysisFinishedAt,
      });

      longTermVideoUrl = savedReport.video_url ?? uploadSession.videoUrl ?? longTermVideoUrl;
      console.log("Report saved through backend, public ID:", savedReport.public_id);

      setAnalysisResult({
        videoUrl: longTermVideoUrl,
        angles: finalInputForScoring,
        timeline: allFramesRef.current,
        score: realScoreResult,
        template: activeTemplate,
      });

      router.push(`${routes.pose2d.report}?id=${savedReport.public_id}`);
    } catch (error) {
      console.error("Analysis/Save failed:", error);
      alert("Failed to save report to cloud. Please check console.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const isAutoAnalyzing =
    autoAnalysisProgress.status === "loading" || autoAnalysisProgress.status === "analyzing";
  const isAutoError = autoAnalysisProgress.status === "error";
  const requiresTemporal = needsTemporalTimeline(analysisType);
  const analysisDataReady = captureStats.ready && (!requiresTemporal || temporalStats.ready);
  const progressPercent = Math.round(
    requiresTemporal && captureStats.ready && !temporalStats.ready
      ? temporalStats.coveragePercent
      : captureStats.ready
        ? captureStats.coveragePercent
        : autoAnalysisProgress.coveragePercent
  );
  const displayedSamples =
    requiresTemporal && captureStats.ready && !temporalStats.ready
      ? temporalStats.samples
      : captureStats.ready
        ? captureStats.samples
        : Math.max(captureStats.samples, autoAnalysisProgress.processedFrames);
  const isCollectingFrames = (isAutoAnalyzing || isPlaying || isProcessing) && !analysisDataReady;
  const AnalysisStatusIcon = analysisDataReady
    ? CheckCircle2
    : isCollectingFrames
      ? Loader2
      : AlertCircle;
  const analysisTitle = analysisDataReady
    ? "Analysis data ready"
    : captureStats.ready && requiresTemporal && !temporalStats.ready
      ? "Motion sequence needs more frames"
    : isAutoAnalyzing
      ? "Analyzing full video"
      : isAutoError
        ? "Automatic analysis needs help"
        : isCollectingFrames
      ? "Analyzing video frames"
      : captureStats.samples > 0
        ? "Analysis needs a full pass"
        : "Waiting for video frames";
  const analysisDescription = analysisDataReady
    ? "The report will use a full-video MediaPipe timeline with enough scoring data."
    : captureStats.ready && requiresTemporal && !temporalStats.ready
      ? "This mode needs continuous motion frames for dynamic metrics. Let auto analysis finish or play the clip once manually."
    : isAutoAnalyzing
      ? "The uploaded clip is being scanned frame by frame. View Analysis unlocks when it finishes."
      : isAutoError
        ? "Play the clip once manually, or upload a clearer clip if pose landmarks were not detected."
        : captureStats.samples > 0
          ? "Keep playing from the beginning until the progress reaches the end of the clip."
          : "Automatic full-video analysis starts after the MediaPipe engine loads.";
  const coverageLabel =
    isAutoAnalyzing && autoAnalysisProgress.totalFrames > 0
      ? `${autoAnalysisProgress.processedFrames}/${autoAnalysisProgress.totalFrames} frames · ${autoAnalysisProgress.currentTime.toFixed(1)}s / ${autoAnalysisProgress.duration.toFixed(1)}s`
      : isAutoAnalyzing
        ? autoAnalysisProgress.message ?? "Preparing full-video analysis"
        : requiresTemporal
          ? `${captureStats.samples} pose frames / ${temporalStats.samples} motion frames`
        : duration > 0
          ? `${captureStats.coveredSeconds.toFixed(1)}s / ${duration.toFixed(1)}s covered`
          : `${captureStats.samples} frames captured`;
  const reportButtonLabel = isGeneratingReport
    ? "Saving..."
    : analysisDataReady
      ? "View Analysis Report"
      : "Collecting frames";

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
      <div className="space-y-5">
        <section className="analysis-surface rounded-[28px] border border-white/10 p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[0.68rem] uppercase tracking-[0.28em] text-white/42">
                Live capture
              </div>
              <div className="mt-2 text-xl font-semibold text-white">
                Pose tracking workspace
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.26em] text-white/55">
                {analysisType}
              </div>
              <div className="rounded-full border border-sky-300/18 bg-sky-300/10 px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.26em] text-sky-100/80">
                {captureStats.ready
                  ? "Report ready"
                  : isAutoAnalyzing
                    ? "Auto analysis"
                    : isProcessing
                      ? "Analyzing"
                      : "Awaiting frames"}
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-black shadow-[0_24px_60px_rgba(0,0,0,0.3)]">
            <div className="absolute inset-x-4 top-4 z-20 flex flex-wrap items-center gap-2">
              <div className="rounded-full border border-white/12 bg-black/35 px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.26em] text-white/68 backdrop-blur-md">
                Motion overlay
              </div>
              <div className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1.5 text-[0.68rem] uppercase tracking-[0.26em] text-sky-100/80 backdrop-blur-md">
                Frame sync active
              </div>
            </div>

            <div className="aspect-video relative">
              {videoUrl && (
                <PoseAutoAnalyzer
                  key={`${videoUrl}-${analysisType}`}
                  videoUrl={videoUrl}
                  analysisType={analysisType}
                  onProgress={handleAutoAnalysisProgress}
                  onComplete={handleAutoAnalysisComplete}
                  onError={handleAutoAnalysisError}
                />
              )}

              <Pose2DCanvas
                videoUrl={videoUrl}
                isPlaying={isPlaying}
                onVideoEnd={handleVideoEnd}
                onTime={handleTimeUpdate}
                seekTo={pendingSeek}
                analysisType={analysisType}
                onAnglesUpdate={handleAnglesUpdate}
                onFrameCaptured={handleFrameCaptured}
                onProcessing={handleProcessingChange}
              />

              {(isProcessing || isAutoAnalyzing) && (
                <div className="absolute bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-sky-300/25 bg-black/55 px-3 py-2 text-[0.68rem] uppercase tracking-[0.24em] text-sky-100/85 backdrop-blur-md">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isAutoAnalyzing ? "Analyzing full video" : "Analyzing frames"}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="analysis-surface rounded-[28px] border border-white/10 p-4 sm:p-5">
          <div className="text-[0.68rem] uppercase tracking-[0.28em] text-white/42">
            Timeline controls
          </div>

          <div className="mt-3 rounded-[22px] border border-white/10 bg-white/[0.03] px-2 py-2 sm:px-3">
            <Scrubber
              current={currentTime}
              duration={duration}
              onScrub={(sec) => {
                setCurrentTime(sec);
              }}
              onScrubEnd={(sec) => {
                const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
                const nextTime = safeDuration > 0 ? Math.min(Math.max(sec, 0), safeDuration) : Math.max(sec, 0);
                seekRequestIdRef.current += 1;
                setCurrentTime(nextTime);
                setPendingSeek({ time: nextTime, requestId: seekRequestIdRef.current });
              }}
            />
          </div>

          <div className="mt-4 rounded-[22px] border border-white/10 bg-white/[0.035] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border ${
                    captureStats.ready
                      ? "border-emerald-300/25 bg-emerald-300/12 text-emerald-200"
                      : "border-sky-300/20 bg-sky-300/10 text-sky-100"
                  }`}
                >
                  <AnalysisStatusIcon
                    className={`h-5 w-5 ${isCollectingFrames ? "animate-spin" : ""}`}
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{analysisTitle}</div>
                  <div className="mt-1 text-xs leading-5 text-white/52">{analysisDescription}</div>
                </div>
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <div className="text-2xl font-semibold text-white tabular-nums">
                  {progressPercent}%
                </div>
                <div className="mt-1 text-[0.68rem] uppercase tracking-[0.22em] text-white/42">
                  {displayedSamples} samples
                </div>
              </div>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full ${
                  captureStats.ready ? "bg-emerald-300" : "bg-sky-300"
                }`}
                style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
              />
            </div>

            <div className="mt-3 flex flex-col gap-2 text-xs text-white/46 sm:flex-row sm:items-center sm:justify-between">
              <span>{coverageLabel}</span>
              <span>Full-video timeline is kept until a new upload starts.</span>
            </div>

            {analysisWarning && (
              <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs leading-5 text-amber-100/85">
                {analysisWarning}
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Controls
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying((p) => !p)}
              onClear={onClear}
              playDisabled={isAutoAnalyzing}
            />

            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <div className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-3 text-[0.72rem] uppercase tracking-[0.24em] text-white/55">
                {isGeneratingReport ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isGeneratingReport
                  ? "Saving report"
                  : captureStats.ready
                    ? "Report ready"
                    : "Collecting timeline"}
              </div>
              <Button
                onClick={handleGenerateReport}
                disabled={isGeneratingReport || isAutoAnalyzing || !captureStats.ready}
                className="min-h-12 rounded-full border border-indigo-300/20 bg-indigo-400 px-5 text-slate-950 shadow-[0_14px_35px_rgba(129,140,248,0.28)] hover:bg-indigo-300"
              >
                {reportButtonLabel}
                {!isGeneratingReport && captureStats.ready && <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </section>
      </div>

      <div className="min-h-0">
        <AngleDisplayCard title="Real-time Metrics" angles={displayAngles} />
      </div>
    </div>
  );
}
