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
