import { describe, expect, it } from "vitest";

import { getTemplateById } from "@/config/templates";

import { calculateRealScore } from "../scoring";
import {
  aggregateLegacyTrainingTemplate,
  aggregateSpecializedTrainingTemplate,
} from "../trainingAggregators";
import { aggregateTrainingSequence } from "../trainingCalculator";
import {
  highKneeFrames,
  jumpRopeFrames,
  jumpingJackFrames,
  lungeFrames,
  pushupFrames,
  singleLegFrames,
} from "./trainingFixtures";

const NEW_REPEATED_TEMPLATES = [
  {
    id: "jumping_jack_reps_front",
    frames: jumpingJackFrames,
    postureExecution: [
      "jumpingJackTorsoLeanDeg",
      "jumpingJackLandingKneeOffsetNorm",
      "jumpingJackOpenStanceRatio",
      "jumpingJackArmHeightRatio",
    ],
  },
  {
    id: "lunge_same_side_reps_side",
    frames: lungeFrames,
    postureExecution: [
      "lungeBottomTrunkLeanDeg",
      "lungeFrontKneeOffsetNorm",
      "lungeFrontKneeBottomDeg",
      "lungeRearKneeBottomDeg",
    ],
  },
  {
    id: "pushup_reps_side",
    frames: pushupFrames,
    postureExecution: [
      "pushupHipLineDeviationNorm",
      "pushupBottomElbowDeg",
      "pushupTopElbowDeg",
    ],
  },
  {
    id: "jump_rope_basic_front",
    frames: jumpRopeFrames,
    postureExecution: [
      "jumpRopeTorsoLeanDeg",
      "jumpRopeElbowDistanceNorm",
      "jumpRopeFootAsymmetryNorm",
      "jumpRopeJumpHeightRatio",
    ],
  },
] as const;

describe("new repeated-action training aggregators", () => {
  it.each(NEW_REPEATED_TEMPLATES)(
    "$id scores posture and execution from one complete action",
    ({ id, frames, postureExecution }) => {
      const result = aggregateSpecializedTrainingTemplate(frames(1), id);

      expect(result).not.toBeNull();
      postureExecution.forEach((key) => expect(result?.metrics[key]).toBeTypeOf("number"));
      expect(result?.consistencyAvailable).toBe(false);
    },
  );

  it.each(NEW_REPEATED_TEMPLATES)(
    "$id enables consistency only after multiple complete actions",
    ({ id, frames }) => {
      const result = aggregateSpecializedTrainingTemplate(frames(3), id);

      expect(result?.consistencyAvailable).toBe(true);
    },
  );

  it.each(NEW_REPEATED_TEMPLATES)(
    "$id ignores a final half action",
    ({ id, frames }) => {
      const complete = aggregateSpecializedTrainingTemplate(frames(1), id);
      const withHalfEnding = aggregateSpecializedTrainingTemplate(
        [...frames(1), ...frames(1, { finishRest: false })],
        id,
      );

      expect(withHalfEnding?.metrics).toEqual(complete?.metrics);
    },
  );

  it("does not count an opening fragment when a clip starts mid-action", () => {
    const result = aggregateSpecializedTrainingTemplate(
      jumpingJackFrames(1, { prefixActive: true }),
      "jumping_jack_reps_front",
    );

    expect(result?.metrics.jumpingJackOpenStanceRatio).toBeCloseTo(2.4, 1);
    expect(result?.consistencyAvailable).toBe(false);
  });

  it("does not reward a longer clip when movement quality is unchanged", () => {
    const template = getTemplateById("jumping_jack_reps_front");
    expect(template).toBeDefined();
    if (!template) return;

    const score = (cycles: number) => {
      const aggregation = aggregateSpecializedTrainingTemplate(
        jumpingJackFrames(cycles),
        template.templateId,
      );
      const metrics = Object.entries(aggregation?.metrics ?? {}).map(([name, value]) => ({
        name,
        value,
      }));
      return calculateRealScore(template, metrics).overall;
    };

    expect(score(3)).toBeCloseTo(score(1), 6);
  });
});

describe("single-leg stand aggregation", () => {
  it("scores movement quality without using segment duration", () => {
    const shortResult = aggregateSpecializedTrainingTemplate(
      singleLegFrames(8),
      "single_leg_stand_front",
    );
    const longResult = aggregateSpecializedTrainingTemplate(
      singleLegFrames(30),
      "single_leg_stand_front",
    );

    expect(shortResult?.metrics).toEqual(longResult?.metrics);
    expect(shortResult?.consistencyAvailable).toBe(true);
  });
});

describe("training aggregation readiness", () => {
  it("allows missing individual metrics when posture and execution each have data", () => {
    const template = getTemplateById("jumping_jack_reps_front");
    expect(template).toBeDefined();
    if (!template) return;
    const frames = jumpingJackFrames(1).map((frame) => ({
      ...frame,
      lw: { ...frame.lw, visibility: 0.1 },
      rw: { ...frame.rw, visibility: 0.1 },
    }));

    const result = aggregateTrainingSequence(frames, template);

    expect(result.metrics.jumpingJackArmHeightRatio).toBeUndefined();
    expect(result.analysisStatus).toBe("ready");
    expect(result.missingRequiredKeys).toContain("jumpingJackArmHeightRatio");
  });

  it("reports a camera mismatch without changing metric values", () => {
    const template = getTemplateById("jumping_jack_reps_front");
    expect(template).toBeDefined();
    if (!template) return;
    const frames = jumpingJackFrames(1).map((frame) => ({ ...frame, isSideView: true }));

    const result = aggregateTrainingSequence(frames, template);

    expect(result.analysisStatus).toBe("ready");
    expect(result.cameraMatch).toBe(false);
  });
});

describe("existing training template regression", () => {
  const cases = [
    { id: "deep_squat_reps_side", frames: lungeFrames(2) },
    { id: "high_knees_in_place_side", frames: highKneeFrames(3) },
    { id: "pushup_hold_high_plank", frames: pushupFrames(1) },
    { id: "wall_sit_half_hold", frames: lungeFrames(1) },
    { id: "wall_sit_quarter_hold", frames: lungeFrames(1) },
  ];

  it.each(cases)("keeps required metrics available for $id", ({ id, frames }) => {
    const template = getTemplateById(id);
    expect(template).toBeDefined();
    if (!template) return;

    const result = aggregateLegacyTrainingTemplate(frames, id);
    const required = template.metrics.map((metric) => metric.computeKey);

    required.forEach((key) => expect(result.metrics[key]).toBeTypeOf("number"));
  });
});
