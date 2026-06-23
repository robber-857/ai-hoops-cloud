import { ActionTemplate, Weights, Metric } from "@/config/templates/index";
import globalConfig from "@/config/templates/global.json";

export type Grade = "S" | "A" | "B" | "C" | "D" | "E" | "F";

export interface Finding {
  id: string;
  title: string;
  score: number;
  isPositive: boolean;
  isMissing?: boolean;
  hint: string;
  category: "posture" | "execution" | "consistency";
}

export interface ScoreResult {
  overall: number;
  grade: Grade;
  weights: Weights;
  breakdown: {
    posture: number;
    execution: number;
    consistency: number;
  };
  findings: Finding[];
}

export type AngleData = { name: string; value: number; unit?: string };

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
  return scaleMap[ageGroup] || 1.0;
}

function normalizeMetricKey(key: string): string {
  return key.toLowerCase().replace(/_/g, "").replace(/\s/g, "");
}

function getMetricTitle(metricId: string): string {
  return metricId.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getGrade(score: number): Grade {
  if (score >= 90) return "S";
  if (score >= 85) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

function getMissingHint(template: ActionTemplate, metric: Metric): string {
  return `Data missing: ${metric.computeKey} was not collected for this clip. Use a clearer ${template.camera} view and make sure the movement completes enough reps for this metric.`;
}

export function calculateRealScore(
  template: ActionTemplate,
  currentAngles: AngleData[],
  options: Record<string, unknown> = {}
): ScoreResult {
  const ageGroup = (options.ageGroup as string) || "16-18";
  const multiplier = getAgeToleranceMultiplier(ageGroup);
  const scoreWeights = template.overallWeights || template.categoryWeights || DEFAULT_CATEGORY_WEIGHTS;

  console.groupCollapsed(`Scoring Analysis [Age: ${ageGroup}, Tolerance: ${multiplier}x]`);

  const categoryScores = {
    posture: { score: 0, weight: 0 },
    execution: { score: 0, weight: 0 },
    consistency: { score: 0, weight: 0 },
  };

  const findings: Finding[] = [];
  const relax = (value?: number) => (value ? value * multiplier : value);

  template.metrics.forEach((metric: Metric) => {
    const targetKey = normalizeMetricKey(metric.computeKey);
    const matchedData = currentAngles.find((angle) => normalizeMetricKey(angle.name) === targetKey);
    const weight = metric.weight || 1;
    const title = getMetricTitle(metric.metricId);
    let itemScore = 0;
    let isMissing = false;

    if (!matchedData) {
      isMissing = true;
      console.warn(`Data Missing: ${metric.computeKey}`);
    } else if (metric.type === "boolean") {
      const target = metric.params.target ?? 1;
      itemScore = Math.round(matchedData.value) === target ? 100 : 0;
    } else if (metric.type === "rangeByOption") {
      const optKey = metric.params.optionKey || "handedness";
      const currentOpt =
        (options[optKey] as string) || (template.options?.[optKey] as string) || "right";
      type RangeConfig = { L: number; U: number; margin?: number };
      const rangesMap = metric.params?.ranges as Record<string, RangeConfig> | undefined;
      const config = rangesMap ? rangesMap[currentOpt] : undefined;

      if (!config) {
        isMissing = true;
        console.warn(`Data Missing: range option ${currentOpt} for ${metric.computeKey}`);
      } else {
        const { L, U } = config;
        const margin = relax(config.margin || 0.1)!;
        if (matchedData.value >= L && matchedData.value <= U) {
          itemScore = 100;
        } else if (matchedData.value < L) {
          itemScore = Math.max(0, 100 - ((L - matchedData.value) / margin) * 100);
        } else {
          itemScore = Math.max(0, 100 - ((matchedData.value - U) / margin) * 100);
        }
      }
    } else if (metric.type === "target") {
      const target = metric.params.target || 0;
      const tol = relax(metric.params.tol || 5)!;
      const margin = relax(metric.params.margin || 15)!;
      const diff = Math.abs(matchedData.value - target);

      if (diff <= tol) {
        itemScore = 100 - (diff / tol) * 10;
      } else {
        const extraDiff = diff - tol;
        itemScore = extraDiff > margin ? 0 : 90 - (extraDiff / margin) * 90;
      }
    } else if (metric.type === "range") {
      const L = metric.params.L || 0;
      const U = metric.params.U || 180;
      const margin = relax(metric.params.margin || 15)!;

      if (matchedData.value >= L && matchedData.value <= U) {
        itemScore = 100;
      } else if (matchedData.value < L) {
        itemScore = Math.max(0, 100 - ((L - matchedData.value) / margin) * 100);
      } else {
        itemScore = Math.max(0, 100 - ((matchedData.value - U) / margin) * 100);
      }
    }

    const roundedScore = Math.round(itemScore);
    const isPositive = !isMissing && itemScore >= 75;
    const hint = isMissing
      ? getMissingHint(template, metric)
      : itemScore < 75
        ? metric.hint_bad
        : itemScore < 90
          ? metric.hint_good || "Improve the details of the movements to get a better score."
          : metric.hint_good || "Good form maintained.";

    findings.push({
      id: metric.metricId,
      title,
      score: roundedScore,
      isPositive,
      isMissing,
      hint,
      category: metric.category,
    });

    if (categoryScores[metric.category]) {
      categoryScores[metric.category].score += itemScore * weight;
      categoryScores[metric.category].weight += weight;
    }
  });

  const finalBreakdown = {
    posture: categoryScores.posture.weight
      ? categoryScores.posture.score / categoryScores.posture.weight
      : 0,
    execution: categoryScores.execution.weight
      ? categoryScores.execution.score / categoryScores.execution.weight
      : 0,
    consistency: categoryScores.consistency.weight
      ? categoryScores.consistency.score / categoryScores.consistency.weight
      : 0,
  };

  const weightTotal = scoreWeights.posture + scoreWeights.execution + scoreWeights.consistency || 1;
  const finalOverall =
    (finalBreakdown.posture * scoreWeights.posture +
      finalBreakdown.execution * scoreWeights.execution +
      finalBreakdown.consistency * scoreWeights.consistency) /
    weightTotal;

  console.groupEnd();

  return {
    overall: finalOverall,
    grade: getGrade(finalOverall),
    weights: scoreWeights,
    breakdown: finalBreakdown,
    findings,
  };
}
