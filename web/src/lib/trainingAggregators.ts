import type { DribbleFrame, RawPoint } from "./dribbleTemporal";
import {
  average,
  distance,
  horizontalDeviationDeg,
  isVisiblePoint,
  jointAngleDeg,
  legLength,
  median,
  midpoint,
  percentile,
  pointToLineDistance,
  relativeVariation,
  standardDeviation,
  verticalDeviationDeg,
} from "./trainingGeometry";
import {
  detectHysteresisCycles,
  detectSustainedIntervals,
  smoothTimedSignal,
  type CompleteAction,
} from "./trainingTemporal";

export type TrainingMetricValues = Record<string, number>;

export interface TrainingTemplateAggregation {
  metrics: TrainingMetricValues;
  consistencyAvailable: boolean;
  reason?: string;
}

type Side = "left" | "right";

const SPECIALIZED_TEMPLATE_IDS = new Set([
  "jumping_jack_reps_front",
  "lunge_same_side_reps_side",
  "pushup_reps_side",
  "single_leg_stand_front",
  "jump_rope_basic_front",
]);

function putMetric(metrics: TrainingMetricValues, key: string, value: number | undefined) {
  if (value !== undefined && Number.isFinite(value)) metrics[key] = value;
}

function getSidePoints(frame: DribbleFrame, side: Side) {
  return side === "left"
    ? {
        shoulder: frame.ls,
        elbow: frame.le,
        wrist: frame.lw,
        hip: frame.lh,
        knee: frame.lk,
        ankle: frame.la,
        toe: frame.lf,
      }
    : {
        shoulder: frame.rs,
        elbow: frame.re,
        wrist: frame.rw,
        hip: frame.rh,
        knee: frame.rk,
        ankle: frame.ra,
        toe: frame.rf,
      };
}

function oppositeSide(side: Side): Side {
  return side === "left" ? "right" : "left";
}

function meanVisibility(points: RawPoint[]): number | undefined {
  if (!points.every((point) => isVisiblePoint(point))) return undefined;
  return average(points.map((point) => point.visibility ?? 1));
}

function sideKneeAngle(frame: DribbleFrame, side: Side): number | undefined {
  const { hip, knee, ankle } = getSidePoints(frame, side);
  return jointAngleDeg(hip, knee, ankle);
}

function sideElbowAngle(frame: DribbleFrame, side: Side): number | undefined {
  const { shoulder, elbow, wrist } = getSidePoints(frame, side);
  return jointAngleDeg(shoulder, elbow, wrist);
}

function sideTrunkLean(frame: DribbleFrame, side: Side): number | undefined {
  const { shoulder, hip } = getSidePoints(frame, side);
  return verticalDeviationDeg(shoulder, hip);
}

function frontMidShoulder(frame: DribbleFrame) {
  if (!isVisiblePoint(frame.ls) || !isVisiblePoint(frame.rs)) return undefined;
  return midpoint(frame.ls, frame.rs);
}

function frontMidHip(frame: DribbleFrame) {
  if (!isVisiblePoint(frame.lh) || !isVisiblePoint(frame.rh)) return undefined;
  return midpoint(frame.lh, frame.rh);
}

function frontMidAnkle(frame: DribbleFrame) {
  if (!isVisiblePoint(frame.la) || !isVisiblePoint(frame.ra)) return undefined;
  return midpoint(frame.la, frame.ra);
}

function frontTorsoLean(frame: DribbleFrame): number | undefined {
  const shoulder = frontMidShoulder(frame);
  const hip = frontMidHip(frame);
  return shoulder && hip ? verticalDeviationDeg(shoulder, hip) : undefined;
}

function frontShoulderWidth(frame: DribbleFrame): number | undefined {
  if (!isVisiblePoint(frame.ls) || !isVisiblePoint(frame.rs)) return undefined;
  const value = distance(frame.ls, frame.rs);
  return value > 1e-6 ? value : undefined;
}

function frontTrunkLength(frame: DribbleFrame): number | undefined {
  const shoulder = frontMidShoulder(frame);
  const hip = frontMidHip(frame);
  if (!shoulder || !hip) return undefined;
  const value = distance(shoulder, hip);
  return value > 1e-6 ? value : undefined;
}

function averageLegLength(frame: DribbleFrame): number | undefined {
  return average([
    legLength(frame.lh, frame.lk, frame.la),
    legLength(frame.rh, frame.rk, frame.ra),
  ]);
}

