import type { ActionTemplate, Metric, Weights } from "@/config/templates/index";
import globalConfig from "@/config/templates/global.json";

export type Grade = "S" | "A" | "B" | "C" | "D" | "E" | "F";
export type FindingState = "good" | "low" | "high" | "missing";

export interface Finding {
  id: string;
  title: string;
  score: number;
  isPositive: boolean;
  isMissing?: boolean;
  state: FindingState;
  actualValue: string | null;
  targetText: string;
  hint: string;
  category: "posture" | "execution" | "consistency";
}

export interface ScoreResult {
  overall: number;
  grade: Grade;
  analysisStatus: "ready" | "insufficient_data";
  weights: Weights;
  availability: Record<"posture" | "execution" | "consistency", boolean>;
  breakdown: {
    posture: number;
    execution: number;
    consistency: number;
  };
  findings: Finding[];
}

export type AngleData = { name: string; value: number; unit?: string };

export type MetricScoreBand = {
  kind: "boolean" | "range" | "target";
  min: number;
  max: number;
  margin: number;
  target?: number;
  scoreFloorInsideBand: number;
  scoreCeilingInsideBand: number;
};

const DEFAULT_CATEGORY_WEIGHTS: Weights = { posture: 0.4, execution: 0.4, consistency: 0.2 };

export function getGradeColor(grade: Grade): string {
  switch (grade) {
    case "S":
      return "text-purple-400";
    case "A":
      return "text-blue-400";
    case "B":
      return "text-emerald-400";
    case "C":
      return "text-yellow-400";
    case "D":
      return "text-orange-400";
    default:
      return "text-red-400";
  }
}

function getAgeToleranceMultiplier(ageGroup: string): number {
  const scaleMap = globalConfig.ageToleranceScale as Record<string, number>;
  return scaleMap[ageGroup] || 1;
}

function normalizeMetricKey(key: string): string {
  return key.toLowerCase().replace(/_/g, "").replace(/\s/g, "");
}

