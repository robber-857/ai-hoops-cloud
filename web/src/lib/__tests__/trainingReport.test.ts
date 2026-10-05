import { describe, expect, it } from "vitest";
import { getAllTemplates, getTemplateById } from "@/config/templates";
import { calculateRealScore } from "../scoring";
import {
  DEFAULT_REPORT_AGE_GROUP,
  REPORT_AGE_GROUPS,
  rescoreTrainingReportForAge,
  MIN_TRAINING_SCORING_METRICS,
  prepareTrainingReport,
  shouldCaptureTrainingFrame,
  verifyTrainingReportTemplate,
} from "../trainingReport";
import { calculateTrainingTemplateContentHash } from "../trainingTemplateCatalog";
import { jumpRopeFrames, jumpingJackFrames, lungeFrames, pushupFrames, singleLegFrames } from "./trainingFixtures";

const CASES = [
  { code: "jumping_jack_reps_front", frames: () => jumpingJackFrames(1) },
  { code: "lunge_same_side_reps_side", frames: () => lungeFrames(1) },
  { code: "pushup_reps_side", frames: () => pushupFrames(1) },
  { code: "single_leg_stand_front", frames: () => singleLegFrames() },
  { code: "jump_rope_basic_front", frames: () => jumpRopeFrames(1) },
];

function input(code = "pushup_reps_side", frames = pushupFrames(1)) {
  return {
    template: getTemplateById(code)!, frames, timeline: [],
    captureReady: true, temporalReady: true, analyzing: false,
  };
}

describe("Training report readiness shared by the button and submit handler", () => {
  it("only captures a new manual pass and rejects rewound or duplicate frames", () => {
    expect(shouldCaptureTrainingFrame(false, 9.9, 9.8)).toBe(false);
    expect(shouldCaptureTrainingFrame(false, 10, 9.8)).toBe(false);
    expect(shouldCaptureTrainingFrame(true, 9.7, 9.8)).toBe(false);
    expect(shouldCaptureTrainingFrame(true, 9.8, 9.8)).toBe(false);
    expect(shouldCaptureTrainingFrame(true, 0)).toBe(true);
    expect(shouldCaptureTrainingFrame(true, 0.1, 0)).toBe(true);
  });
  it.each(CASES)("allows a complete $code clip without fabricating missing metrics", ({ code, frames }) => {
    const report = prepareTrainingReport(input(code, frames()));
    expect(report.ready).toBe(true);
    expect(report.metrics.length).toBeGreaterThanOrEqual(MIN_TRAINING_SCORING_METRICS);
    expect(report.score?.findings).toHaveLength(getTemplateById(code)!.metrics.length);
    if (code !== "single_leg_stand_front") {
      expect(report.score?.availability.consistency).toBe(false);
      expect(report.score?.findings.filter((finding) => finding.category === "consistency")
        .every((finding) => finding.isMissing && finding.actualValue === null)).toBe(true);
    }
  });

  it.each([
    { captureReady: false }, { temporalReady: false }, { analyzing: true },
  ])("blocks incomplete timeline or active analysis: %o", (override) => {
    const report = prepareTrainingReport({ ...input(), ...override });
    expect(report.ready).toBe(false);
    expect(report.score).toBeNull();
    expect(report.reason).toBeTruthy();
  });

  it("blocks a half action even when frame count and coverage have passed", () => {
    const report = prepareTrainingReport(input("pushup_reps_side", pushupFrames(1, { finishRest: false })));
    expect(report.ready).toBe(false);
    expect(report.reason).toBeTruthy();
  });

  it("keeps captured inputs available for repeated save attempts", () => {
    const captured = input();
    const originalFrames = structuredClone(captured.frames);
    const first = prepareTrainingReport(captured);
    expect(prepareTrainingReport(captured)).toEqual(first);
    expect(captured.frames).toEqual(originalFrames);
    expect(first.score).toEqual(calculateRealScore(captured.template, first.metrics, {
      handedness: "right", ageGroup: DEFAULT_REPORT_AGE_GROUP,
    }));
  });

  it("keeps camera mismatch advisory while retaining available movement scores", () => {
    const captured = input();
    captured.frames = captured.frames.map((frame) => ({ ...frame, isSideView: false }));
    const report = prepareTrainingReport(captured);
    expect(report.cameraMatch).toBe(false);
    expect(report.ready).toBe(true);
  });
});