function frontStanceRatio(frame: DribbleFrame): number | undefined {
  const shoulderWidth = frontShoulderWidth(frame);
  if (!shoulderWidth || !isVisiblePoint(frame.la) || !isVisiblePoint(frame.ra)) return undefined;
  return Math.abs(frame.la.x - frame.ra.x) / shoulderWidth;
}

function frontLandingKneeOffset(frame: DribbleFrame): number | undefined {
  const leftLength = legLength(frame.lh, frame.lk, frame.la);
  const rightLength = legLength(frame.rh, frame.rk, frame.ra);
  const leftDistance = pointToLineDistance(frame.lk, frame.lh, frame.la);
  const rightDistance = pointToLineDistance(frame.rk, frame.rh, frame.ra);
  const left = leftLength && leftDistance !== undefined ? leftDistance / leftLength : undefined;
  const right = rightLength && rightDistance !== undefined ? rightDistance / rightLength : undefined;
  const valid = [left, right].filter((value): value is number => value !== undefined);
  return valid.length ? Math.max(...valid) : undefined;
}

function actionFrames(frames: DribbleFrame[], action: CompleteAction) {
  return frames.slice(action.startFrame, action.endFrame + 1);
}

function actionIntervals(actions: CompleteAction[]) {
  return actions.slice(1).map((action, index) => action.peakTime - actions[index].peakTime);
}

function selectMovingSide(
  frames: DribbleFrame[],
  signal: (frame: DribbleFrame, side: Side) => number | undefined,
  requiredPoints: (frame: DribbleFrame, side: Side) => RawPoint[],
): Side {
  const scoreSide = (side: Side) => {
    const values = frames.map((frame) => signal(frame, side)).filter((value): value is number => value !== undefined);
    const visibility = average(frames.map((frame) => meanVisibility(requiredPoints(frame, side)))) ?? 0;
    const range = values.length ? Math.max(...values) - Math.min(...values) : 0;
    return visibility * (1 + range / 180);
  };
  return scoreSide("left") >= scoreSide("right") ? "left" : "right";
}

function aggregateJumpingJack(frames: DribbleFrame[]): TrainingTemplateAggregation {
  const metrics: TrainingMetricValues = {};
  const signal = smoothTimedSignal(
    frames.map((frame) => ({ time: frame.t, value: frontStanceRatio(frame) })),
    0.35,
  );
  const actions = detectHysteresisCycles(signal, {
    activeDirection: "above",
    restThreshold: 0.85,
    activeThreshold: 1.1,
    minCycleSec: 0.25,
  });

  const torsoLeans: number[] = [];
  const landingOffsets: number[] = [];
  const openWidths: number[] = [];
  const armHeights: number[] = [];

  actions.forEach((action) => {
    const peak = frames[action.peakFrame];
    const landing = frames[action.endFrame];
    const torso = median(actionFrames(frames, action).map(frontTorsoLean));
    const width = frontStanceRatio(peak);
    const trunkLength = frontTrunkLength(peak);
    const shoulder = frontMidShoulder(peak);
    let armHeight: number | undefined;
    if (
      trunkLength &&
      shoulder &&
      isVisiblePoint(peak.lw) &&
      isVisiblePoint(peak.rw)
    ) {
      armHeight = Math.min(
        (shoulder.y - peak.lw.y) / trunkLength,
        (shoulder.y - peak.rw.y) / trunkLength,
      );
    }
    if (torso !== undefined) torsoLeans.push(torso);
    const landingOffset = frontLandingKneeOffset(landing);
    if (landingOffset !== undefined) landingOffsets.push(landingOffset);
    if (width !== undefined) openWidths.push(width);
    if (armHeight !== undefined) armHeights.push(armHeight);
  });

  putMetric(metrics, "jumpingJackTorsoLeanDeg", median(torsoLeans));
  putMetric(metrics, "jumpingJackLandingKneeOffsetNorm", median(landingOffsets));
  putMetric(metrics, "jumpingJackOpenStanceRatio", median(openWidths));
  putMetric(metrics, "jumpingJackArmHeightRatio", median(armHeights));
  putMetric(metrics, "jumpingJackOpenWidthVariation", relativeVariation(openWidths));
  putMetric(metrics, "jumpingJackRhythmVariation", relativeVariation(actionIntervals(actions)));

  return {
    metrics,
    consistencyAvailable:
      "jumpingJackOpenWidthVariation" in metrics || "jumpingJackRhythmVariation" in metrics,
    reason: actions.length ? undefined : "No complete closed-open-closed jumping jack was detected.",
  };
}

