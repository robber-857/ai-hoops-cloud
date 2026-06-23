import type { NormalizedLandmark, NormalizedLandmarkList } from "@mediapipe/pose";

import type { AnalysisType, AngleData } from "./types";
import {
  calculateAngles,
  calculateCrouchAngle,
  calculateElbowToTorso,
  calculateForearmVertical,
  calculateStanceToShoulderRatio,
  calculateTrunkLean,
  calculateWristMidlineNorm,
  calculateWristHeightRatio,
  checkKneeOverToe,
} from "@/lib/angles2d";

export const FACE_IDX = new Set<number>([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

function calcLocalAngle(
  a: NormalizedLandmark,
  b: NormalizedLandmark,
  c: NormalizedLandmark
) {
  if (
    !a ||
    !b ||
    !c ||
    (a.visibility ?? 0) < 0.5 ||
    (b.visibility ?? 0) < 0.5 ||
    (c.visibility ?? 0) < 0.5
  ) {
    return 0;
  }

  const rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let deg = Math.abs((rad * 180.0) / Math.PI);
  if (deg > 180.0) deg = 360 - deg;
  return deg;
}

function isPointVisible(point: NormalizedLandmark | undefined): point is NormalizedLandmark {
  return Boolean(point && (point.visibility ?? 1) >= 0.5);
}

function isHandInChestBox(
  hand: NormalizedLandmark | undefined,
  leftShoulder: NormalizedLandmark | undefined,
  rightShoulder: NormalizedLandmark | undefined,
  leftHip: NormalizedLandmark | undefined,
  rightHip: NormalizedLandmark | undefined
): number | null {
  if (
    !isPointVisible(hand) ||
    !isPointVisible(leftShoulder) ||
    !isPointVisible(rightShoulder) ||
    !isPointVisible(leftHip) ||
    !isPointVisible(rightHip)
  ) {
    return null;
  }

  const minX = Math.min(leftShoulder.x, rightShoulder.x) - 0.1;
  const maxX = Math.max(leftShoulder.x, rightShoulder.x) + 0.1;
  const minY = Math.min(leftShoulder.y, rightShoulder.y);
  const maxY = Math.max(leftHip.y, rightHip.y) + 0.1;

  return hand.x >= minX && hand.x <= maxX && hand.y >= minY && hand.y <= maxY ? 1 : 0;
}

function calcVerticalDeviationDeg(
  start: NormalizedLandmark | undefined,
  end: NormalizedLandmark | undefined
): number | null {
  if (!isPointVisible(start) || !isPointVisible(end)) return null;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return null;

  const degrees = Math.abs((Math.atan2(dx, dy) * 180) / Math.PI);
  return Math.min(90, degrees);
}

function calcWristMidlineOffsetNorm(
  landmarks: NormalizedLandmarkList,
  isLeft: boolean
): number | null {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const wrist = landmarks[isLeft ? 15 : 16];

  if (!isPointVisible(leftShoulder) || !isPointVisible(rightShoulder) || !isPointVisible(wrist)) {
    return null;
  }

  const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
  if (shoulderWidth <= 1e-6) return null;

  const midlineX = (leftShoulder.x + rightShoulder.x) / 2;
  return (wrist.x - midlineX) / shoulderWidth;
}

function calcOverreachControlFront(
  landmarks: NormalizedLandmarkList,
  isLeft: boolean
): number | null {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const shoulder = landmarks[isLeft ? 11 : 12];
  const wrist = landmarks[isLeft ? 15 : 16];

  if (
    !isPointVisible(leftShoulder) ||
    !isPointVisible(rightShoulder) ||
    !isPointVisible(shoulder) ||
    !isPointVisible(wrist)
  ) {
    return null;
  }

  const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
  if (shoulderWidth <= 1e-6) return null;

  return Math.abs(wrist.x - shoulder.x) / shoulderWidth;
}

function getFacingDir(
  landmarks: NormalizedLandmarkList,
  isLeft: boolean
): number | null {
  const ankle = landmarks[isLeft ? 27 : 28];
  const toe = landmarks[isLeft ? 31 : 32];

  if (!isPointVisible(ankle) || !isPointVisible(toe)) return null;
  return toe.x > ankle.x ? 1 : -1;
}

function getTrunkHeight(
  shoulder: NormalizedLandmark | undefined,
  hip: NormalizedLandmark | undefined
): number | null {
  if (!isPointVisible(shoulder) || !isPointVisible(hip)) return null;

  const trunkHeight = Math.abs(hip.y - shoulder.y);
  return trunkHeight <= 1e-6 ? null : trunkHeight;
}

function calcReceiveZoneQuarterNorm(
  landmarks: NormalizedLandmarkList,
  isLeft: boolean
): number | null {
  const leftFoot = landmarks[31];
  const rightFoot = landmarks[32];
  const wrist = landmarks[isLeft ? 15 : 16];

  if (!isPointVisible(leftFoot) || !isPointVisible(rightFoot) || !isPointVisible(wrist)) {
    return null;
  }

  const leftFootX = Math.min(leftFoot.x, rightFoot.x);
  const rightFootX = Math.max(leftFoot.x, rightFoot.x);
  const stanceWidth = rightFootX - leftFootX;
  if (stanceWidth <= 1e-6) return null;

  return (wrist.x - leftFootX) / stanceWidth;
}

function calcWristAlignOppFootAtPeak(
  landmarks: NormalizedLandmarkList,
  isLeft: boolean
): number | null {
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftFoot = landmarks[31];
  const rightFoot = landmarks[32];
  const wrist = landmarks[isLeft ? 15 : 16];

  if (
    !isPointVisible(leftShoulder) ||
    !isPointVisible(rightShoulder) ||
    !isPointVisible(leftFoot) ||
    !isPointVisible(rightFoot) ||
    !isPointVisible(wrist)
  ) {
    return null;
  }

  const leftFootX = Math.min(leftFoot.x, rightFoot.x);
  const rightFootX = Math.max(leftFoot.x, rightFoot.x);
  const stanceWidth = rightFootX - leftFootX;
  if (stanceWidth <= 1e-6) return null;

  const midlineX = (leftShoulder.x + rightShoulder.x) / 2;
  const oppositeFootX = isLeft ? rightFootX : leftFootX;
  const oppositeSideSign = isLeft ? 1 : -1;
  const crossedMidline = (wrist.x - midlineX) * oppositeSideSign > 0;

  return crossedMidline ? Math.abs(wrist.x - oppositeFootX) / stanceWidth : 0.5;
}

function calcSideSignedOffset(
  landmarks: NormalizedLandmarkList,
  isLeft: boolean,
  pointIndex: number,
  anchorIndex: number
): number | null {
  const shoulder = landmarks[isLeft ? 11 : 12];
  const hip = landmarks[isLeft ? 23 : 24];
  const point = landmarks[pointIndex];
  const anchor = landmarks[anchorIndex];
  const dir = getFacingDir(landmarks, isLeft);
  const trunkHeight = getTrunkHeight(shoulder, hip);

  if (
    dir === null ||
    trunkHeight === null ||
    !isPointVisible(point) ||
    !isPointVisible(anchor)
  ) {
    return null;
  }

  return ((point.x - anchor.x) * dir) / trunkHeight;
}

function calcSideJointAngle(
  landmarks: NormalizedLandmarkList,
  isLeft: boolean,
  angleType: "elbow" | "shoulderArm"
): number | null {
  const shoulder = landmarks[isLeft ? 11 : 12];
  const elbow = landmarks[isLeft ? 13 : 14];
  const wrist = landmarks[isLeft ? 15 : 16];
  const hip = landmarks[isLeft ? 23 : 24];

  if (!isPointVisible(shoulder) || !isPointVisible(elbow)) return null;

  if (angleType === "elbow") {
    if (!isPointVisible(wrist)) return null;
    return calcLocalAngle(shoulder, elbow, wrist);
  }

  if (!isPointVisible(hip)) return null;
  return calcLocalAngle(hip, shoulder, elbow);
}

function distance2d(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

function calcTrainingAngle(
  a: NormalizedLandmark,
  b: NormalizedLandmark,
  c: NormalizedLandmark
): number {
  const rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let deg = Math.abs((rad * 180) / Math.PI);
  if (deg > 180) deg = 360 - deg;
  return deg;
}

function calcTrainingVerticalAngle(top: NormalizedLandmark, bottom: NormalizedLandmark): number {
  const dx = top.x - bottom.x;
  const dy = top.y - bottom.y;
  return (Math.atan2(Math.abs(dx), Math.abs(dy)) * 180) / Math.PI;
}

function getTrainingMetricPoints(landmarks: NormalizedLandmarkList) {
  const isLeftVisible = (landmarks[25]?.visibility ?? 0) > (landmarks[26]?.visibility ?? 0);
  const selectSidePoint = (leftIndex: number, rightIndex: number) =>
    isLeftVisible
      ? landmarks[leftIndex] ?? landmarks[rightIndex]
      : landmarks[rightIndex] ?? landmarks[leftIndex];

  const shoulder = selectSidePoint(11, 12);
  const elbow = selectSidePoint(13, 14);
  const wrist = selectSidePoint(15, 16);
  const hip = selectSidePoint(23, 24);
  const knee = selectSidePoint(25, 26);
  const ankle = selectSidePoint(27, 28);
  const toe = selectSidePoint(31, 32);

  if (!shoulder || !elbow || !wrist || !hip || !knee || !ankle || !toe) return null;

  return { shoulder, elbow, wrist, hip, knee, ankle, toe };
}

function pushTrainingMetric(
  angleData: AngleData[],
  name: string,
  value: number | null,
  unit: AngleData["unit"],
  decimals = 3
) {
  if (value === null || !Number.isFinite(value)) return;

  angleData.push({
    name,
    value: parseFloat(value.toFixed(decimals)),
    unit,
  });
}

export function extractPoseAngles(
  landmarks: NormalizedLandmarkList,
  analysisType: AnalysisType
): AngleData[] {
  const angleData: AngleData[] = [];

  if (analysisType === "shooting") {
    const isLeft = false;

    const elbowTuck = calculateElbowToTorso(landmarks, isLeft);
    angleData.push({
      name: "elbowToTorsoDistanceNorm",
      value: parseFloat(elbowTuck.toFixed(2)),
      unit: "ratio",
    });

    const wristOffset = calculateWristMidlineNorm(landmarks, isLeft);
    angleData.push({
      name: "wristMidlineOffsetNorm",
      value: parseFloat(wristOffset.toFixed(2)),
      unit: "ratio",
    });

    const trunkLean = calculateTrunkLean(landmarks);
    angleData.push({
      name: "trunkLeanDegSide",
      value: Math.round(trunkLean),
      unit: "deg",
    });

    const forearmVert = calculateForearmVertical(landmarks, isLeft);
    angleData.push({
      name: "forearmVerticalDeg",
      value: Math.round(forearmVert),
      unit: "deg",
    });

    angleData.push({
      name: "kneeOverToeSide",
      value: checkKneeOverToe(landmarks),
      unit: "bool",
    });

    const kneeAngle = calculateCrouchAngle(landmarks);
    if (kneeAngle !== null) {
      angleData.push({
        name: "minKneeAngleDuringLoad",
        value: Math.round(kneeAngle),
        unit: "deg",
      });
    }

    const baseAngles = calculateAngles(landmarks);
    if (baseAngles) {
      angleData.push({ name: "Elbow Angle", value: baseAngles.elbow, unit: "deg" });
      angleData.push({ name: "Shoulder Angle", value: baseAngles.shoulder, unit: "deg" });
    }

    return angleData;
  }

  const crouchAngle = calculateCrouchAngle(landmarks);
  const stanceRatio = calculateStanceToShoulderRatio(landmarks);
  const trunkLean = calculateTrunkLean(landmarks);

  angleData.push({ name: "trunkLeanDegSide", value: trunkLean, unit: "deg" });

  if (crouchAngle !== null) {
    angleData.push({
      name: "kneeAngleDeg",
      value: crouchAngle,
      unit: "deg",
    });
  }

  if (stanceRatio !== null) {
    angleData.push({
      name: "shoulderStanceRatio",
      value: parseFloat(stanceRatio.toFixed(2)),
      unit: "ratio",
    });
  }

  if (analysisType === "training") {
    const points = getTrainingMetricPoints(landmarks);

    if (points) {
      const { shoulder, elbow, wrist, hip, knee, ankle, toe } = points;
      const direction = toe.x > ankle.x ? 1 : -1;
      const shankLength = distance2d(knee, ankle) || 1;
      const thighLength = distance2d(hip, knee) || 1;
      const torsoLength = distance2d(shoulder, hip) || 1;
      const legHeight = Math.abs(ankle.y - hip.y) || 1;

      const kneeAngle = calcTrainingAngle(hip, knee, ankle);
      const plankLine = calcTrainingAngle(shoulder, hip, ankle);
      const elbowAngle = calcTrainingAngle(shoulder, elbow, wrist);
      const torsoLean = calcTrainingVerticalAngle(shoulder, hip);
      const kneeOverToeOffset = ((knee.x - toe.x) * direction) / shankLength;
      const hipBelowKneeRatio = (hip.y - knee.y) / thighLength;
      const shoulderWristOffset = (shoulder.x - wrist.x) / torsoLength;
      const footStrikeOffset = ((ankle.x - hip.x) * direction) / shankLength;
      const kneeToHipHeightRatio = 1 - Math.abs(ankle.y - knee.y) / legHeight;

      pushTrainingMetric(angleData, "avgKneeAngleDeg", kneeAngle, "deg", 1);
      pushTrainingMetric(angleData, "topKneeAngleDeg", kneeAngle, "deg", 1);
      pushTrainingMetric(angleData, "plankBodyLineDeg", plankLine, "deg", 1);
      pushTrainingMetric(angleData, "avgElbowAngleDeg", elbowAngle, "deg", 1);
      pushTrainingMetric(angleData, "torsoLeanDegSide", torsoLean, "deg", 1);
      pushTrainingMetric(angleData, "shoulderOverWristOffsetX", shoulderWristOffset, "ratio");
      pushTrainingMetric(angleData, "kneeOverToeOffsetXSide", kneeOverToeOffset, "ratio");
      pushTrainingMetric(angleData, "hipBelowKneeRatioSide", hipBelowKneeRatio, "ratio");
      pushTrainingMetric(angleData, "footStrikeOffsetXUnderHip", footStrikeOffset, "ratio");
      pushTrainingMetric(angleData, "kneeToHipHeightRatioSide", kneeToHipHeightRatio, "ratio");
    }
  }

  if (analysisType === "dribbling") {
    const leftHeight = calculateWristHeightRatio(landmarks, true);
    const rightHeight = calculateWristHeightRatio(landmarks, false);
    const leftToeAngle = calcVerticalDeviationDeg(landmarks[27], landmarks[31]);
    const rightToeAngle = calcVerticalDeviationDeg(landmarks[28], landmarks[32]);
    const leftMidlineOffset = calcWristMidlineOffsetNorm(landmarks, true);
    const rightMidlineOffset = calcWristMidlineOffsetNorm(landmarks, false);
    const leftOverreach = calcOverreachControlFront(landmarks, true);
    const rightOverreach = calcOverreachControlFront(landmarks, false);
    const leftReceiveZone = calcReceiveZoneQuarterNorm(landmarks, true);
    const rightReceiveZone = calcReceiveZoneQuarterNorm(landmarks, false);
    const leftOppFootAlign = calcWristAlignOppFootAtPeak(landmarks, true);
    const rightOppFootAlign = calcWristAlignOppFootAtPeak(landmarks, false);
    const leftKneeOverToe = calcSideSignedOffset(landmarks, true, 25, 31);
    const rightKneeOverToe = calcSideSignedOffset(landmarks, false, 26, 32);
    const leftHipForward = calcSideSignedOffset(landmarks, true, 23, 27);
    const rightHipForward = calcSideSignedOffset(landmarks, false, 24, 28);
    const leftHandForward = calcSideSignedOffset(landmarks, true, 15, 11);
    const rightHandForward = calcSideSignedOffset(landmarks, false, 16, 12);
    const leftWristToToeForward = calcSideSignedOffset(landmarks, true, 15, 31);
    const rightWristToToeForward = calcSideSignedOffset(landmarks, false, 16, 32);
    const leftElbowAngle = calcSideJointAngle(landmarks, true, "elbow");
    const rightElbowAngle = calcSideJointAngle(landmarks, false, "elbow");
    const leftShoulderArmAngle = calcSideJointAngle(landmarks, true, "shoulderArm");
    const rightShoulderArmAngle = calcSideJointAngle(landmarks, false, "shoulderArm");
    const leftGuide = isHandInChestBox(
      landmarks[15],
      landmarks[11],
      landmarks[12],
      landmarks[23],
      landmarks[24]
    );
    const rightGuide = isHandInChestBox(
      landmarks[16],
      landmarks[11],
      landmarks[12],
      landmarks[23],
      landmarks[24]
    );

    angleData.push({
      name: "leftWristHeightRatioToShoulder",
      value: parseFloat(leftHeight.toFixed(3)),
      unit: "ratio",
    });
    angleData.push({
      name: "leftWristHeightRatioToHip",
      value: parseFloat(leftHeight.toFixed(3)),
      unit: "ratio",
    });
    angleData.push({
      name: "rightWristHeightRatioToShoulder",
      value: parseFloat(rightHeight.toFixed(3)),
      unit: "ratio",
    });
    angleData.push({
      name: "rightWristHeightRatioToHip",
      value: parseFloat(rightHeight.toFixed(3)),
      unit: "ratio",
    });
    angleData.push({
      name: "wristHeightRatioToShoulder",
      value: parseFloat(rightHeight.toFixed(3)),
      unit: "ratio",
    });
    angleData.push({
      name: "wristHeightRatioToHip",
      value: parseFloat(rightHeight.toFixed(3)),
      unit: "ratio",
    });

    if (leftGuide !== null) {
      angleData.push({
        name: "leftGuideHandInChestBoxRate",
        value: leftGuide,
        unit: "state",
      });
    }

    if (rightGuide !== null) {
      angleData.push({
        name: "rightGuideHandInChestBoxRate",
        value: rightGuide,
        unit: "state",
      });
    }

    if (leftToeAngle !== null) {
      angleData.push({
        name: "toeAngleDegLeft",
        value: parseFloat(leftToeAngle.toFixed(2)),
        unit: "deg",
      });
    }

    if (rightToeAngle !== null) {
      angleData.push({
        name: "toeAngleDegRight",
        value: parseFloat(rightToeAngle.toFixed(2)),
        unit: "deg",
      });
    }

    if (leftMidlineOffset !== null) {
      angleData.push({
        name: "leftWristMidlineOffsetNorm",
        value: parseFloat(leftMidlineOffset.toFixed(3)),
        unit: "ratio",
      });
      angleData.push({
        name: "leftCrossMidlineState",
        value: leftMidlineOffset >= 0 ? 1 : 0,
        unit: "state",
      });
    }

    if (rightMidlineOffset !== null) {
      angleData.push({
        name: "rightWristMidlineOffsetNorm",
        value: parseFloat(rightMidlineOffset.toFixed(3)),
        unit: "ratio",
      });
      angleData.push({
        name: "rightCrossMidlineState",
        value: rightMidlineOffset <= 0 ? 1 : 0,
        unit: "state",
      });
      angleData.push({
        name: "wristMidlineOffsetNorm",
        value: parseFloat(rightMidlineOffset.toFixed(3)),
        unit: "ratio",
      });
    }

    if (leftOverreach !== null) {
      angleData.push({
        name: "leftOverreachControlFront",
        value: parseFloat(leftOverreach.toFixed(3)),
        unit: "ratio",
      });
      angleData.push({
        name: "leftWristXAtContactNormByST",
        value: parseFloat((leftMidlineOffset ?? leftOverreach).toFixed(3)),
        unit: "ratio",
      });
    }

    if (rightOverreach !== null) {
      angleData.push({
        name: "rightOverreachControlFront",
        value: parseFloat(rightOverreach.toFixed(3)),
        unit: "ratio",
      });
      angleData.push({
        name: "overreachControlFront",
        value: parseFloat(rightOverreach.toFixed(3)),
        unit: "ratio",
      });
      angleData.push({
        name: "rightWristXAtContactNormByST",
        value: parseFloat((rightMidlineOffset ?? rightOverreach).toFixed(3)),
        unit: "ratio",
      });
      angleData.push({
        name: "wristXAtContactNormByST",
        value: parseFloat((rightMidlineOffset ?? rightOverreach).toFixed(3)),
        unit: "ratio",
      });
    }

    if (leftReceiveZone !== null) {
      angleData.push({
        name: "leftReceiveZoneQuarterNorm",
        value: parseFloat(leftReceiveZone.toFixed(3)),
        unit: "ratio",
      });
    }

    if (rightReceiveZone !== null) {
      angleData.push({
        name: "rightReceiveZoneQuarterNorm",
        value: parseFloat(rightReceiveZone.toFixed(3)),
        unit: "ratio",
      });
      angleData.push({
        name: "receiveZoneQuarterNorm",
        value: parseFloat(rightReceiveZone.toFixed(3)),
        unit: "ratio",
      });
    }

    if (leftOppFootAlign !== null) {
      angleData.push({
        name: "leftWristAlignOppFootAtPeak",
        value: parseFloat(leftOppFootAlign.toFixed(3)),
        unit: "ratio",
      });
    }

    if (rightOppFootAlign !== null) {
      angleData.push({
        name: "rightWristAlignOppFootAtPeak",
        value: parseFloat(rightOppFootAlign.toFixed(3)),
        unit: "ratio",
      });
      angleData.push({
        name: "wristAlignOppFootAtPeak",
        value: parseFloat(rightOppFootAlign.toFixed(3)),
        unit: "ratio",
      });
    }

    if (leftKneeOverToe !== null) {
      angleData.push({
        name: "leftKneeOverToeSide",
        value: parseFloat(leftKneeOverToe.toFixed(3)),
        unit: "ratio",
      });
    }

    if (rightKneeOverToe !== null) {
      angleData.push({
        name: "rightKneeOverToeSide",
        value: parseFloat(rightKneeOverToe.toFixed(3)),
        unit: "ratio",
      });
      angleData.push({
        name: "kneeOverToeSide",
        value: parseFloat(rightKneeOverToe.toFixed(3)),
        unit: "ratio",
      });
    }

    if (leftHipForward !== null) {
      angleData.push({
        name: "leftHipForwardRatioSide",
        value: parseFloat(leftHipForward.toFixed(3)),
        unit: "ratio",
      });
      angleData.push({
        name: "leftHipForwardRatioSideab",
        value: parseFloat(Math.abs(leftHipForward).toFixed(3)),
        unit: "ratio",
      });
    }

    if (rightHipForward !== null) {
      angleData.push({
        name: "rightHipForwardRatioSide",
        value: parseFloat(rightHipForward.toFixed(3)),
        unit: "ratio",
      });
      angleData.push({
        name: "rightHipForwardRatioSideab",
        value: parseFloat(Math.abs(rightHipForward).toFixed(3)),
        unit: "ratio",
      });
      angleData.push({
        name: "hipForwardRatioSide",
        value: parseFloat(rightHipForward.toFixed(3)),
        unit: "ratio",
      });
      angleData.push({
        name: "hipForwardRatioSideab",
        value: parseFloat(Math.abs(rightHipForward).toFixed(3)),
        unit: "ratio",
      });
    }

    if (leftHandForward !== null) {
      angleData.push({
        name: "leftHandForwardOffsetSide",
        value: parseFloat(leftHandForward.toFixed(3)),
        unit: "ratio",
      });
      angleData.push({
        name: "leftHandForwardOffsetSideab",
        value: parseFloat(Math.abs(leftHandForward).toFixed(3)),
        unit: "ratio",
      });
    }

    if (rightHandForward !== null) {
      angleData.push({
        name: "rightHandForwardOffsetSide",
        value: parseFloat(rightHandForward.toFixed(3)),
        unit: "ratio",
      });
      angleData.push({
        name: "rightHandForwardOffsetSideab",
        value: parseFloat(Math.abs(rightHandForward).toFixed(3)),
        unit: "ratio",
      });
      angleData.push({
        name: "handForwardOffsetSide",
        value: parseFloat(rightHandForward.toFixed(3)),
        unit: "ratio",
      });
      angleData.push({
        name: "handForwardOffsetSideab",
        value: parseFloat(Math.abs(rightHandForward).toFixed(3)),
        unit: "ratio",
      });
    }

    if (leftWristToToeForward !== null) {
      angleData.push({
        name: "leftWristToToeForwardOffsetSide",
        value: parseFloat(leftWristToToeForward.toFixed(3)),
        unit: "ratio",
      });
    }

    if (rightWristToToeForward !== null) {
      angleData.push({
        name: "rightWristToToeForwardOffsetSide",
        value: parseFloat(rightWristToToeForward.toFixed(3)),
        unit: "ratio",
      });
      angleData.push({
        name: "wristToToeForwardOffsetSide",
        value: parseFloat(rightWristToToeForward.toFixed(3)),
        unit: "ratio",
      });
    }

    if (leftElbowAngle !== null) {
      angleData.push({
        name: "leftElbowAngleDeg",
        value: parseFloat(leftElbowAngle.toFixed(1)),
        unit: "deg",
      });
    }

    if (rightElbowAngle !== null) {
      angleData.push({
        name: "rightElbowAngleDeg",
        value: parseFloat(rightElbowAngle.toFixed(1)),
        unit: "deg",
      });
      angleData.push({
        name: "elbowAngleDeg",
        value: parseFloat(rightElbowAngle.toFixed(1)),
        unit: "deg",
      });
    }

    if (leftShoulderArmAngle !== null) {
      angleData.push({
        name: "leftShoulderArmAngleDeg",
        value: parseFloat(leftShoulderArmAngle.toFixed(1)),
        unit: "deg",
      });
    }

    if (rightShoulderArmAngle !== null) {
      angleData.push({
        name: "rightShoulderArmAngleDeg",
        value: parseFloat(rightShoulderArmAngle.toFixed(1)),
        unit: "deg",
      });
      angleData.push({
        name: "shoulderArmAngleDeg",
        value: parseFloat(rightShoulderArmAngle.toFixed(1)),
        unit: "deg",
      });
    }
  }

  const lk = landmarks[25];
  const rk = landmarks[26];
  if (lk && rk) {
    const isLeft = (lk.visibility ?? 0) > (rk.visibility ?? 0);
    const hipAngle = calcLocalAngle(
      isLeft ? landmarks[11] : landmarks[12],
      isLeft ? landmarks[23] : landmarks[24],
      isLeft ? landmarks[27] : landmarks[28]
    );

    if (hipAngle > 0) {
      angleData.push({
        name: "bodyLineDeg",
        value: Math.round(hipAngle),
        unit: "deg",
      });
    }
  }

  return angleData;
}
