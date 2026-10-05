export interface TimedSignal {
  time: number;
  value?: number;
}

export interface CompleteAction {
  startFrame: number;
  peakFrame: number;
  endFrame: number;
  startTime: number;
  peakTime: number;
  endTime: number;
  isComplete: true;
}

export interface UsableInterval {
  startFrame: number;
  endFrame: number;
  startTime: number;
  endTime: number;
}

type ActiveDirection = "above" | "below";

export interface HysteresisCycleOptions {
  activeDirection: ActiveDirection;
  restThreshold: number;
  activeThreshold: number;
  minActiveSec?: number;
  minRestSec?: number;
  minCycleSec?: number;
  maxMissingSec?: number;
}

export interface SustainedIntervalOptions {
  enterThreshold: number;
  exitThreshold: number;
  minEnterSec?: number;
  minExitSec?: number;
  maxMissingSec?: number;
}

export function smoothSeries(data: number[], alpha = 0.3): number[] {
  if (data.length === 0) return [];
  const smoothed = [data[0]];
  for (let index = 1; index < data.length; index += 1) {
    smoothed.push(smoothed[index - 1] + alpha * (data[index] - smoothed[index - 1]));
  }
  return smoothed;
}

export function smoothTimedSignal(samples: TimedSignal[], alpha = 0.3): TimedSignal[] {
  let previous: number | undefined;
  return samples.map((sample) => {
    if (sample.value === undefined || !Number.isFinite(sample.value)) return { time: sample.time };
    previous = previous === undefined ? sample.value : previous + alpha * (sample.value - previous);
    return { time: sample.time, value: previous };
  });
}

function isRestValue(value: number, options: HysteresisCycleOptions) {
  return options.activeDirection === "above"
    ? value <= options.restThreshold
    : value >= options.restThreshold;
}

function isActiveValue(value: number, options: HysteresisCycleOptions) {
  return options.activeDirection === "above"
    ? value >= options.activeThreshold
    : value <= options.activeThreshold;
}

function isBetterPeak(value: number, current: number, direction: ActiveDirection) {
  return direction === "above" ? value > current : value < current;
}

export function detectHysteresisCycles(
  samples: TimedSignal[],
  options: HysteresisCycleOptions,
): CompleteAction[] {
  const minActiveSec = options.minActiveSec ?? 0.08;
  const minRestSec = options.minRestSec ?? 0.08;
  const minCycleSec = options.minCycleSec ?? 0.2;
  const maxMissingSec = options.maxMissingSec ?? 0.35;
  const actions: CompleteAction[] = [];

  let phase: "seeking_rest" | "ready" | "active" = "seeking_rest";
  let restCandidate: number | null = null;
  let activeCandidate: number | null = null;
  let startFrame: number | null = null;
  let peakFrame: number | null = null;
  let peakValue: number | null = null;
  let lastValidTime: number | null = null;

  const reset = () => {
    phase = "seeking_rest";
    restCandidate = null;
    activeCandidate = null;
    startFrame = null;
    peakFrame = null;
    peakValue = null;
  };

  samples.forEach((sample, index) => {
    const value = sample.value;
    if (value === undefined || !Number.isFinite(value)) {
      if (lastValidTime !== null && sample.time - lastValidTime > maxMissingSec) reset();
      return;
    }
    lastValidTime = sample.time;

    const inRest = isRestValue(value, options);
    const inActive = isActiveValue(value, options);

    if (phase === "seeking_rest") {
      if (!inRest) {
        restCandidate = null;
        return;
      }
      restCandidate ??= index;
      if (sample.time - samples[restCandidate].time >= minRestSec) {
        phase = "ready";
        startFrame = restCandidate;
        restCandidate = null;
      }
      return;
    }

    if (phase === "ready") {
      if (!inActive) {
        activeCandidate = null;
        if (inRest) startFrame = index;
        return;
      }

      activeCandidate ??= index;
      if (sample.time - samples[activeCandidate].time >= minActiveSec) {
        phase = "active";
        peakFrame = activeCandidate;
        peakValue = samples[activeCandidate].value ?? value;
        for (let cursor = activeCandidate; cursor <= index; cursor += 1) {
          const candidate = samples[cursor].value;
          if (
            candidate !== undefined &&
            peakValue !== null &&
            isBetterPeak(candidate, peakValue, options.activeDirection)
          ) {
            peakFrame = cursor;
            peakValue = candidate;
          }
        }
        activeCandidate = null;
      }
      return;
    }

    if (peakValue === null || isBetterPeak(value, peakValue, options.activeDirection)) {
      peakFrame = index;
      peakValue = value;
    }

    if (!inRest) {
      restCandidate = null;
      return;
    }

    restCandidate ??= index;
    if (sample.time - samples[restCandidate].time < minRestSec) return;

    if (
      startFrame !== null &&
      peakFrame !== null &&
      sample.time - samples[startFrame].time >= minCycleSec
    ) {
      actions.push({
        startFrame,
        peakFrame,
        endFrame: index,
        startTime: samples[startFrame].time,
        peakTime: samples[peakFrame].time,
        endTime: sample.time,
        isComplete: true,
      });
    }

    phase = "ready";
    startFrame = restCandidate;
    restCandidate = null;
    peakFrame = null;
    peakValue = null;
  });

  return actions;
}

