import { describe, expect, it } from "vitest";

import {
  calculateCV,
  calculateStdDev,
  detectHysteresisCycles,
  type TimedSignal,
} from "../trainingTemporal";

function signal(values: Array<number | undefined>, step = 0.1): TimedSignal[] {
  return values.map((value, index) => ({ time: index * step, value }));
}

const OPTIONS = {
  activeDirection: "above" as const,
  restThreshold: 0.2,
  activeThreshold: 0.8,
  minActiveSec: 0.1,
  minRestSec: 0.1,
  minCycleSec: 0.3,
};

describe("detectHysteresisCycles", () => {
  it("ignores an action already in progress when the video starts", () => {
    const values = [1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0];

    const actions = detectHysteresisCycles(signal(values), OPTIONS);

    expect(actions).toHaveLength(1);
    expect(actions[0].startTime).toBeGreaterThanOrEqual(0.3);
  });

  it("does not include an unfinished action at the end", () => {
    const values = [0, 0, 0, 1, 1, 1, 1];

    expect(detectHysteresisCycles(signal(values), OPTIONS)).toHaveLength(0);
  });

  it("allows a short landmark gap but resets after a long gap", () => {
    const shortGap = [0, 0, 0, 1, 1, undefined, 1, 0, 0, 0];
    const longGapSignal: TimedSignal[] = [
      { time: 0, value: 0 },
      { time: 0.1, value: 0 },
      { time: 0.2, value: 1 },
      { time: 0.3, value: 1 },
      { time: 0.8 },
      { time: 0.9, value: 0 },
      { time: 1, value: 0 },
    ];

    expect(detectHysteresisCycles(signal(shortGap), OPTIONS)).toHaveLength(1);
    expect(detectHysteresisCycles(longGapSignal, OPTIONS)).toHaveLength(0);
  });
});

describe("consistency statistics", () => {
  it("returns unavailable instead of perfect consistency for one sample", () => {
    expect(calculateStdDev([10])).toBeUndefined();
    expect(calculateCV([10])).toBeUndefined();
  });
});