function getMetricTitle(metric: Metric): string {
  return (
    metric.displayName ||
    metric.metricId.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function getGrade(score: number): Grade {
  if (score >= 90) return "S";
  if (score >= 85) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

function getMissingHint(template: ActionTemplate): string {
  return `There is not enough clear movement data for this check. Use a clear ${template.camera} view and keep the full body visible.`;
}

function getTargetText(metric: Metric): string {
  if (metric.targetText) return metric.targetText;
  if (metric.type === "range" && metric.params.L !== undefined && metric.params.U !== undefined) {
    return `Aim for ${metric.params.L}-${metric.params.U}.`;
  }
  if (metric.type === "target" && metric.params.target !== undefined) {
    return `Aim close to ${metric.params.target}.`;
  }
  return "Follow the target movement shown for this check.";
}

function formatActualValue(metric: Metric, value: number): string {
  const precision = metric.precision ?? (metric.unit === "deg" ? 0 : 2);
  const formatted = value.toFixed(precision);
  if (metric.unit === "deg") return `${formatted} degrees`;
  if (metric.unit === "ratio") return `${formatted} ratio`;
  if (metric.unit === "norm") return formatted;
  return formatted;
}

function getHint(metric: Metric, state: FindingState): string {
  if (state === "good") return metric.hint_good || "This part of the movement was done well.";
  if (state === "low") {
    return metric.hint_low || metric.hint_bad || "This value was below the target range.";
  }
  return metric.hint_high || metric.hint_bad || "This value was above the target range.";
}

type MetricScore = {
  score: number;
  state: Exclude<FindingState, "missing">;
};

export function resolveMetricScoreBand(
  metric: Metric,
  options: Record<string, unknown> = {},
): MetricScoreBand | null {
  const ageGroup = (options.ageGroup as string) || "16-18";
  const toleranceMultiplier = getAgeToleranceMultiplier(ageGroup);
  const relax = (amount: number | undefined, fallback: number) =>
    (amount ?? fallback) * toleranceMultiplier;

  if (metric.type === "boolean") {
    const target = metric.params.target ?? 1;
    return {
      kind: "boolean",
      min: target,
      max: target,
      margin: 0,
      target,
      scoreFloorInsideBand: 100,
      scoreCeilingInsideBand: 100,
    };
  }

  if (metric.type === "rangeByOption") {
    const optionKey = metric.params.optionKey || "handedness";
    const selected = (options[optionKey] as string) || "right";
    const range = metric.params.ranges?.[selected];
    if (!range) return null;
    return {
      kind: "range",
      min: range.L,
      max: range.U,
      margin: relax(range.margin, 0.1),
      scoreFloorInsideBand: 100,
      scoreCeilingInsideBand: 100,
    };
  }

  if (metric.type === "target") {
    const target = metric.params.target ?? 0;
    const tolerance = relax(metric.params.tol, 5);
    return {
      kind: "target",
      min: target - tolerance,
      max: target + tolerance,
      margin: relax(metric.params.margin, 15),
      target,
      scoreFloorInsideBand: 90,
      scoreCeilingInsideBand: 100,
    };
  }

  if (metric.type === "range") {
    return {
      kind: "range",
      min: metric.params.L ?? 0,
      max: metric.params.U ?? 180,
      margin: relax(metric.params.margin, 15),
      scoreFloorInsideBand: 100,
      scoreCeilingInsideBand: 100,
    };
  }

  return null;
}

function scoreMetric(
  metric: Metric,
  value: number,
  options: Record<string, unknown>,
): MetricScore | null {
  if (metric.type === "boolean") {
    const target = metric.params.target ?? 1;
    return Math.round(value) === target
      ? { score: 100, state: "good" }
      : { score: 0, state: value < target ? "low" : "high" };
  }

  const band = resolveMetricScoreBand(metric, options);
  if (!band) return null;

  if (band.kind === "target") {
    const target = band.target ?? 0;
    const tolerance = Math.max(0, band.max - target);
    const difference = Math.abs(value - target);
    if (difference <= tolerance) {
      const withinToleranceScore = tolerance > 0 ? 100 - (difference / tolerance) * 10 : 100;
      return { score: withinToleranceScore, state: "good" };
    }
    const extraDifference = difference - tolerance;
    return {
      score: extraDifference > band.margin ? 0 : 90 - (extraDifference / band.margin) * 90,
      state: value < target ? "low" : "high",
    };
  }

  if (band.kind === "range") {
    if (value >= band.min && value <= band.max) return { score: 100, state: "good" };
    if (value < band.min) {
      return {
        score: Math.max(0, 100 - ((band.min - value) / band.margin) * 100),
        state: "low",
      };
    }
    return {
      score: Math.max(0, 100 - ((value - band.max) / band.margin) * 100),
      state: "high",
    };
  }

  return null;
}

export function calculateRealScore(
  template: ActionTemplate,
  currentAngles: AngleData[],
  options: Record<string, unknown> = {},
): ScoreResult {
  const ageGroup = (options.ageGroup as string) || "16-18";
  const configuredWeights =
    template.overallWeights || template.categoryWeights || DEFAULT_CATEGORY_WEIGHTS;
  const scoringOptions = { ...(template.options || {}), ...options, ageGroup };
  const categoryScores = {
    posture: { score: 0, weight: 0 },
    execution: { score: 0, weight: 0 },
    consistency: { score: 0, weight: 0 },
  };
  const findings: Finding[] = [];

  template.metrics.forEach((metric) => {
    const targetKey = normalizeMetricKey(metric.computeKey);
    const matchedData = currentAngles.find((angle) => normalizeMetricKey(angle.name) === targetKey);
    const title = getMetricTitle(metric);
    const targetText = getTargetText(metric);

    if (!matchedData || !Number.isFinite(matchedData.value)) {
      findings.push({
        id: metric.metricId,
        title,
        score: 0,
        isPositive: false,
        isMissing: true,
        state: "missing",
        actualValue: null,
        targetText,
        hint: getMissingHint(template),
        category: metric.category,
      });
      return;
    }

    const scored = scoreMetric(metric, matchedData.value, scoringOptions);
    if (!scored) {
      findings.push({
        id: metric.metricId,
        title,
        score: 0,
        isPositive: false,
        isMissing: true,
        state: "missing",
        actualValue: formatActualValue(metric, matchedData.value),
        targetText,
        hint: getMissingHint(template),
        category: metric.category,
      });
      return;
    }

    const weight = metric.weight || 1;
    categoryScores[metric.category].score += scored.score * weight;
    categoryScores[metric.category].weight += weight;
    findings.push({
      id: metric.metricId,
      title,
      score: Math.round(scored.score),
      isPositive: scored.state === "good" && scored.score >= 75,
      state: scored.state,
      actualValue: formatActualValue(metric, matchedData.value),
      targetText,
      hint: getHint(metric, scored.state),
      category: metric.category,
    });
  });

  const availability = {
    posture: categoryScores.posture.weight > 0,
    execution: categoryScores.execution.weight > 0,
    consistency: categoryScores.consistency.weight > 0,
  };
  const breakdown = {
    posture: availability.posture
      ? categoryScores.posture.score / categoryScores.posture.weight
      : 0,
    execution: availability.execution
      ? categoryScores.execution.score / categoryScores.execution.weight
      : 0,
    consistency: availability.consistency
      ? categoryScores.consistency.score / categoryScores.consistency.weight
      : 0,
  };
  const analysisStatus =
    availability.posture && availability.execution ? "ready" : "insufficient_data";
  const availableWeightTotal =
    (availability.posture ? configuredWeights.posture : 0) +
    (availability.execution ? configuredWeights.execution : 0) +
    (availability.consistency ? configuredWeights.consistency : 0);
  const weights: Weights =
    analysisStatus === "ready" && availableWeightTotal > 0
      ? {
          posture: availability.posture ? configuredWeights.posture / availableWeightTotal : 0,
          execution: availability.execution ? configuredWeights.execution / availableWeightTotal : 0,
          consistency: availability.consistency
            ? configuredWeights.consistency / availableWeightTotal
            : 0,
        }
      : { posture: 0, execution: 0, consistency: 0 };
  const overall =
    analysisStatus === "ready"
      ? breakdown.posture * weights.posture +
        breakdown.execution * weights.execution +
        breakdown.consistency * weights.consistency
      : 0;

  return {
    overall,
    grade: getGrade(overall),
    analysisStatus,
    weights,
    availability,
    breakdown,
    findings,
  };
}