export function detectSustainedIntervals(
  samples: TimedSignal[],
  options: SustainedIntervalOptions,
): UsableInterval[] {
  const minEnterSec = options.minEnterSec ?? 0.25;
  const minExitSec = options.minExitSec ?? 0.3;
  const maxMissingSec = options.maxMissingSec ?? 0.35;
  const intervals: UsableInterval[] = [];

  let active = false;
  let enterCandidate: number | null = null;
  let exitCandidate: number | null = null;
  let startFrame: number | null = null;
  let lastValidFrame: number | null = null;
  let lastValidTime: number | null = null;

  samples.forEach((sample, index) => {
    const value = sample.value;
    if (value === undefined || !Number.isFinite(value)) {
      if (lastValidTime !== null && sample.time - lastValidTime > maxMissingSec) {
        if (active && startFrame !== null && lastValidFrame !== null) {
          intervals.push({
            startFrame,
            endFrame: lastValidFrame,
            startTime: samples[startFrame].time,
            endTime: samples[lastValidFrame].time,
          });
        }
        active = false;
        enterCandidate = null;
        exitCandidate = null;
        startFrame = null;
      }
      return;
    }

    lastValidFrame = index;
    lastValidTime = sample.time;

    if (!active) {
      if (value < options.enterThreshold) {
        enterCandidate = null;
        return;
      }
      enterCandidate ??= index;
      if (sample.time - samples[enterCandidate].time >= minEnterSec) {
        active = true;
        startFrame = enterCandidate;
        enterCandidate = null;
      }
      return;
    }

    if (value >= options.exitThreshold) {
      exitCandidate = null;
      return;
    }

    exitCandidate ??= index;
    if (sample.time - samples[exitCandidate].time >= minExitSec && startFrame !== null) {
      const endFrame = Math.max(startFrame, exitCandidate - 1);
      intervals.push({
        startFrame,
        endFrame,
        startTime: samples[startFrame].time,
        endTime: samples[endFrame].time,
      });
      active = false;
      enterCandidate = null;
      exitCandidate = null;
      startFrame = null;
    }
  });

  if (active && startFrame !== null && lastValidFrame !== null && lastValidFrame > startFrame) {
    intervals.push({
      startFrame,
      endFrame: lastValidFrame,
      startTime: samples[startFrame].time,
      endTime: samples[lastValidFrame].time,
    });
  }

  return intervals;
}

export function calculateStdDev(data: number[]): number | undefined {
  if (data.length < 2) return undefined;
  const mean = data.reduce((sum, value) => sum + value, 0) / data.length;
  const variance = data.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (data.length - 1);
  return Math.sqrt(variance);
}

export function calculateCV(data: number[]): number | undefined {
  if (data.length < 2) return undefined;
  const mean = data.reduce((sum, value) => sum + value, 0) / data.length;
  if (Math.abs(mean) <= 1e-6) return undefined;
  const deviation = calculateStdDev(data);
  return deviation === undefined ? undefined : deviation / Math.abs(mean);
}