function lungeKneeOffset(frame: DribbleFrame, side: Side): number | undefined {
  const { knee, ankle, toe } = getSidePoints(frame, side);
  const shankLength = isVisiblePoint(knee) && isVisiblePoint(ankle) ? distance(knee, ankle) : undefined;
  if (!shankLength || !isVisiblePoint(toe)) return undefined;
  const direction = toe.x >= ankle.x ? 1 : -1;
  return ((knee.x - ankle.x) * direction) / shankLength;
}

function aggregateSameSideLunge(frames: DribbleFrame[]): TrainingTemplateAggregation {
  const metrics: TrainingMetricValues = {};
  const workingSide = selectMovingSide(
    frames,
    sideKneeAngle,
    (frame, side) => {
      const { hip, knee, ankle } = getSidePoints(frame, side);
      return [hip, knee, ankle];
    },
  );
  const signal = smoothTimedSignal(
    frames.map((frame) => ({ time: frame.t, value: sideKneeAngle(frame, workingSide) })),
    0.35,
  );
  const actions = detectHysteresisCycles(signal, {
    activeDirection: "below",
    restThreshold: 145,
    activeThreshold: 130,
    minCycleSec: 0.35,
  });

  const trunkLeans: number[] = [];
  const kneeOffsets: number[] = [];
  const frontDepths: number[] = [];
  const rearDepths: number[] = [];

  actions.forEach((action) => {
    const bottom = frames[action.peakFrame];
    const trunk = sideTrunkLean(bottom, workingSide);
    const kneeOffset = lungeKneeOffset(bottom, workingSide);
    const frontDepth = sideKneeAngle(bottom, workingSide);
    const rearDepth = sideKneeAngle(bottom, oppositeSide(workingSide));
    if (trunk !== undefined) trunkLeans.push(trunk);
    if (kneeOffset !== undefined) kneeOffsets.push(kneeOffset);
    if (frontDepth !== undefined) frontDepths.push(frontDepth);
    if (rearDepth !== undefined) rearDepths.push(rearDepth);
  });

  putMetric(metrics, "lungeBottomTrunkLeanDeg", median(trunkLeans));
  putMetric(metrics, "lungeFrontKneeOffsetNorm", median(kneeOffsets));
  putMetric(metrics, "lungeFrontKneeBottomDeg", median(frontDepths));
  putMetric(metrics, "lungeRearKneeBottomDeg", median(rearDepths));
  putMetric(metrics, "lungeBottomKneeStdDeg", standardDeviation(frontDepths));
  putMetric(metrics, "lungeRhythmVariation", relativeVariation(actionIntervals(actions)));

  return {
    metrics,
    consistencyAvailable: "lungeBottomKneeStdDeg" in metrics || "lungeRhythmVariation" in metrics,
    reason: actions.length ? undefined : "No complete top-down-top lunge was detected.",
  };
}

function pushupBodyDeviation(frame: DribbleFrame, side: Side): number | undefined {
  const { shoulder, hip, ankle } = getSidePoints(frame, side);
  if (!isVisiblePoint(shoulder) || !isVisiblePoint(hip) || !isVisiblePoint(ankle)) return undefined;
  const bodyLength = distance(shoulder, ankle);
  const hipDistance = pointToLineDistance(hip, shoulder, ankle);
  return bodyLength > 1e-6 && hipDistance !== undefined ? hipDistance / bodyLength : undefined;
}

