import type { ActionTemplate } from "@/config/templates";
import type { CompletedUploadSession } from "@/services/uploads";
import type { FrameSample } from "@/store/analysisStore";
import type { DribbleFrame } from "./dribbleTemporal";
import { calculateRealScore, type AngleData, type ScoreResult } from "./scoring";
import { aggregateTrainingSequence } from "./trainingCalculator";
import { calculateTrainingTemplateContentHash } from "./trainingTemplateCatalog";
import globalConfig from "@/config/templates/global.json";

export const DEFAULT_REPORT_AGE_GROUP = "16-18";
export const MIN_TRAINING_SCORING_METRICS = 2;
export const REPORT_AGE_GROUPS = Object.keys(globalConfig.ageToleranceScale);

/** Reuse measured values and the saved rules; never reaggregate with today's template. */
export function rescoreTrainingReportForAge(
  template: ActionTemplate | null,
  metrics: AngleData[] | null,
  ageGroup: string,
  context: Record<string, unknown> = {},
): ScoreResult | null {
  if (template?.mode !== "training" || !metrics?.length || !REPORT_AGE_GROUPS.includes(ageGroup)) return null;
  return calculateRealScore(template, metrics, { ...context, handedness: context.handedness || "right", ageGroup });
}

export function shouldCaptureTrainingFrame(active: boolean, time: number, latestTime?: number): boolean {
  return active && Number.isFinite(time) && (latestTime === undefined || time > latestTime);
}

type TrainingReportReadiness = {
  ready: boolean;
  reason: string | null;
  metrics: AngleData[];
  score: ScoreResult | null;
  cameraMatch: boolean | null;
};

/** The button and submission handler must evaluate the same captured data. */
export function prepareTrainingReport({
  template,
  frames,
  timeline,
  captureReady,
  temporalReady,
  analyzing,
  ageGroup = DEFAULT_REPORT_AGE_GROUP,
}: {
  template: ActionTemplate | undefined;
  frames: DribbleFrame[];
  timeline: FrameSample[];
  captureReady: boolean;
  temporalReady: boolean;
  analyzing: boolean;
  ageGroup?: string;
}): TrainingReportReadiness {
  const unavailable = (reason: string): TrainingReportReadiness => ({
    ready: false, reason, metrics: [], score: null, cameraMatch: null,
  });
  if (analyzing) return unavailable("Full-video analysis is still running. Please wait until it finishes.");
  if (!template) return unavailable("The uploaded session does not have a matching training template. Upload a new clip after refreshing the page.");
  if (!REPORT_AGE_GROUPS.includes(ageGroup)) return unavailable("Choose a supported age group before generating the report.");
  if (!captureReady || !temporalReady) {
    return unavailable("This clip needs a full timeline of clear pose and motion frames. Retry automatic analysis or recapture from the beginning.");
  }

  const aggregation = aggregateTrainingSequence(frames, template, timeline);
  if (aggregation.analysisStatus !== "ready") {
    return unavailable(aggregation.reason || "The clip needs at least one clear posture check and one clear movement check.");
  }
  const metrics = Object.entries(aggregation.metrics)
    .filter(([, value]) => typeof value === "number" && Number.isFinite(value))
    .map(([name, value]) => ({ name, value: value as number, unit: "calc" }));
  if (metrics.length < MIN_TRAINING_SCORING_METRICS) {
    return unavailable("Not enough scoring metrics were captured. Use a clearer full-body clip.");
  }
  const score = calculateRealScore(template, metrics, { handedness: "right", ageGroup });
  if (score.analysisStatus !== "ready") {
    return unavailable("The clip does not contain enough clear posture and movement data for a fair score.");
  }
  return { ready: true, reason: null, metrics, score, cameraMatch: aggregation.cameraMatch };
}

/** Never attach current-rule scores to an older upload's template identity. */
export async function verifyTrainingReportTemplate(
  template: ActionTemplate,
  session: Pick<CompletedUploadSession, "templateCode" | "templateVersion" | "templateContentHash">,
): Promise<void> {
  if (session.templateCode !== template.templateId || session.templateVersion !== template.version) {
    throw new Error("The training template version changed after this upload. Refresh the page and upload a new clip to use the current rules.");
  }
  if (!session.templateContentHash || session.templateContentHash !== await calculateTrainingTemplateContentHash(template)) {
    throw new Error("The training rules do not match this upload's locked rules. Refresh the page and upload a new clip before generating a report.");
  }
}
