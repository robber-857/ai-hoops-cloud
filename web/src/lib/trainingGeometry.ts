import type { RawPoint } from "./dribbleTemporal";

export const TRAINING_VISIBILITY_THRESHOLD = 0.6;
const EPSILON = 1e-6;

export type Point2D = Pick<RawPoint, "x" | "y" | "visibility">;

export function isVisiblePoint(
  point: Point2D | null | undefined,
  threshold = TRAINING_VISIBILITY_THRESHOLD,
): point is Point2D {
  return Boolean(
    point &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      (point.visibility ?? 1) >= threshold,
  );
}

export function areVisiblePoints(
  ...points: Array<Point2D | null | undefined>
): boolean {
  return points.every((point) => isVisiblePoint(point));
}

export function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint(a: Point2D, b: Point2D): Point2D {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1),
  };
}

export function jointAngleDeg(a: Point2D, b: Point2D, c: Point2D): number | undefined {
  if (!areVisiblePoints(a, b, c)) return undefined;

  const abX = a.x - b.x;
  const abY = a.y - b.y;
  const cbX = c.x - b.x;
  const cbY = c.y - b.y;
  const abLength = Math.hypot(abX, abY);
  const cbLength = Math.hypot(cbX, cbY);
  if (abLength <= EPSILON || cbLength <= EPSILON) return undefined;

  const cosine = Math.max(-1, Math.min(1, (abX * cbX + abY * cbY) / (abLength * cbLength)));
  return (Math.acos(cosine) * 180) / Math.PI;
}

export function verticalDeviationDeg(top: Point2D, bottom: Point2D): number | undefined {
  if (!areVisiblePoints(top, bottom)) return undefined;
  const dx = top.x - bottom.x;
  const dy = top.y - bottom.y;
  if (Math.hypot(dx, dy) <= EPSILON) return undefined;
  return (Math.atan2(Math.abs(dx), Math.abs(dy)) * 180) / Math.PI;
}

export function horizontalDeviationDeg(left: Point2D, right: Point2D): number | undefined {
  if (!areVisiblePoints(left, right)) return undefined;
  const dx = right.x - left.x;
  const dy = right.y - left.y;
  if (Math.hypot(dx, dy) <= EPSILON) return undefined;
  return (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI;
}

export function pointToLineDistance(
  point: Point2D,
  lineStart: Point2D,
  lineEnd: Point2D,
): number | undefined {
  if (!areVisiblePoints(point, lineStart, lineEnd)) return undefined;
  const lineDx = lineEnd.x - lineStart.x;
  const lineDy = lineEnd.y - lineStart.y;
  const lineLength = Math.hypot(lineDx, lineDy);
  if (lineLength <= EPSILON) return undefined;

  return Math.abs(
    lineDy * point.x - lineDx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x,
  ) / lineLength;
}

export function legLength(
  hip: Point2D,
  knee: Point2D,
  ankle: Point2D,
): number | undefined {
  if (!areVisiblePoints(hip, knee, ankle)) return undefined;
  const value = distance(hip, knee) + distance(knee, ankle);
  return value > EPSILON ? value : undefined;
}

export function median(values: Array<number | undefined>): number | undefined {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (valid.length === 0) return undefined;
  const sorted = [...valid].sort((a, b) => a - b);
  const midpointIndex = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[midpointIndex]
    : (sorted[midpointIndex - 1] + sorted[midpointIndex]) / 2;
}

export function average(values: Array<number | undefined>): number | undefined {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (valid.length === 0) return undefined;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

export function standardDeviation(values: Array<number | undefined>): number | undefined {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (valid.length < 2) return undefined;
  const mean = valid.reduce((sum, value) => sum + value, 0) / valid.length;
  const variance = valid.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (valid.length - 1);
  return Math.sqrt(variance);
}

export function relativeVariation(values: Array<number | undefined>): number | undefined {
  const mean = average(values);
  const deviation = standardDeviation(values);
  if (mean === undefined || deviation === undefined || Math.abs(mean) <= EPSILON) return undefined;
  return deviation / Math.abs(mean);
}

export function percentile(values: Array<number | undefined>, ratio: number): number | undefined {
  const valid = values
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .sort((a, b) => a - b);
  if (valid.length === 0) return undefined;
  const clamped = Math.max(0, Math.min(1, ratio));
  const index = Math.min(valid.length - 1, Math.floor(clamped * (valid.length - 1)));
  return valid[index];
}