function aggregatePushupReps(frames: DribbleFrame[]): TrainingTemplateAggregation {
  const metrics: TrainingMetricValues = {};
  const workingSide = selectMovingSide(
    frames,
    sideElbowAngle,
    (frame, side) => {
      const { shoulder, elbow, wrist, hip, ankle } = getSidePoints(frame, side);
      return [shoulder, elbow, wrist, hip, ankle];
    },
  );
  const signal = smoothTimedSignal(
    frames.map((frame) => ({ time: frame.t, value: sideElbowAngle(frame, workingSide) })),
    0.35,
  );
  const actions = detectHysteresisCycles(signal, {
    activeDirection: "below",
    restThreshold: 145,
    activeThreshold: 130,
    minCycleSec: 0.3,
  });

  const bodyDeviations: number[] = [];
  const bottomDepths: number[] = [];
  const topExtensions: number[] = [];

  actions.forEach((action) => {
    const cycleFrames = actionFrames(frames, action);
    const deviations = cycleFrames.map((frame) => pushupBodyDeviation(frame, workingSide));
    const bodyDeviation = deviations
      .filter((value): value is number => value !== undefined)
      .reduce<number | undefined>((max, value) => (max === undefined || value > max ? value : max), undefined);
    const bottomDepth = sideElbowAngle(frames[action.peakFrame], workingSide);
    const finalStart = Math.floor(cycleFrames.length * 0.7);
    const topExtensionValues = cycleFrames
      .slice(finalStart)
      .map((frame) => sideElbowAngle(frame, workingSide))
      .filter((value): value is number => value !== undefined);
    const topExtension = topExtensionValues.length ? Math.max(...topExtensionValues) : undefined;

    if (bodyDeviation !== undefined) bodyDeviations.push(bodyDeviation);
    if (bottomDepth !== undefined) bottomDepths.push(bottomDepth);
    if (topExtension !== undefined) topExtensions.push(topExtension);
  });

  putMetric(metrics, "pushupHipLineDeviationNorm", median(bodyDeviations));
  putMetric(metrics, "pushupBottomElbowDeg", median(bottomDepths));
  putMetric(metrics, "pushupTopElbowDeg", median(topExtensions));
  putMetric(metrics, "pushupBottomElbowStdDeg", standardDeviation(bottomDepths));
  putMetric(metrics, "pushupHipLineDeviationStd", standardDeviation(bodyDeviations));

  return {
    metrics,
    consistencyAvailable:
      "pushupBottomElbowStdDeg" in metrics || "pushupHipLineDeviationStd" in metrics,
    reason: actions.length ? undefined : "No complete top-bottom-top push-up was detected.",
  };
}

function singleLegHeightDifference(frame: DribbleFrame): number | undefined {
  const scale = averageLegLength(frame);
  if (!scale || !isVisiblePoint(frame.la) || !isVisiblePoint(frame.ra)) return undefined;
  return Math.abs(frame.la.y - frame.ra.y) / scale;
}

function supportKneeOffset(frame: DribbleFrame, side: Side): number | undefined {
  const { hip, knee, ankle } = getSidePoints(frame, side);
  const scale = legLength(hip, knee, ankle);
  const offset = pointToLineDistance(knee, hip, ankle);
  return scale && offset !== undefined ? offset / scale : undefined;
}

function aggregateSingleLegStand(frames: DribbleFrame[]): TrainingTemplateAggregation {
  const metrics: TrainingMetricValues = {};
  const signal = smoothTimedSignal(
    frames.map((frame) => ({ time: frame.t, value: singleLegHeightDifference(frame) })),
    0.4,
  );
  const intervals = detectSustainedIntervals(signal, {
    enterThreshold: 0.05,
    exitThreshold: 0.03,
    minEnterSec: 0.25,
    minExitSec: 0.3,
  });

  const ranked = intervals
    .map((interval) => {
      const segment = frames.slice(interval.startFrame, interval.endFrame + 1);
      const usable = segment.filter(
        (frame) =>
          frontMidShoulder(frame) !== undefined &&
          frontMidHip(frame) !== undefined &&
          singleLegHeightDifference(frame) !== undefined,
      ).length;
      return { interval, segment, usable };
    })
    .filter((candidate) => candidate.usable >= 4)
    .sort((a, b) => b.usable - a.usable || b.segment.length - a.segment.length);

  const selected = ranked[0];
  if (!selected) {
    return {
      metrics,
      consistencyAvailable: false,
      reason: "No continuous single-leg segment had enough visible landmarks.",
    };
  }

  const raisedSignal = median(
    selected.segment.map((frame) =>
      isVisiblePoint(frame.la) && isVisiblePoint(frame.ra) ? frame.ra.y - frame.la.y : undefined,
    ),
  );
  const raisedSide: Side = (raisedSignal ?? 0) >= 0 ? "left" : "right";
  const supportSide = oppositeSide(raisedSide);

  const pelvisTilts = selected.segment.map((frame) =>
    horizontalDeviationDeg(frame.lh, frame.rh),
  );
  const torsoLeans = selected.segment.map(frontTorsoLean);
  const footClearances = selected.segment.map((frame) => {
    const raised = getSidePoints(frame, raisedSide);
    const support = getSidePoints(frame, supportSide);
    const scale = legLength(raised.hip, raised.knee, raised.ankle);
    if (!scale || !isVisiblePoint(raised.ankle) || !isVisiblePoint(support.ankle)) return undefined;
    return (support.ankle.y - raised.ankle.y) / scale;
  });
  const supportOffsets = selected.segment.map((frame) => supportKneeOffset(frame, supportSide));
  const hipXs = selected.segment.map((frame) => frontMidHip(frame)?.x);
  const shoulderWidths = selected.segment.map(frontShoulderWidth);
  const swayScale = median(shoulderWidths);
  const sway = swayScale ? (standardDeviation(hipXs) ?? 0) / swayScale : undefined;

  putMetric(metrics, "singleLegPelvisTiltDeg", median(pelvisTilts));
  putMetric(metrics, "singleLegTorsoLeanDeg", median(torsoLeans));
  putMetric(metrics, "singleLegFootClearanceRatio", median(footClearances));
  putMetric(metrics, "singleLegSupportKneeOffsetNorm", median(supportOffsets));
  putMetric(metrics, "singleLegBodySwayStdNorm", sway);
  putMetric(metrics, "singleLegPelvisTiltStdDeg", standardDeviation(pelvisTilts));

  return {
    metrics,
    consistencyAvailable:
      "singleLegBodySwayStdNorm" in metrics || "singleLegPelvisTiltStdDeg" in metrics,
  };
}

