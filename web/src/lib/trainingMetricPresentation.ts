import type { ActionTemplate, Metric } from "@/config/templates";
import type { AngleData, MetricScoreBand } from "@/lib/scoring";
import { resolveMetricScoreBand } from "@/lib/scoring";
import type { FrameSample } from "@/store/analysisStore";

export type TrainingMetricChartPoint = {
  time: number;
  value: number;
};

export type TrainingMetricChartModel = {
  metric: Metric;
  points: TrainingMetricChartPoint[];
  savedValue: number | null;
  summaryValue: number | null;
  scoreBand: MetricScoreBand | null;
};

function normalizeMetricKey(value: string): string {
  return value.toLowerCase().replace(/_/g, "").replace(/\s/g, "");
}

function findMetricValue(angles: AngleData[], computeKey: string): number | null {
  const normalizedKey = normalizeMetricKey(computeKey);
  const matches = angles.filter((angle) => normalizeMetricKey(angle.name) === normalizedKey);
  const match = matches.find((angle) => angle.unit === "calc") ?? matches[0];
  return typeof match?.value === "number" && Number.isFinite(match.value) ? match.value : null;
}

function average(points: TrainingMetricChartPoint[]): number | null {
  if (points.length === 0) return null;
  return points.reduce((sum, point) => sum + point.value, 0) / points.length;
}

export function buildTrainingMetricChartModels(
  template: ActionTemplate,
  savedMetrics: AngleData[] | null | undefined,
  timeline: FrameSample[] | null | undefined,
  scoringContext: Record<string, unknown> = {},
): TrainingMetricChartModel[] {
  return template.metrics.map((metric) => {
    const savedValue = findMetricValue(savedMetrics ?? [], metric.computeKey);
    const points = (timeline ?? [])
      .map((frame) => {
        const value = findMetricValue(frame.angles, metric.computeKey);
        return value === null ? null : { time: frame.time, value };
      })
      .filter((point): point is TrainingMetricChartPoint => point !== null);

    return {
      metric,
      points,
      savedValue,
      summaryValue: savedValue ?? average(points),
      scoreBand: resolveMetricScoreBand(metric, {
        ...(template.options || {}),
        ...scoringContext,
      }),
    };
  });
}
