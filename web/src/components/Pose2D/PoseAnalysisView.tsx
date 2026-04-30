"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Activity, Sparkles } from "lucide-react";

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

export type AnalysisType = "shooting" | "dribbling" | "training";
export type AngleData = { name: string; value: number; unit?: string };

type Props = {
  file?: File | null;
  videoUrl?: string | null;
  uploadSession?: CompletedUploadSession | null;
  onClear: () => void;
  analysisType?: AnalysisType;
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
}: Props) {
  const router = useRouter();
  const setAnalysisResult = useAnalysisStore((state) => state.setAnalysisResult);

  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [pendingSeek, setPendingSeek] = React.useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [displayAngles, setDisplayAngles] = useState<AngleData[]>([]);

  const localUrlRef = useRef<string | null>(null);
  const allFramesRef = useRef<FrameSample[]>([]);
  const dribbleFramesRef = useRef<DribbleFrame[]>([]);
  const trainingFramesRef = useRef<DribbleFrame[]>([]);
  const latestAnglesRef = useRef<AngleData[]>([]);

  useEffect(() => {
    if (propVideoUrl) {
      setVideoUrl(propVideoUrl);
      return;
    }

    if (file) {
      if (localUrlRef.current) URL.revokeObjectURL(localUrlRef.current);
      const url = URL.createObjectURL(file);
      localUrlRef.current = url;
      setVideoUrl(url);
    }

    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setDisplayAngles([]);
    latestAnglesRef.current = [];
    allFramesRef.current = [];
    dribbleFramesRef.current = [];
    setIsProcessing(false);
  }, [file, propVideoUrl]);

  const handleFrameCaptured = useCallback(
    (frame: DribbleFrame) => {
      if (!isPlaying) return;

      if (analysisType === "dribbling") {
        const currentData = dribbleFramesRef.current;
        if (currentData.length > 0 && frame.t < currentData[currentData.length - 1].t - 0.5) {
          dribbleFramesRef.current = [];
        }
        dribbleFramesRef.current.push(frame);
      } else if (analysisType === "training") {
        const currentData = trainingFramesRef.current;
        if (currentData.length > 0 && frame.t < currentData[currentData.length - 1].t - 0.5) {
          trainingFramesRef.current = [];
        }
        trainingFramesRef.current.push(frame);
      }
    },
    [isPlaying, analysisType]
  );

  const handleAnglesUpdate = useCallback(
    (angles: AngleData[], time: number) => {
      latestAnglesRef.current = angles;
      setDisplayAngles(angles);

      if (isPlaying && angles.length > 0) {
        const history = allFramesRef.current;

        if (history.length > 0) {
          const lastTime = history[history.length - 1].time;
          if (time < lastTime - 0.5) {
            console.log("Loop detected in Timeline. Resetting.");
            allFramesRef.current = [];
          }
        }

        allFramesRef.current.push({ time, angles });
      }
    },
    [isPlaying]
  );

  const handleGenerateReport = async () => {
    setIsPlaying(false);

    if (allFramesRef.current.length === 0 && latestAnglesRef.current.length > 0) {
      allFramesRef.current.push({ time: 0, angles: latestAnglesRef.current });
    }

    if (allFramesRef.current.length === 0) {
      alert(
        "If you find the black screen time is too long, please try again in an area with a smooth internet connection. After the screen displays, play for a few seconds before clicking the button."
      );
      return;
    }

    setIsGeneratingReport(true);

    try {
      const templates = getAllTemplates(analysisType);
      const activeTemplate = templates[0];

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

        if (dribbleFrames.length > 10) {
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
        } else {
          console.warn("Not enough dribble frames. Fallback to static.");
          finalInputForScoring = aggregateFrames(allFramesRef.current);
        }
      } else if (analysisType === "training") {
        const trainingFrames = trainingFramesRef.current;

        if (trainingFrames.length > 10) {
          console.log("Analyzing Training Data:", trainingFrames.length, "frames");
          const computedStats = aggregateTrainingSequence(trainingFrames, activeTemplate);

          const dynamicMetrics: AngleData[] = Object.entries(computedStats)
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => ({
              name: key,
              value: value as number,
              unit: "calc",
            }));

          const staticMetrics = aggregateFrames(allFramesRef.current);
          finalInputForScoring = [...staticMetrics, ...dynamicMetrics];
        } else {
          finalInputForScoring = aggregateFrames(allFramesRef.current);
        }
      } else {
        finalInputForScoring = aggregateFrames(allFramesRef.current);
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

      const savedReport = await reportService.saveReport({
        session_public_id: uploadSession.sessionPublicId,
        template_code: activeTemplate.templateId,
        template_version: "v1",
        overall_score: realScoreResult.overall,
        grade: realScoreResult.grade,
        score_data: scoreDataToSave,
        timeline_data: allFramesRef.current,
        summary_data: {
          analysis_type: analysisType,
          handedness: detectedHandness,
          metrics_count: finalInputForScoring.length,
          template_name: activeTemplate.displayName,
        },
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
                {isProcessing ? "Processing" : "Ready"}
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
              <Pose2DCanvas
                videoUrl={videoUrl}
                isPlaying={isPlaying}
                onVideoEnd={() => setIsPlaying(false)}
                onTime={(curr, dur) => {
                  setCurrentTime(curr);
                  setDuration(dur);
                }}
                seekTo={pendingSeek}
                analysisType={analysisType}
                onAnglesUpdate={handleAnglesUpdate}
                onFrameCaptured={handleFrameCaptured}
                onProcessing={(processing) => setIsProcessing(processing)}
              />

              {isProcessing && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-9 w-9 rounded-full border-4 border-sky-400 border-t-transparent animate-spin" />
                    <span className="text-sm font-medium tracking-[0.18em] text-white">
                      AI Processing...
                    </span>
                  </div>
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
                setPendingSeek(sec);
                setTimeout(() => setPendingSeek(null), 0);
              }}
            />
          </div>

          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Controls
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying((p) => !p)}
              onClear={onClear}
            />

            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <div className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-3 text-[0.72rem] uppercase tracking-[0.24em] text-white/55">
                <Sparkles className="h-4 w-4" />
                {isGeneratingReport ? "Saving report" : "Report ready"}
              </div>
              <Button
                onClick={handleGenerateReport}
                disabled={isGeneratingReport || isProcessing}
                className="min-h-12 rounded-full border border-indigo-300/20 bg-indigo-400 px-5 text-slate-950 shadow-[0_14px_35px_rgba(129,140,248,0.28)] hover:bg-indigo-300"
              >
                {isGeneratingReport ? "Saving..." : "View Analysis Report"}
                {!isGeneratingReport && <ArrowRight className="h-4 w-4" />}
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