function jumpRopeElbowDistance(frame: DribbleFrame): number | undefined {
  const shoulderWidth = frontShoulderWidth(frame);
  if (
    !shoulderWidth ||
    !isVisiblePoint(frame.le) ||
    !isVisiblePoint(frame.re) ||
    !isVisiblePoint(frame.lh) ||
    !isVisiblePoint(frame.rh)
  ) {
    return undefined;
  }
  return (Math.abs(frame.le.x - frame.lh.x) + Math.abs(frame.re.x - frame.rh.x)) /
    (2 * shoulderWidth);
}

function aggregateBasicJumpRope(frames: DribbleFrame[]): TrainingTemplateAggregation {
  const metrics: TrainingMetricValues = {};
  const midAnkleY = frames.map((frame) => frontMidAnkle(frame)?.y);
  const groundY = percentile(midAnkleY, 0.9);
  const scale = median(frames.map(averageLegLength));
  if (groundY === undefined || !scale) {
    return {
      metrics,
      consistencyAvailable: false,
      reason: "The ground baseline or leg scale could not be estimated.",
    };
  }

  const signal = smoothTimedSignal(
    frames.map((frame) => {
      const ankle = frontMidAnkle(frame);
      return { time: frame.t, value: ankle ? (groundY - ankle.y) / scale : undefined };
    }),
    0.35,
  );
  const actions = detectHysteresisCycles(signal, {
    activeDirection: "above",
    restThreshold: 0.01,
    activeThreshold: 0.02,
    minActiveSec: 0.06,
    minRestSec: 0.06,
    minCycleSec: 0.14,
  });

  const torsoLeans: number[] = [];
  const elbowDistances: number[] = [];
  const footAsymmetries: number[] = [];
  const jumpHeights: number[] = [];

  actions.forEach((action) => {
    const peak = frames[action.peakFrame];
    const torso = median(actionFrames(frames, action).map(frontTorsoLean));
    const elbow = jumpRopeElbowDistance(peak);
    const asymmetry =
      isVisiblePoint(peak.la) && isVisiblePoint(peak.ra)
        ? Math.abs(peak.la.y - peak.ra.y) / scale
        : undefined;
    const jumpHeight = signal[action.peakFrame]?.value;
    if (torso !== undefined) torsoLeans.push(torso);
    if (elbow !== undefined) elbowDistances.push(elbow);
    if (asymmetry !== undefined) footAsymmetries.push(asymmetry);
    if (jumpHeight !== undefined) jumpHeights.push(jumpHeight);
  });

  putMetric(metrics, "jumpRopeTorsoLeanDeg", median(torsoLeans));
  putMetric(metrics, "jumpRopeElbowDistanceNorm", median(elbowDistances));
  putMetric(metrics, "jumpRopeFootAsymmetryNorm", median(footAsymmetries));
  putMetric(metrics, "jumpRopeJumpHeightRatio", median(jumpHeights));
  putMetric(metrics, "jumpRopeJumpHeightVariation", relativeVariation(jumpHeights));
  putMetric(metrics, "jumpRopeRhythmVariation", relativeVariation(actionIntervals(actions)));

  return {
    metrics,
    consistencyAvailable:
      "jumpRopeJumpHeightVariation" in metrics || "jumpRopeRhythmVariation" in metrics,
    reason: actions.length ? undefined : "No complete ground-air-ground jump was detected.",
  };
}

