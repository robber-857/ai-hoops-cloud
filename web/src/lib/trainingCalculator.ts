import type { ActionTemplate } from "@/config/templates";
import type { AngleData } from "@/lib/scoring";

import type { DribbleFrame } from "./dribbleTemporal";
import {
  aggregateLegacyTrainingTemplate,
  aggregateSpecializedTrainingTemplate,
  type TrainingMetricValues,
} from "./trainingAggregators";
import { median, standardDeviation } from "./trainingGeometry";

type TimelineFrame = {
  time: number;
  angles: AngleData[];
};

type TimedValue = {
  time: number;
  value: number;
};

export type TrainingAnalysisStatus = "ready" | "insufficient_data";

export interface TrainingAggregationResult {
  metrics: TrainingMetricValues;
  analysisStatus: TrainingAnalysisStatus;
  missingRequiredKeys: string[];
  consistencyAvailable: boolean;
  cameraMatch: boolean | null;
  reason?: string;
}

const TIMELINE_METRIC_ALIASES: Record<string, string[]> = {
  plankBodyLineDeg: ["plankBodyLineDeg", "bodyLineDeg"],
  avgElbowAngleDeg: [
    "avgElbowAngleDeg",
    "elbowAngleDeg",
    "rightElbowAngleDeg",
    "leftElbowAngleDeg",
  ],
  avgKneeAngleDeg: ["avgKneeAngleDeg", "kneeAngleDeg"],
  trunkLeanDegSide: ["trunkLeanDegSide", "torsoLeanDegSide"],
  torsoLeanDegSide: ["torsoLeanDegSide", "trunkLeanDegSide"],
};

function getTimelineMetric(frame: TimelineFrame, computeKey: string): number | undefined {
  const keys = TIMELINE_METRIC_ALIASES[computeKey] ?? [computeKey];
  for (const key of keys) {
    const value = frame.angles.find((angle) => angle.name === key)?.value;
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function buildTimelineSeries(
  timelineFrames: TimelineFrame[] | null | undefined,
  computeKey: string,
): TimedValue[] {
  if (!timelineFrames?.length) return [];
  return timelineFrames
    .map((frame) => {
      const value = getTimelineMetric(frame, computeKey);
      return value === undefined || !Number.isFinite(frame.time)
        ? null
        : { time: frame.time, value };
    })
    .filter((point): point is TimedValue => point !== null)
    .sort((a, b) => a.time - b.time);
}

function putMetric(metrics: TrainingMetricValues, key: string, value: number | undefined) {
  if (value !== undefined && Number.isFinite(value)) metrics[key] = value;
}

export function aggregateTrainingTimelineMetrics(
  timelineFrames: TimelineFrame[] | null | undefined,
  template: ActionTemplate,
): TrainingMetricValues {
  const metrics: TrainingMetricValues = {};
  if (!timelineFrames?.length) return metrics;

  const requestedKeys = new Set(template.metrics.map((metric) => metric.computeKey));
  const addMedian = (key: string) => {
    if (!requestedKeys.has(key)) return;
    putMetric(metrics, key, median(buildTimelineSeries(timelineFrames, key).map((point) => point.value)));
  };
  const addDeviation = (key: string, sourceKey: string) => {
    if (!requestedKeys.has(key)) return;
    putMetric(
      metrics,
      key,
      standardDeviation(buildTimelineSeries(timelineFrames, sourceKey).map((point) => point.value)),
    );
  };

  addMedian("plankBodyLineDeg");
  addDeviation("stdPlankBodyLineDeg", "plankBodyLineDeg");
  addMedian("avgElbowAngleDeg");
  addMedian("avgKneeAngleDeg");
  addDeviation("stdKneeAngleDeg", "avgKneeAngleDeg");
  addMedian("trunkLeanDegSide");
  addMedian("torsoLeanDegSide");

  return metrics;
}

export function mergeTrainingTimelineMetrics(
  metrics: AngleData[] | null | undefined,
  timelineFrames: TimelineFrame[] | null | undefined,
  template: ActionTemplate,
): AngleData[] {
  const merged = new Map<string, AngleData>();
  (metrics ?? []).forEach((metric) => merged.set(metric.name, metric));

  Object.entries(aggregateTrainingTimelineMetrics(timelineFrames, template)).forEach(
    ([name, value]) => {
      if (!merged.has(name)) merged.set(name, { name, value, unit: "calc" });
    },
  );

  return Array.from(merged.values());
}

function inferCameraMatch(frames: DribbleFrame[], template: ActionTemplate): boolean | null {
  const valid = frames.filter((frame) => typeof frame.isSideView === "boolean");
  if (valid.length < 3) return null;
  const sideRatio = valid.filter((frame) => frame.isSideView).length / valid.length;
  return template.camera === "side" ? sideRatio >= 0.55 : sideRatio < 0.55;
}

export function aggregateTrainingSequence(
  frames: DribbleFrame[],
  template: ActionTemplate,
  timelineFrames?: TimelineFrame[] | null,
): TrainingAggregationResult {
  const specialized = aggregateSpecializedTrainingTemplate(frames, template.templateId);
  const aggregated = specialized ?? aggregateLegacyTrainingTemplate(frames, template.templateId);
  const metrics: TrainingMetricValues = {
    ...aggregateTrainingTimelineMetrics(timelineFrames, template),
    ...aggregated.metrics,
  };

  const requiredKeys = template.metrics
    .filter((metric) => metric.category === "posture" || metric.category === "execution")
    .map((metric) => metric.computeKey);
  const missingRequiredKeys = requiredKeys.filter((key) => !(key in metrics));
  const consistencyKeys = template.metrics
    .filter((metric) => metric.category === "consistency")
    .map((metric) => metric.computeKey);
  const consistencyAvailable =
    consistencyKeys.length > 0 && consistencyKeys.some((key) => key in metrics);
  const postureAvailable = template.metrics
    .filter((metric) => metric.category === "posture")
    .some((metric) => metric.computeKey in metrics);
  const executionAvailable = template.metrics
    .filter((metric) => metric.category === "execution")
    .some((metric) => metric.computeKey in metrics);
  const analysisStatus: TrainingAnalysisStatus =
    postureAvailable && executionAvailable ? "ready" : "insufficient_data";

  return {
    metrics,
    analysisStatus,
    missingRequiredKeys,
    consistencyAvailable,
    cameraMatch: inferCameraMatch(frames, template),
    reason:
      analysisStatus === "ready"
        ? undefined
        : aggregated.reason ??
          "At least one clear posture check and one clear movement check are required.",
  };
}
