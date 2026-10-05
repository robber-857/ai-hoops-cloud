import type { DribbleFrame, RawPoint } from "../dribbleTemporal";

type PointKey =
  | "la"
  | "ra"
  | "lw"
  | "rw"
  | "le"
  | "re"
  | "lk"
  | "rk"
  | "ls"
  | "rs"
  | "lh"
  | "rh"
  | "lf"
  | "rf";

type PointOverrides = Partial<Record<PointKey, RawPoint>>;

export function point(x: number, y: number, visibility = 1): RawPoint {
  return { x, y, z: 0, visibility };
}

export function frontFrame(
  t: number,
  overrides: PointOverrides = {},
  isSideView = false,
): DribbleFrame {
  const base: Record<PointKey, RawPoint> = {
    ls: point(0.4, 0.3),
    rs: point(0.6, 0.3),
    le: point(0.4, 0.48),
    re: point(0.6, 0.48),
    lw: point(0.4, 0.62),
    rw: point(0.6, 0.62),
    lh: point(0.45, 0.55),
    rh: point(0.55, 0.55),
    lk: point(0.44, 0.72),
    rk: point(0.56, 0.72),
    la: point(0.43, 0.9),
    ra: point(0.57, 0.9),
    lf: point(0.41, 0.92),
    rf: point(0.59, 0.92),
  };
  const values = { ...base, ...overrides };
  return {
    t,
    ...values,
    trunkHeight: 0.25,
    shoulderWidth: 0.2,
    isSideView,
  };
}

export function sideFrame(t: number, overrides: PointOverrides = {}): DribbleFrame {
  const hidden = 0.4;
  const base: Record<PointKey, RawPoint> = {
    ls: point(0.4, 0.3),
    le: point(0.48, 0.45),
    lw: point(0.56, 0.58),
    lh: point(0.42, 0.52),
    lk: point(0.46, 0.71),
    la: point(0.5, 0.9),
    lf: point(0.56, 0.91),
    rs: point(0.405, 0.3, hidden),
    re: point(0.485, 0.45, hidden),
    rw: point(0.565, 0.58, hidden),
    rh: point(0.425, 0.52, hidden),
    rk: point(0.465, 0.71, hidden),
    ra: point(0.505, 0.9, hidden),
    rf: point(0.565, 0.91, hidden),
  };
  const values = { ...base, ...overrides };
  return {
    t,
    ...values,
    trunkHeight: 0.22,
    shoulderWidth: 0.005,
    isSideView: true,
  };
}

function phases(
  rest: (time: number) => DribbleFrame,
  active: (time: number) => DribbleFrame,
  cycles: number,
  options: { prefixActive?: boolean; finishRest?: boolean } = {},
): DribbleFrame[] {
  const frames: DribbleFrame[] = [];
  let index = 0;
  const append = (count: number, factory: (time: number) => DribbleFrame) => {
    for (let cursor = 0; cursor < count; cursor += 1) {
      frames.push(factory(index * 0.1));
      index += 1;
    }
  };

  if (options.prefixActive) append(8, active);
  append(8, rest);
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    append(10, active);
    if (cycle < cycles - 1 || options.finishRest !== false) append(10, rest);
  }
  return frames;
}

export function jumpingJackFrames(
  cycles = 1,
  options: { prefixActive?: boolean; finishRest?: boolean } = {},
) {
  const rest = (time: number) => frontFrame(time);
  const active = (time: number) =>
    frontFrame(time, {
      la: point(0.26, 0.9),
      ra: point(0.74, 0.9),
      lk: point(0.355, 0.72),
      rk: point(0.645, 0.72),
      lf: point(0.23, 0.92),
      rf: point(0.77, 0.92),
      lw: point(0.4, 0.14),
      rw: point(0.6, 0.14),
    });
  return phases(rest, active, cycles, options);
}

export function lungeFrames(
  cycles = 1,
  options: { prefixActive?: boolean; finishRest?: boolean } = {},
) {
  const rest = (time: number) =>
    sideFrame(time, {
      rs: point(0.405, 0.3),
      rh: point(0.425, 0.52),
      rk: point(0.465, 0.71),
      ra: point(0.505, 0.9),
      rf: point(0.565, 0.91),
    });
  const active = (time: number) =>
    sideFrame(time, {
      ls: point(0.25, 0.32),
      lh: point(0.25, 0.65),
      lk: point(0.5, 0.7),
      la: point(0.5, 0.9),
      lf: point(0.56, 0.91),
      rh: point(0.3, 0.65),
      rk: point(0.35, 0.76),
      ra: point(0.52, 0.9),
      rf: point(0.58, 0.91),
    });
  return phases(rest, active, cycles, options);
}

export function pushupFrames(
  cycles = 1,
  options: { prefixActive?: boolean; finishRest?: boolean } = {},
) {
  const top = (time: number) =>
    sideFrame(time, {
      ls: point(0.3, 0.45),
      le: point(0.45, 0.45),
      lw: point(0.6, 0.45),
      lh: point(0.55, 0.45),
      lk: point(0.68, 0.45),
      la: point(0.8, 0.45),
      lf: point(0.84, 0.45),
    });
  const bottom = (time: number) =>
    sideFrame(time, {
      ls: point(0.3, 0.45),
      le: point(0.45, 0.45),
      lw: point(0.45, 0.62),
      lh: point(0.55, 0.45),
      lk: point(0.68, 0.45),
      la: point(0.8, 0.45),
      lf: point(0.84, 0.45),
    });
  return phases(top, bottom, cycles, options);
}

export function singleLegFrames(activeFrameCount = 12) {
  const frames: DribbleFrame[] = [];
  let index = 0;
  for (let cursor = 0; cursor < 5; cursor += 1) {
    frames.push(frontFrame(index * 0.1));
    index += 1;
  }
  for (let cursor = 0; cursor < activeFrameCount; cursor += 1) {
    frames.push(
      frontFrame(index * 0.1, {
        la: point(0.45, 0.82),
        lf: point(0.45, 0.84),
        lk: point(0.45, 0.7),
        ra: point(0.55, 0.9),
        rf: point(0.57, 0.92),
        rk: point(0.55, 0.72),
      }),
    );
    index += 1;
  }
  return frames;
}

export function jumpRopeFrames(
  cycles = 1,
  options: { prefixActive?: boolean; finishRest?: boolean } = {},
) {
  const ground = (time: number) =>
    frontFrame(time, {
      le: point(0.43, 0.48),
      re: point(0.57, 0.48),
    });
  const air = (time: number) =>
    frontFrame(time, {
      le: point(0.43, 0.48),
      re: point(0.57, 0.48),
      la: point(0.43, 0.86),
      ra: point(0.57, 0.86),
      lf: point(0.41, 0.88),
      rf: point(0.59, 0.88),
    });
  return phases(ground, air, cycles, options);
}

export function highKneeFrames(cycles = 2) {
  const rest = (time: number) =>
    sideFrame(time, {
      lh: point(0.42, 0.5),
      lk: point(0.44, 0.6),
      la: point(0.48, 0.9),
    });
  const active = (time: number) =>
    sideFrame(time, {
      lh: point(0.42, 0.5),
      lk: point(0.46, 0.76),
      la: point(0.48, 0.9),
    });
  return phases(rest, active, cycles);
}