function legacySideStream(frames: DribbleFrame[]) {
  const side = selectMovingSide(
    frames,
    sideKneeAngle,
    (frame, selectedSide) => {
      const { shoulder, elbow, wrist, hip, knee, ankle, toe } = getSidePoints(frame, selectedSide);
      return [shoulder, elbow, wrist, hip, knee, ankle, toe];
    },
  );
  return { side, opposite: oppositeSide(side) };
}

function legacyHipBelowKnee(frame: DribbleFrame, side: Side): number | undefined {
  const { hip, knee } = getSidePoints(frame, side);
  const opposite = getSidePoints(frame, oppositeSide(side));
  if (!isVisiblePoint(hip) || !isVisiblePoint(knee)) return undefined;
  const thigh = distance(hip, knee);
  if (thigh <= 1e-6) return undefined;
  const referenceKneeY = isVisiblePoint(opposite.knee) ? average([knee.y, opposite.knee.y]) ?? knee.y : knee.y;
  return (hip.y - referenceKneeY) / thigh;
}

function legacyKneeToeOffset(frame: DribbleFrame, side: Side): number | undefined {
  const { knee, ankle, toe } = getSidePoints(frame, side);
  if (!isVisiblePoint(knee) || !isVisiblePoint(ankle) || !isVisiblePoint(toe)) return undefined;
  const shank = distance(knee, ankle);
  if (shank <= 1e-6) return undefined;
  const direction = toe.x >= ankle.x ? 1 : -1;
  return ((knee.x - toe.x) * direction) / shank;
}

function legacyKneeLift(frame: DribbleFrame, side: Side): number | undefined {
  const { hip, knee, ankle } = getSidePoints(frame, side);
  if (!isVisiblePoint(hip) || !isVisiblePoint(knee) || !isVisiblePoint(ankle)) return undefined;
  const verticalLeg = Math.abs(ankle.y - hip.y);
  if (verticalLeg <= 1e-6) return undefined;
  return 1 - Math.abs(ankle.y - knee.y) / verticalLeg;
}