describe("Training age selection", () => {
  it.each(REPORT_AGE_GROUPS)("uses selected age %s before first save without changing measurements", (ageGroup) => {
    const captured = input();
    const baseline = prepareTrainingReport(captured);
    const selected = prepareTrainingReport({ ...captured, ageGroup });
    expect(selected.metrics).toEqual(baseline.metrics);
    expect(selected.score).toEqual(calculateRealScore(captured.template, baseline.metrics, { ageGroup, handedness: "right" }));
  });

  it("changes age-sensitive scores and findings while preserving historical rules and missing values", () => {
    const snapshot = structuredClone(getTemplateById("wall_sit_half_hold")!);
    snapshot.version = "historical-test";
    snapshot.metrics[0].params.tol = 4;
    const metrics = [{ name: "trunkLeanDegSide", value: 5, unit: "calc" }];
    const before = structuredClone({ snapshot, metrics });
    const younger = rescoreTrainingReportForAge(snapshot, metrics, "4-7")!;
    const older = rescoreTrainingReportForAge(snapshot, metrics, "16-18")!;
    expect(younger.findings[0].state).toBe("good");
    expect(older.findings[0].state).toBe("high");
    expect(younger.findings[0].score).toBeGreaterThan(older.findings[0].score);
    expect(older.findings.slice(1).every((item) => item.isMissing && item.actualValue === null)).toBe(true);
    expect({ snapshot, metrics }).toEqual(before);
    expect(older).not.toEqual(calculateRealScore(getTemplateById(snapshot.templateId)!, metrics, { ageGroup: "16-18" }));
  });

  it.each(getAllTemplates("training"))("keeps the existing scoring engine for $templateId across every age", (template) => {
    const metrics = template.metrics.map((metric) => ({ name: metric.computeKey, value: (metric.params.target ?? metric.params.L ?? 1) + 3 }));
    for (const ageGroup of REPORT_AGE_GROUPS) {
      expect(rescoreTrainingReportForAge(template, metrics, ageGroup)).toEqual(calculateRealScore(template, metrics, { ageGroup, handedness: "right" }));
    }
  });

  it("refuses missing snapshots, measurements or unsupported ages instead of falling back to current rules", () => {
    const template = getTemplateById("wall_sit_half_hold")!;
    expect(rescoreTrainingReportForAge(null, [{ name: "x", value: 1 }], "4-7")).toBeNull();
    expect(rescoreTrainingReportForAge(template, null, "4-7")).toBeNull();
    expect(rescoreTrainingReportForAge(template, [], "4-7")).toBeNull();
    expect(rescoreTrainingReportForAge(template, [{ name: "x", value: 1 }], "invalid")).toBeNull();
    expect(prepareTrainingReport({ ...input(), ageGroup: "invalid" }).ready).toBe(false);
  });
});

describe("Training report locked template identity", () => {
  const template = getTemplateById("pushup_reps_side")!;
  const session = async () => ({
    templateCode: template.templateId,
    templateVersion: template.version,
    templateContentHash: await calculateTrainingTemplateContentHash(template),
  });

  it("accepts the exact upload template code, version and content", async () => {
    await expect(verifyTrainingReportTemplate(template, await session())).resolves.toBeUndefined();
  });

  it.each([
    { templateCode: "jumping_jack_reps_front" },
    { templateVersion: "v999" },
    { templateContentHash: "different-rules" },
    { templateContentHash: null },
  ])("rejects missing or changed locked rules: %o", async (override) => {
    await expect(verifyTrainingReportTemplate(template, { ...await session(), ...override })).rejects.toThrow(/Refresh/);
  });

  it("rejects altered local rules even when code and version remain the same", async () => {
    const changed = { ...template, metrics: template.metrics.map((metric, index) =>
      index === 0 ? { ...metric, weight: metric.weight + 1 } : metric) };
    await expect(verifyTrainingReportTemplate(changed, await session())).rejects.toThrow(/locked rules/);
  });
});