export function aggregateLegacyTrainingTemplate(
  frames: DribbleFrame[],
  templateId: string,
): TrainingTemplateAggregation {
  const metrics: TrainingMetricValues = {};
  if (!frames.length) return { metrics, consistencyAvailable: false, reason: "No training frames." };
  const { side } = legacySideStream(frames);

  const kneeAngles = frames.map((frame) => sideKneeAngle(frame, side));
  const trunkLeans = frames.map((frame) => sideTrunkLean(frame, side));
  const bodyAngles = frames.map((frame) => {
    const { shoulder, hip, ankle } = getSidePoints(frame, side);
    return jointAngleDeg(shoulder, hip, ankle);
  });
  const elbowAngles = frames.map((frame) => sideElbowAngle(frame, side));
  const kneeOffsets = frames.map((frame) => legacyKneeToeOffset(frame, side));

  putMetric(metrics, "avgKneeAngleDeg", median(kneeAngles));
  putMetric(metrics, "stdKneeAngleDeg", standardDeviation(kneeAngles));
  putMetric(metrics, "trunkLeanDegSide", median(trunkLeans));
  putMetric(metrics, "torsoLeanDegSide", median(trunkLeans));
  putMetric(metrics, "plankBodyLineDeg", median(bodyAngles));
  putMetric(metrics, "stdPlankBodyLineDeg", standardDeviation(bodyAngles));
  putMetric(metrics, "avgElbowAngleDeg", median(elbowAngles));
  putMetric(metrics, "kneeOverToeOffsetXSide", median(kneeOffsets));

  if (templateId === "deep_squat_reps_side") {
    const signal = smoothTimedSignal(
      frames.map((frame) => ({ time: frame.t, value: sideKneeAngle(frame, side) })),
      0.35,
    );
    const actions = detectHysteresisCycles(signal, {
      activeDirection: "below",
      restThreshold: 145,
      activeThreshold: 140,
      minCycleSec: 0.35,
    });
    const depth = actions.map((action) => legacyHipBelowKnee(frames[action.peakFrame], side));
    const bottomLean = actions.map((action) => sideTrunkLean(frames[action.peakFrame], side));
    const bottomOffset = actions.map((action) => legacyKneeToeOffset(frames[action.peakFrame], side));
    const topAngles = actions.map((action) => {
      const values = frames
        .slice(Math.floor((action.startFrame + action.endFrame) / 2), action.endFrame + 1)
        .map((frame) => sideKneeAngle(frame, side))
        .filter((value): value is number => value !== undefined);
      return values.length ? Math.max(...values) : undefined;
    });
    putMetric(metrics, "hipBelowKneeRatioSide", median(depth));
    putMetric(metrics, "topKneeAngleDeg", median(topAngles));
    putMetric(metrics, "kneeOverToeOffsetXSide", median(bottomOffset));
    putMetric(metrics, "stdHipBelowKneeRatioSidePerRep", standardDeviation(depth));
    putMetric(metrics, "stdTrunkLeanDegSidePerRep", standardDeviation(bottomLean));
    return {
      metrics,
      consistencyAvailable:
        "stdHipBelowKneeRatioSidePerRep" in metrics || "stdTrunkLeanDegSidePerRep" in metrics,
      reason: actions.length ? undefined : "No complete squat was detected.",
    };
  }

  if (templateId === "high_knees_in_place_side") {
    const rawSignal = frames.map((frame) => ({
      time: frame.t,
      value: Math.max(legacyKneeLift(frame, "left") ?? -Infinity, legacyKneeLift(frame, "right") ?? -Infinity),
    }));
    const signal = smoothTimedSignal(
      rawSignal.map((sample) => ({
        time: sample.time,
        value: Number.isFinite(sample.value) ? sample.value : undefined,
      })),
      0.35,
    );
    const actions = detectHysteresisCycles(signal, {
      activeDirection: "above",
      restThreshold: 0.35,
      activeThreshold: 0.5,
      minCycleSec: 0.15,
    });
    const heights = actions.map((action) => signal[action.peakFrame].value);
    const landingOffsets = actions.map((action) => {
      const peak = frames[action.peakFrame];
      const raisedSide = (legacyKneeLift(peak, "left") ?? -Infinity) >= (legacyKneeLift(peak, "right") ?? -Infinity)
        ? "left"
        : "right";
      const landing = getSidePoints(frames[action.endFrame], raisedSide);
      if (!isVisiblePoint(landing.ankle) || !isVisiblePoint(landing.hip) || !isVisiblePoint(landing.knee)) {
        return undefined;
      }
      const scale = distance(landing.knee, landing.ankle);
      return scale > 1e-6 ? (landing.ankle.x - landing.hip.x) / scale : undefined;
    });
    putMetric(metrics, "kneeToHipHeightRatioSide", median(heights));
    putMetric(metrics, "footStrikeOffsetXUnderHip", median(landingOffsets));
    putMetric(metrics, "stdKneeToHipHeightRatioSide", standardDeviation(heights));
    putMetric(metrics, "stepIntervalCV", relativeVariation(actionIntervals(actions)));
    return {
      metrics,
      consistencyAvailable:
        "stdKneeToHipHeightRatioSide" in metrics || "stepIntervalCV" in metrics,
      reason: actions.length ? undefined : "No clear knee-lift cycle was detected.",
    };
  }

  const consistencyKeys = ["stdKneeAngleDeg", "stdPlankBodyLineDeg"];
  return {
    metrics,
    consistencyAvailable: consistencyKeys.some((key) => key in metrics),
  };
}

export function aggregateSpecializedTrainingTemplate(
  frames: DribbleFrame[],
  templateId: string,
): TrainingTemplateAggregation | null {
  if (!SPECIALIZED_TEMPLATE_IDS.has(templateId)) return null;
  if (!frames.length) {
    return { metrics: {}, consistencyAvailable: false, reason: "No training frames." };
  }

  switch (templateId) {
    case "jumping_jack_reps_front":
      return aggregateJumpingJack(frames);
    case "lunge_same_side_reps_side":
      return aggregateSameSideLunge(frames);
    case "pushup_reps_side":
      return aggregatePushupReps(frames);
    case "single_leg_stand_front":
      return aggregateSingleLegStand(frames);
    case "jump_rope_basic_front":
      return aggregateBasicJumpRope(frames);
    default:
      return null;
  }
}
