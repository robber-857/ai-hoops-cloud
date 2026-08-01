"use client";

import React, { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, ChevronLeft, ChevronRight, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTemplateById, type ActionTemplate, type Metric } from "@/config/templates";
import type { AngleData, MetricScoreBand } from "@/lib/scoring";
import { buildTrainingMetricChartModels } from "@/lib/trainingMetricPresentation";
import type { FrameSample } from "@/store/analysisStore";

const HIP_HIGH_TEMPLATE_ID = "dribble_front_onehand_oneside_height";
const FRONT_NARROW_CROSSOVER_TEMPLATE_ID = "dribble_front_narrow_crossover";
const FRONT_ONEHAND_V_TEMPLATE_ID = "dribble_front_onehand_v";
const SIDE_NARROW_CROSSOVER_TEMPLATE_ID = "dribble_side_narrow_crossover";
const SIDE_ONEHAND_ONESIDE_TEMPLATE_ID = "dribble_side_onehand_oneside";
const TRAINING_HIGH_KNEES_TEMPLATE_ID = "high_knees_in_place_side";
const TRAINING_PUSHUP_PLANK_TEMPLATE_ID = "pushup_hold_high_plank";
const TRAINING_WALL_SIT_HALF_TEMPLATE_ID = "wall_sit_half_hold";
const TRAINING_WALL_SIT_QUARTER_TEMPLATE_ID = "wall_sit_quarter_hold";
const TRAINING_DEEP_SQUAT_TEMPLATE_ID = "deep_squat_reps_side";

type ChartPoint = {
  time: number;
  value: number;
};

type MetricRange = {
  min: number;
  max: number;
  domain: [number, number];
};

type ChartMetricConfig = Pick<Metric, "type" | "params">;

type PerformanceChartItem = {
  title: string;
  helper: string;
  metricKey: string;
  valueLabel: string;
  value: string;
  accent: string;
  explanation: string;
  advice: string;
  chart: React.ReactNode;
};

const tooltipStyle: React.CSSProperties = {
  backgroundColor: "#0f172a",
  border: "1px solid rgba(148, 163, 184, 0.28)",
  borderRadius: 10,
  boxShadow: "0 18px 48px rgba(2, 6, 23, 0.28)",
  color: "#e2e8f0",
};

const tooltipLabelStyle: React.CSSProperties = {
  color: "#cbd5e1",
  fontWeight: 600,
};

const GENERIC_METRIC_CONFIG: Record<
  string,
  { label: string; desc: string; color: string; domain?: [number, number] }
> = {
  wristHeightRatioToShoulder: {
    label: "Dribble height",
    desc: "Height ratio against the shoulder-to-hip line.",
    color: "#38bdf8",
    domain: [0, 1],
  },
  wristHeightRatioToHip: {
    label: "Dribble height",
    desc: "Height ratio against the hip line.",
    color: "#38bdf8",
    domain: [-0.5, 1],
  },
  kneeAngleDeg: {
    label: "Knee bend",
    desc: "Knee angle through the movement.",
    color: "#34d399",
    domain: [90, 180],
  },
  shoulderStanceRatio: {
    label: "Stance width",
    desc: "Foot width compared with shoulder width.",
    color: "#fbbf24",
    domain: [0, 4],
  },
  guideHandInChestBoxRate: {
    label: "Guide hand",
    desc: "Whether the off hand stays in the chest protection box.",
    color: "#f472b6",
    domain: [0, 1.2],
  },
  forearmVerticalDeg: {
    label: "Arm angle",
    desc: "Forearm vertical angle through the movement.",
    color: "#a78bfa",
    domain: [0, 90],
  },
};

interface Props {
  timeline: FrameSample[] | null | undefined;
  templateId: string;
  template?: ActionTemplate | null;
  savedMetrics?: AngleData[] | null;
  scoringContext?: Record<string, unknown>;
}

function getSavedMetric(savedMetrics: AngleData[] | null | undefined, key: string): number | null {
  const matches = savedMetrics?.filter((metric) => metric.name === key) ?? [];
  const match = matches.find((metric) => metric.unit === "calc") ?? matches[0];
  return typeof match?.value === "number" && Number.isFinite(match.value) ? match.value : null;
}

function getTimelineMetric(frame: FrameSample, key: string): number | null {
  const match = frame.angles.find((angle) => angle.name === key);
  return typeof match?.value === "number" && Number.isFinite(match.value) ? match.value : null;
}

function buildSeries(timeline: FrameSample[] | null | undefined, key: string): ChartPoint[] {
  if (!timeline?.length) return [];

  return timeline
    .map((frame) => {
      const value = getTimelineMetric(frame, key);
      return value === null ? null : { time: frame.time, value };
    })
    .filter((point): point is ChartPoint => point !== null);
}

function average(points: ChartPoint[]): number | null {
  if (points.length === 0) return null;
  return points.reduce((sum, point) => sum + point.value, 0) / points.length;
}

function chooseClosestSeries(
  timeline: FrameSample[] | null | undefined,
  keys: string[],
  savedValue: number | null
): ChartPoint[] {
  const candidates = keys
    .map((key) => {
      const points = buildSeries(timeline, key);
      return { key, points, avg: average(points) };
    })
    .filter((candidate) => candidate.points.length > 0);

  if (candidates.length === 0) return [];

  if (savedValue !== null) {
    return candidates.sort((a, b) => {
      const aDiff = a.avg === null ? Number.POSITIVE_INFINITY : Math.abs(a.avg - savedValue);
      const bDiff = b.avg === null ? Number.POSITIVE_INFINITY : Math.abs(b.avg - savedValue);
      return aDiff - bDiff;
    })[0].points;
  }

  return candidates.sort((a, b) => b.points.length - a.points.length)[0].points;
}

function chooseMostVariableSeries(
  timeline: FrameSample[] | null | undefined,
  keys: string[]
): ChartPoint[] {
  const candidates = keys
    .map((key) => {
      const points = buildSeries(timeline, key);
      if (points.length === 0) return null;

      const mean = points.reduce((sum, point) => sum + point.value, 0) / points.length;
      const variance =
        points.reduce((sum, point) => sum + Math.pow(point.value - mean, 2), 0) / points.length;
      const maxAbs = Math.max(...points.map((point) => Math.abs(point.value)));

      return {
        points,
        signal: Math.sqrt(variance) + maxAbs * 0.04,
      };
    })
    .filter(
      (candidate): candidate is { points: ChartPoint[]; signal: number } => candidate !== null
    );

  if (candidates.length === 0) return [];
  return candidates.sort((a, b) => b.signal - a.signal)[0].points;
}

function buildRollingStd(points: ChartPoint[], windowSize = 10): ChartPoint[] {
  if (points.length < 3) return [];

  return points
    .map((point, index) => {
      const start = Math.max(0, index - windowSize + 1);
      const window = points.slice(start, index + 1);
      if (window.length < 3) return null;

      const mean = window.reduce((sum, item) => sum + item.value, 0) / window.length;
      const variance =
        window.reduce((sum, item) => sum + Math.pow(item.value - mean, 2), 0) / window.length;

      return {
        time: point.time,
        value: Math.sqrt(variance),
      };
    })
    .filter((point): point is ChartPoint => point !== null);
}

function detectTimelineEvents(
  points: ChartPoint[],
  mode: "max" | "min",
  threshold: number,
  minGapSec: number
): ChartPoint[] {
  if (points.length < 3) return [];

  const events: ChartPoint[] = [];
  for (let index = 1; index < points.length - 1; index += 1) {
    const prev = points[index - 1];
    const point = points[index];
    const next = points[index + 1];
    const isPeak =
      mode === "max"
        ? point.value >= prev.value && point.value > next.value && point.value >= threshold
        : point.value <= prev.value && point.value < next.value && point.value <= threshold;

    if (!isPeak) continue;

    const previousEvent = events[events.length - 1];
    if (!previousEvent || point.time - previousEvent.time >= minGapSec) {
      events.push(point);
    }
  }

  return events;
}

function buildEventIntervalSeries(events: ChartPoint[]): ChartPoint[] {
  if (events.length < 2) return [];

  return events.slice(1).map((event, index) => ({
    time: event.time,
    value: Math.max(0, event.time - events[index].time),
  }));
}

function buildEventCvSeries(events: ChartPoint[], windowSize = 4): ChartPoint[] {
  const intervals = buildEventIntervalSeries(events);
  if (intervals.length < 2) return [];

  return intervals
    .map((point, index) => {
      const window = intervals.slice(Math.max(0, index - windowSize + 1), index + 1);
      if (window.length < 2) return null;

      const mean = window.reduce((sum, item) => sum + item.value, 0) / window.length;
      if (mean <= 0) return null;

      const variance =
        window.reduce((sum, item) => sum + Math.pow(item.value - mean, 2), 0) / window.length;

      return {
        time: point.time,
        value: Math.sqrt(variance) / mean,
      };
    })
    .filter((point): point is ChartPoint => point !== null);
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function formatRangeNumber(value: number, decimals = 3): string {
  if (Math.abs(value) < 1e-9) return "0";
  return value.toFixed(decimals).replace(/\.?0+$/, "");
}

function formatRangeText(range: Pick<MetricRange, "min" | "max">, decimals = 2): string {
  return `${formatRangeNumber(range.min, decimals)}-${formatRangeNumber(range.max, decimals)}`;
}

function getTemplateMetricConfig(
  templateId: string,
  computeKey: string
): ChartMetricConfig | null {
  const template = getTemplateById(templateId);
  const metric = template?.metrics.find((item) => item.computeKey === computeKey);
  return metric ? { type: metric.type, params: metric.params } : null;
}

function buildRangeFromTemplateMetric(
  templateId: string,
  computeKey: string,
  fallback: MetricRange,
  options: { toleranceMultiplier?: number } = {}
): MetricRange {
  const metric = getTemplateMetricConfig(templateId, computeKey);
  if (!metric) return fallback;

  let min = fallback.min;
  let max = fallback.max;

  if (metric.type === "target" && typeof metric.params.target === "number") {
    const tolerance =
      (typeof metric.params.tol === "number" ? metric.params.tol : 0) *
      (options.toleranceMultiplier ?? 1);
    min = metric.params.target - tolerance;
    max = metric.params.target + tolerance;
  } else if (
    (metric.type === "range" || metric.type === "rangeByOption") &&
    typeof metric.params.L === "number" &&
    typeof metric.params.U === "number"
  ) {
    min = metric.params.L;
    max = metric.params.U;
  }

  const span = Math.max(Math.abs(max - min), 0.01);
  const padding = Math.max(span * 0.5, 0.1);

  return {
    min,
    max,
    domain: [
      Math.min(fallback.domain[0], min - padding),
      Math.max(fallback.domain[1], max + padding),
    ],
  };
}

function buildRangeFromMetric(
  value: number | null,
  scoreBand: MetricScoreBand | null,
): MetricRange {
  const center = value ?? scoreBand?.target ?? 0;
  const min = scoreBand?.min ?? center;
  const max = scoreBand?.max ?? center;

  const targetSpan = Math.max(Math.abs(max - min), 0.01);
  const configuredMargin =
    scoreBand && scoreBand.margin > 0
      ? scoreBand.margin
      : targetSpan;
  const padding = Math.max(configuredMargin, targetSpan * 0.6, 0.05);
  let domainMin = min - padding;
  let domainMax = max + padding;

  if (min >= 0) domainMin = Math.max(0, domainMin);
  if (value !== null) {
    domainMin = Math.min(domainMin, value - padding * 0.15);
    domainMax = Math.max(domainMax, value + padding * 0.15);
  }

  if (domainMax - domainMin < 0.01) {
    domainMax = domainMin + 1;
  }

  return { min, max, domain: [domainMin, domainMax] };
}

function getMetricValueLabel(metric: Metric): string {
  if (metric.unit === "deg") return "Degrees";
  if (metric.unit === "ratio") return "Ratio";
  if (metric.unit === "norm") return "Position";
  if (metric.unit === "score") return "Score";
  return "Result";
}

function getMetricAdvice(metric: Metric, value: number | null, range: MetricRange): string {
  if (value === null) {
    return metric.targetText ?? "Keep the movement clearly visible and try again.";
  }
  if (value < range.min) {
    return (
      metric.hint_low ??
      metric.hint_bad ??
      metric.hint_high ??
      metric.targetText ??
      "Move closer to the target."
    );
  }
  if (value > range.max) {
    return (
      metric.hint_high ??
      metric.hint_bad ??
      metric.hint_low ??
      metric.targetText ??
      "Move closer to the target."
    );
  }
  return metric.hint_good ?? metric.targetText ?? "This part of the movement is on target.";
}

function formatMetric(value: number | null, decimals = 2): string {
  return value === null ? "N/A" : value.toFixed(decimals);
}

function getSummaryValue(points: ChartPoint[], savedValue: number | null): number | null {
  return savedValue ?? average(points);
}

function SummaryRange({
  value,
  range,
  target,
  label,
  unit,
  accent,
}: {
  value: number | null;
  range: MetricRange;
  target?: number;
  label: string;
  unit?: string;
  accent: string;
}) {
  const markerPercent =
    value === null
      ? 0
      : clampPercent(((value - range.domain[0]) / (range.domain[1] - range.domain[0])) * 100);
  const rangeStart = clampPercent(
    ((range.min - range.domain[0]) / (range.domain[1] - range.domain[0])) * 100
  );
  const rangeEnd = clampPercent(
    ((range.max - range.domain[0]) / (range.domain[1] - range.domain[0])) * 100
  );
  const targetPercent =
    target === undefined
      ? null
      : clampPercent(((target - range.domain[0]) / (range.domain[1] - range.domain[0])) * 100);
  const targetWidth = Math.max(4, rangeEnd - rangeStart);
  const targetCenter = rangeStart + (rangeEnd - rangeStart) / 2;
  const markerLabelTransform =
    markerPercent > 88 ? "translateX(-100%)" : markerPercent < 12 ? "translateX(0)" : "translateX(-50%)";
  const targetLabelStyle: React.CSSProperties =
    rangeEnd > 92
      ? { right: 0, color: accent }
      : rangeStart < 8
        ? { left: 0, color: accent }
        : { left: `${targetCenter}%`, transform: "translateX(-50%)", color: accent };

  return (
    <div className="flex h-full flex-col justify-center gap-5 rounded-lg border border-dashed border-slate-800 bg-slate-950/45 px-4 py-4">
      <div>
        <div className="text-xs font-medium text-slate-300">{label}</div>
        <div className="mt-2 text-3xl font-semibold tabular-nums text-slate-50">
          {formatMetric(value, 3)}
          {unit ? <span className="ml-1 text-sm font-medium text-slate-400">{unit}</span> : null}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide">
          <span className="text-slate-500">Full scale</span>
          <span style={{ color: accent }}>Target zone</span>
        </div>

        <div className="relative h-16">
          <div className="absolute inset-x-0 top-7 h-5 -translate-y-1/2 rounded-full border border-slate-600/80 bg-slate-700/80 shadow-inner shadow-slate-950/60" />

          {[0, 25, 50, 75, 100].map((tick) => (
            <div
              key={tick}
              className="absolute top-4 h-6 w-px bg-slate-400/30"
              style={{ left: `${tick}%` }}
            />
          ))}

          <div
            className="absolute top-7 h-6 -translate-y-1/2 rounded-full border border-white/20"
            style={{
              left: `${rangeStart}%`,
              width: `${targetWidth}%`,
              background: `linear-gradient(90deg, ${accent}99, ${accent}d9)`,
              boxShadow: `0 0 18px ${accent}2e`,
            }}
          />

          {targetPercent !== null ? (
            <div
              className="absolute top-2 h-10 w-px bg-slate-100/80"
              style={{ left: `${targetPercent}%` }}
            >
              <span className="absolute -top-4 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-slate-300">
                Goal
              </span>
            </div>
          ) : null}

          {value !== null ? (
            <>
              <div
                className="absolute top-7 h-9 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-950 shadow-[0_0_0_1px_rgba(248,250,252,0.45),0_8px_18px_rgba(2,6,23,0.5)]"
                style={{ left: `${markerPercent}%`, background: accent }}
              />
              <div
                className="absolute top-0 whitespace-nowrap rounded-md border border-slate-700 bg-slate-950 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-slate-100"
                style={{
                  left: `${markerPercent}%`,
                  transform: markerLabelTransform,
                }}
              >
                Now {formatMetric(value, 3)}
              </div>
            </>
          ) : null}
        </div>

        <div className="relative h-9 text-[11px] font-medium text-slate-400">
          <span className="absolute left-0 top-0 tabular-nums">{range.domain[0]}</span>
          <span className="absolute right-0 top-0 tabular-nums">{range.domain[1]}</span>
          <span className="absolute top-5 whitespace-nowrap tabular-nums" style={targetLabelStyle}>
            Target {formatRangeText(range)}
          </span>
        </div>
      </div>
    </div>
  );
}

function MetricLineChart({
  points,
  range,
  target,
  label,
  accent,
  savedValue,
}: {
  points: ChartPoint[];
  range: MetricRange;
  target?: number;
  label: string;
  accent: string;
  savedValue: number | null;
}) {
  if (points.length < 2) {
    return (
      <SummaryRange
        value={savedValue}
        range={range}
        target={target}
        label={savedValue === null ? "Data unavailable" : "Saved average"}
        accent={accent}
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart data={points} margin={{ top: 8, right: 14, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} opacity={0.35} />
        <ReferenceArea y1={range.min} y2={range.max} fill={accent} fillOpacity={0.12} />
        {target !== undefined ? (
          <ReferenceLine y={target} stroke="#e2e8f0" strokeDasharray="4 4" strokeOpacity={0.72} />
        ) : null}
        <XAxis
          dataKey="time"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(value: number | string) => `${Number(value).toFixed(0)}s`}
          stroke="#94a3b8"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={range.domain}
          stroke="#94a3b8"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ stroke: "#cbd5e1", strokeOpacity: 0.2 }}
          contentStyle={tooltipStyle}
          labelStyle={tooltipLabelStyle}
          labelFormatter={(value: number | string) => `${Number(value).toFixed(1)}s`}
          formatter={(value: number | string) => [Number(value).toFixed(2), label]}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={accent}
          strokeWidth={2}
          dot={points.length <= 80 ? { r: 1.2, strokeWidth: 0, fill: accent } : false}
          activeDot={{ r: 3.5, stroke: "#f8fafc", strokeWidth: 1, fill: accent }}
          animationDuration={500}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ConsistencyChart({
  points,
  savedValue,
}: {
  points: ChartPoint[];
  savedValue: number | null;
}) {
  const accent = "#38bdf8";
  const range = { min: 0, max: 0.062, domain: [0, 0.12] as [number, number] };

  if (points.length < 2) {
    return (
      <SummaryRange
        value={savedValue}
        range={range}
        target={0.05}
        label="Saved variation"
        accent={accent}
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <BarChart data={points} margin={{ top: 8, right: 14, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} opacity={0.3} />
        <ReferenceArea y1={0} y2={0.062} fill={accent} fillOpacity={0.12} />
        <ReferenceLine y={0.05} stroke="#e2e8f0" strokeDasharray="4 4" strokeOpacity={0.6} />
        <XAxis
          dataKey="time"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(value: number | string) => `${Number(value).toFixed(0)}s`}
          stroke="#94a3b8"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 0.12]}
          stroke="#94a3b8"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: number | string) => Number(value).toFixed(2)}
        />
        <Tooltip
          cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
          contentStyle={tooltipStyle}
          labelStyle={tooltipLabelStyle}
          labelFormatter={(value: number | string) => `${Number(value).toFixed(1)}s`}
          formatter={(value: number | string) => [Number(value).toFixed(3), "Rolling variation"]}
        />
        <Bar dataKey="value" radius={[3, 3, 0, 0]} animationDuration={500}>
          {points.map((point, index) => (
            <Cell
              key={`${point.time}-${index}`}
              fill={point.value <= 0.062 ? "#38bdf8" : "#f59e0b"}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function GuideHandChart({
  points,
  savedValue,
}: {
  points: ChartPoint[];
  savedValue: number | null;
}) {
  const accent = "#2f9e68";

  if (points.length < 2) {
    return (
      <SummaryRange
        value={savedValue}
        range={{ min: 0.75, max: 1, domain: [0, 1] }}
        label="Saved protection rate"
        unit="rate"
        accent={accent}
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <BarChart data={points} margin={{ top: 8, right: 14, left: -22, bottom: 0 }}>
        <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} opacity={0.25} />
        <ReferenceLine y={0.75} stroke="#e2e8f0" strokeDasharray="4 4" strokeOpacity={0.55} />
        <XAxis
          dataKey="time"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(value: number | string) => `${Number(value).toFixed(0)}s`}
          stroke="#94a3b8"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis hide domain={[0, 1]} />
        <Tooltip
          cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
          contentStyle={tooltipStyle}
          labelStyle={tooltipLabelStyle}
          labelFormatter={(value: number | string) => `${Number(value).toFixed(1)}s`}
          formatter={(value: number | string) => [
            Number(value) >= 0.5 ? "In chest box" : "Outside chest box",
            "Guide hand",
          ]}
        />
        <Bar dataKey="value" radius={[2, 2, 0, 0]} animationDuration={500}>
          {points.map((point, index) => (
            <Cell
              key={`${point.time}-${index}`}
              fill={point.value >= 0.5 ? accent : "#ef4444"}
              fillOpacity={0.82}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function VariationBarChart({
  points,
  savedValue,
  range,
  target,
  label,
  accent,
}: {
  points: ChartPoint[];
  savedValue: number | null;
  range: MetricRange;
  target: number;
  label: string;
  accent: string;
}) {
  if (points.length < 2) {
    return (
      <SummaryRange
        value={savedValue}
        range={range}
        target={target}
        label="Saved variation"
        accent={accent}
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <BarChart data={points} margin={{ top: 8, right: 14, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} opacity={0.3} />
        <ReferenceArea y1={range.min} y2={range.max} fill={accent} fillOpacity={0.12} />
        <ReferenceLine y={target} stroke="#e2e8f0" strokeDasharray="4 4" strokeOpacity={0.58} />
        <XAxis
          dataKey="time"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(value: number | string) => `${Number(value).toFixed(0)}s`}
          stroke="#94a3b8"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={range.domain}
          stroke="#94a3b8"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: number | string) => Number(value).toFixed(2)}
        />
        <Tooltip
          cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
          contentStyle={tooltipStyle}
          labelStyle={tooltipLabelStyle}
          labelFormatter={(value: number | string) => `${Number(value).toFixed(1)}s`}
          formatter={(value: number | string) => [Number(value).toFixed(3), label]}
        />
        <Bar dataKey="value" radius={[3, 3, 0, 0]} animationDuration={500}>
          {points.map((point, index) => (
            <Cell
              key={`${point.time}-${index}`}
              fill={point.value >= range.min && point.value <= range.max ? accent : "#f59e0b"}
              fillOpacity={0.84}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function MidlineCrossingChart({
  points,
  savedValue,
  accent,
}: {
  points: ChartPoint[];
  savedValue: number | null;
  accent: string;
}) {
  if (points.length < 2) {
    return (
      <SummaryRange
        value={savedValue}
        range={{ min: 0.62, max: 1, domain: [0, 1] }}
        label="Saved crossing rate"
        unit="rate"
        accent={accent}
      />
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart data={points} margin={{ top: 8, right: 14, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="#334155" strokeDasharray="3 3" opacity={0.32} />
        <ReferenceLine
          y={0}
          stroke="#e2e8f0"
          strokeDasharray="4 4"
          strokeOpacity={0.65}
        />
        <XAxis
          dataKey="time"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(value: number | string) => `${Number(value).toFixed(0)}s`}
          stroke="#94a3b8"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[-1.2, 1.2]}
          stroke="#94a3b8"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: number | string) => Number(value).toFixed(1)}
        />
        <Tooltip
          cursor={{ stroke: "#cbd5e1", strokeOpacity: 0.2 }}
          contentStyle={tooltipStyle}
          labelStyle={tooltipLabelStyle}
          labelFormatter={(value: number | string) => `${Number(value).toFixed(1)}s`}
          formatter={(value: number | string) => [Number(value).toFixed(3), "Wrist offset"]}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={accent}
          strokeWidth={2}
          dot={points.length <= 80 ? { r: 1.2, strokeWidth: 0, fill: accent } : false}
          activeDot={{ r: 3.5, stroke: "#f8fafc", strokeWidth: 1, fill: accent }}
          animationDuration={500}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function TemplatePerformanceCard({
  timeline,
  subtitle,
  charts,
}: {
  timeline: FrameSample[] | null | undefined;
  subtitle: string;
  charts: readonly PerformanceChartItem[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeChart = charts[activeIndex] ?? charts[0];

  if (!activeChart) return null;

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + charts.length) % charts.length);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % charts.length);
  };

  return (
    <Card className="overflow-hidden border-slate-800 bg-slate-900/45 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Activity className="h-4 w-4 shrink-0 text-sky-500" />
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-slate-100">
              Performance Curves
            </CardTitle>
            <p className="mt-1 truncate text-xs text-slate-400">
              {subtitle} - {timeline?.length ?? 0} timeline samples
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-slate-400">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-500 hover:bg-slate-800 hover:text-slate-100"
            onClick={handlePrev}
            aria-label="Previous chart"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[3rem] text-center font-mono text-xs tabular-nums text-slate-300">
            {activeIndex + 1} / {charts.length}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-500 hover:bg-slate-800 hover:text-slate-100"
            onClick={handleNext}
            aria-label="Next chart"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
          <div className="min-w-0 flex-1">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 pt-1">
                <h4 className="truncate text-base font-semibold text-slate-100">
                  {activeChart.title}
                </h4>
                <p className="mt-1 truncate text-xs leading-5 text-slate-400">
                  {activeChart.helper}
                </p>
              </div>
              <div className="shrink-0 rounded-lg border border-slate-700/80 bg-slate-950/60 px-2.5 py-2 text-right sm:px-3">
                <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  {activeChart.valueLabel}
                </div>
                <div className="mt-0.5 text-base font-semibold tabular-nums leading-none text-slate-100 sm:text-sm sm:leading-normal">
                  {activeChart.value}
                </div>
              </div>
            </div>

            <div className="h-[280px] min-h-[280px] w-full min-w-0 rounded-xl border border-slate-800/70 bg-slate-950/25 px-2 py-3 sm:h-[320px] sm:px-3">
              {activeChart.chart}
            </div>
          </div>

          <aside className="flex min-w-0 flex-col rounded-xl border border-slate-800/80 bg-slate-950/35 p-4 sm:p-5 lg:w-[360px]">
            <div className="flex items-start gap-3">
              <span
                className="mt-1 h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: activeChart.accent }}
              />
              <div className="min-w-0">
                <h4 className="text-xl font-bold leading-tight text-slate-50">
                  {activeChart.title}
                </h4>
              </div>
            </div>

            <div className="mt-6 flex items-start gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
              <p className="text-sm leading-6 text-slate-300">{activeChart.explanation}</p>
            </div>

            <div className="mt-5 rounded-lg border border-slate-800/70 bg-slate-900/35 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                High score cue
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{activeChart.advice}</p>
            </div>

            <div className="mt-auto pt-5">
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full"
                  style={{ width: "72%", backgroundColor: activeChart.accent }}
                />
              </div>
            </div>
          </aside>
        </div>
      </CardContent>
    </Card>
  );
}

function HipHighPerformanceCard({
  timeline,
  savedMetrics,
}: {
  timeline: FrameSample[] | null | undefined;
  savedMetrics?: AngleData[] | null;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const stanceSaved = getSavedMetric(savedMetrics, "shoulderStanceRatio");
  const guideSaved = getSavedMetric(savedMetrics, "guideHandInChestBoxRate");
  const heightSaved = getSavedMetric(savedMetrics, "wristHeightRatioToShoulder");
  const consistencySaved = getSavedMetric(savedMetrics, "stdWristHeightRatioToShoulderPerCycle");

  const stancePoints = buildSeries(timeline, "shoulderStanceRatio");
  const heightPoints = chooseClosestSeries(
    timeline,
    [
      "leftWristHeightRatioToShoulder",
      "rightWristHeightRatioToShoulder",
      "wristHeightRatioToShoulder",
    ],
    heightSaved
  );
  const guidePoints = chooseClosestSeries(
    timeline,
    ["leftGuideHandInChestBoxRate", "rightGuideHandInChestBoxRate", "guideHandInChestBoxRate"],
    guideSaved
  );
  const consistencyPoints = buildRollingStd(heightPoints);

  const charts = [
    {
      title: "Dribble Height",
      helper: "Target range 0.45-0.75",
      metricKey: "wristHeightRatioToShoulder",
      valueLabel: "Average",
      value: formatMetric(getSummaryValue(heightPoints, heightSaved)),
      accent: "#38bdf8",
      explanation:
        "Shows how the dribbling hand height changes through the video. The target band means the ball is staying around hip height instead of rising toward the chest.",
      advice:
        "Keep the bounce between the hip and lower torso, push with a relaxed wrist, and avoid lifting the hand after each bounce.",
      chart: (
        <MetricLineChart
          points={heightPoints}
          range={{ min: 0.45, max: 0.75, domain: [0, 1] }}
          label="Height ratio"
          accent="#38bdf8"
          savedValue={heightSaved}
        />
      ),
    },
    {
      title: "Height Consistency",
      helper: "Lower variation is better",
      metricKey: "stdWristHeightRatioToShoulderPerCycle",
      valueLabel: "Variation",
      value: formatMetric(consistencySaved, 3),
      accent: "#38bdf8",
      explanation:
        "Tracks how much the dribble height changes over short windows. Smaller bars mean the child is keeping the bounce rhythm and hand height more stable.",
      advice:
        "Use the same bounce force each repetition, keep the wrist path compact, and find a steady rhythm before adding speed.",
      chart: <ConsistencyChart points={consistencyPoints} savedValue={consistencySaved} />,
    },
    {
      title: "Stance Width",
      helper: "Target range 1.75-2.20",
      metricKey: "shoulderStanceRatio",
      valueLabel: "Ratio",
      value: formatMetric(getSummaryValue(stancePoints, stanceSaved)),
      accent: "#f59e0b",
      explanation:
        "Shows foot width relative to shoulder width. A stable stance gives the child room to dribble without leaning or stepping out of balance.The yellow area represents a stable standing posture.",
      advice:
        "Stay in an athletic base with knees soft, feet wider than shoulders, and avoid letting the feet drift too narrow or too wide.",
      chart: (
        <MetricLineChart
          points={stancePoints}
          range={{ min: 1.75, max: 2.2, domain: [0.8, 3] }}
          label="Stance ratio"
          accent="#f59e0b"
          savedValue={stanceSaved}
        />
      ),
    },
    {
      title: "Guide Hand",
      helper: "Chest-box target 75%+",
      metricKey: "guideHandInChestBoxRate",
      valueLabel: "Rate",
      value: formatMetric(getSummaryValue(guidePoints, guideSaved)),
      accent: "#2f9e68",
      explanation:
        "Shows whether the non-dribbling hand stays in the chest protection area. A higher rate means the off hand is ready to protect the ball.",
      advice:
        "Keep the guide hand lifted in front of the chest, palm active, and avoid letting it drop beside the body during the dribble.",
      chart: <GuideHandChart points={guidePoints} savedValue={guideSaved} />,
    },
  ] as const;

  const activeChart = charts[activeIndex] ?? charts[0];

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + charts.length) % charts.length);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % charts.length);
  };

  return (
    <Card className="overflow-hidden border-slate-800 bg-slate-900/45 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Activity className="h-4 w-4 shrink-0 text-sky-500" />
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-slate-100">
              Performance Curves
            </CardTitle>
            <p className="mt-1 truncate text-xs text-slate-400">
              Front one-hand hip-high dribble - {timeline?.length ?? 0} timeline samples
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-slate-400">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-500 hover:bg-slate-800 hover:text-slate-100"
            onClick={handlePrev}
            aria-label="Previous chart"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[3rem] text-center font-mono text-xs tabular-nums text-slate-300">
            {activeIndex + 1} / {charts.length}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-500 hover:bg-slate-800 hover:text-slate-100"
            onClick={handleNext}
            aria-label="Next chart"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
          <div className="min-w-0 flex-1">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 pt-1">
                <h4 className="truncate text-base font-semibold text-slate-100">
                  {activeChart.title}
                </h4>
                <p className="mt-1 truncate text-xs leading-5 text-slate-400">
                  {activeChart.helper}
                </p>
              </div>
              <div className="shrink-0 rounded-lg border border-slate-700/80 bg-slate-950/60 px-2.5 py-2 text-right sm:px-3">
                <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  {activeChart.valueLabel}
                </div>
                <div className="mt-0.5 text-base font-semibold tabular-nums leading-none text-slate-100 sm:text-sm sm:leading-normal">
                  {activeChart.value}
                </div>
              </div>
            </div>

            <div className="h-[280px] min-h-[280px] w-full min-w-0 rounded-xl border border-slate-800/70 bg-slate-950/25 px-2 py-3 sm:h-[320px] sm:px-3">
              {activeChart.chart}
            </div>
          </div>

          <aside className="flex min-w-0 flex-col rounded-xl border border-slate-800/80 bg-slate-950/35 p-4 sm:p-5 lg:w-[360px]">
            <div className="flex items-start gap-3">
              <span
                className="mt-1 h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: activeChart.accent }}
              />
              <div className="min-w-0">
                <h4 className="text-xl font-bold leading-tight text-slate-50">
                  {activeChart.title}
                </h4>
              </div>
            </div>

            <div className="mt-6 flex items-start gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
              <p className="text-sm leading-6 text-slate-300">{activeChart.explanation}</p>
            </div>

            <div className="mt-5 rounded-lg border border-slate-800/70 bg-slate-900/35 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                High score cue
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{activeChart.advice}</p>
            </div>

            <div className="mt-auto pt-5">
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full"
                  style={{ width: "72%", backgroundColor: activeChart.accent }}
                />
              </div>
            </div>
          </aside>
        </div>
      </CardContent>
    </Card>
  );
}

function FrontNarrowCrossoverPerformanceCard({
  timeline,
  savedMetrics,
}: {
  timeline: FrameSample[] | null | undefined;
  savedMetrics?: AngleData[] | null;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const leftToeSaved = getSavedMetric(savedMetrics, "toeAngleDegLeft");
  const rightToeSaved = getSavedMetric(savedMetrics, "toeAngleDegRight");
  const stanceSaved = getSavedMetric(savedMetrics, "shoulderStanceRatio");
  const crossSaved = getSavedMetric(savedMetrics, "crossMidlineRate");
  const overreachSaved = getSavedMetric(savedMetrics, "overreachControlFront");
  const receiveConsistencySaved = getSavedMetric(savedMetrics, "stdWristXAtContactPerCycleNormByST");
  const heightConsistencySaved = getSavedMetric(savedMetrics, "stdWristHeightRatioToHipPerCycle");

  const leftToePoints = buildSeries(timeline, "toeAngleDegLeft");
  const rightToePoints = buildSeries(timeline, "toeAngleDegRight");
  const stancePoints = buildSeries(timeline, "shoulderStanceRatio");
  const midlinePoints = chooseMostVariableSeries(timeline, [
    "leftWristMidlineOffsetNorm",
    "rightWristMidlineOffsetNorm",
    "wristMidlineOffsetNorm",
  ]);
  const overreachPoints = chooseClosestSeries(
    timeline,
    ["leftOverreachControlFront", "rightOverreachControlFront", "overreachControlFront"],
    overreachSaved
  );
  const contactXPoints = chooseMostVariableSeries(timeline, [
    "leftWristXAtContactNormByST",
    "rightWristXAtContactNormByST",
    "wristXAtContactNormByST",
  ]);
  const heightPoints = chooseMostVariableSeries(timeline, [
    "leftWristHeightRatioToHip",
    "rightWristHeightRatioToHip",
    "wristHeightRatioToHip",
    "leftWristHeightRatioToShoulder",
    "rightWristHeightRatioToShoulder",
  ]);
  const contactConsistencyPoints = buildRollingStd(contactXPoints, 12);
  const heightConsistencyPoints = buildRollingStd(heightPoints, 12);

  const charts = [
    {
      title: "Left Toe Direction",
      helper: "Target angle 0-13 deg",
      metricKey: "toeAngleDegLeft",
      valueLabel: "Deg",
      value: formatMetric(getSummaryValue(leftToePoints, leftToeSaved), 1),
      accent: "#38bdf8",
      explanation:
        "Shows whether the left foot stays pointed forward during the crossover. Smaller angles mean the stance is cleaner and the child is less likely to twist out of balance.",
      advice:
        "Keep the left toes facing the basket, land softly through the foot, and avoid letting the toe turn outward when the ball changes side.",
      chart: (
        <MetricLineChart
          points={leftToePoints}
          range={{ min: 0, max: 13, domain: [0, 45] }}
          label="Left toe angle"
          accent="#38bdf8"
          savedValue={leftToeSaved}
        />
      ),
    },
    {
      title: "Right Toe Direction",
      helper: "Target angle 0-13 deg",
      metricKey: "toeAngleDegRight",
      valueLabel: "Deg",
      value: formatMetric(getSummaryValue(rightToePoints, rightToeSaved), 1),
      accent: "#60a5fa",
      explanation:
        "Shows whether the right foot stays pointed forward through the crossover. A stable foot angle helps the child transfer the ball without opening the hips too early.",
      advice:
        "Keep the right toes forward, stay low, and let the hand move the ball across instead of rotating the whole body.",
      chart: (
        <MetricLineChart
          points={rightToePoints}
          range={{ min: 0, max: 13, domain: [0, 45] }}
          label="Right toe angle"
          accent="#60a5fa"
          savedValue={rightToeSaved}
        />
      ),
    },
    {
      title: "Stance Width",
      helper: "Target range 1.57-2.43",
      metricKey: "shoulderStanceRatio",
      valueLabel: "Ratio",
      value: formatMetric(getSummaryValue(stancePoints, stanceSaved)),
      accent: "#f59e0b",
      explanation:
        "Shows foot width compared with shoulder width. A narrow crossover needs enough base to change direction, but not so wide that the child gets stuck.",
      advice:
        "Keep the feet a little wider than shoulder width, knees soft, and avoid stepping wider each time the ball crosses.",
      chart: (
        <MetricLineChart
          points={stancePoints}
          range={{ min: 1.57, max: 2.43, domain: [0.8, 3] }}
          label="Stance ratio"
          accent="#f59e0b"
          savedValue={stanceSaved}
        />
      ),
    },
    {
      title: "Cross Midline",
      helper: "Target rate 0.62-1.00",
      metricKey: "crossMidlineRate",
      valueLabel: "Rate",
      value: formatMetric(crossSaved),
      accent: "#14b8a6",
      explanation:
        "Show the wrist's movement along the body's midline. A good crossover step clearly moves the ball from one side of the body to the other.",
      advice:
        "Push the ball across the center line with a quick, low hand path, ensuring it crosses the midline during its movement.",
      chart: <MidlineCrossingChart points={midlinePoints} savedValue={crossSaved} accent="#14b8a6" />,
    },
    {
      title: "Overreach Control",
      helper: "Target range 0.05-0.24",
      metricKey: "overreachControlFront",
      valueLabel: "Ratio",
      value: formatMetric(getSummaryValue(overreachPoints, overreachSaved)),
      accent: "#a78bfa",
      explanation:
        "When receiving the ball, make sure the receiving point is not too far away. A smaller ratio means the child is keeping the ball close and under control instead of reaching out and risking a turnover.",
      advice:
        "Keep the crossover compact: move the ball across the body, receive it near the opposite knee, and avoid swinging the arm too far outside the frame.",
      chart: (
        <MetricLineChart
          points={overreachPoints}
          range={{ min: 0.05, max: 0.24, domain: [0, 0.8] }}
          label="Overreach ratio"
          accent="#a78bfa"
          savedValue={overreachSaved}
        />
      ),
    },
    {
      title: "Receive Consistency",
      helper: "Lower variation is better",
      metricKey: "stdWristXAtContactPerCycleNormByST",
      valueLabel: "Variation",
      value: formatMetric(receiveConsistencySaved, 3),
      accent: "#22c55e",
      explanation:
        "Tracks how much the receiving point changes side-to-side. Smaller bars mean the child is catching the bounce in a repeatable place.",
      advice:
        "Start slowly, receive the ball near the same knee each time, and increase speed only after the landing point stays stable.",
      chart: (
        <VariationBarChart
          points={contactConsistencyPoints}
          savedValue={receiveConsistencySaved}
          range={{ min: 0, max: 0.09, domain: [0, 0.18] }}
          target={0.06}
          label="Receive variation"
          accent="#22c55e"
        />
      ),
    },
    {
      title: "Height Consistency",
      helper: "Lower variation is better",
      metricKey: "stdWristHeightRatioToHipPerCycle",
      valueLabel: "Variation",
      value: formatMetric(heightConsistencySaved, 3),
      accent: "#2f9e68",
      explanation:
        "Tracks how much the dribble height changes during the crossover. Stable height keeps the ball low enough to protect but high enough to control.",
      advice:
        "Use the same bounce force on both sides, keep the wrist relaxed, and avoid letting the ball pop up after it crosses the body.",
      chart: (
        <VariationBarChart
          points={heightConsistencyPoints}
          savedValue={heightConsistencySaved}
          range={{ min: 0, max: 0.072, domain: [0, 0.16] }}
          target={0.042}
          label="Height variation"
          accent="#2f9e68"
        />
      ),
    },
  ] as const;

  const activeChart = charts[activeIndex] ?? charts[0];

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + charts.length) % charts.length);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % charts.length);
  };

  return (
    <Card className="overflow-hidden border-slate-800 bg-slate-900/45 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-slate-800/80 px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Activity className="h-4 w-4 shrink-0 text-sky-500" />
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-slate-100">
              Performance Curves
            </CardTitle>
            <p className="mt-1 truncate text-xs text-slate-400">
              Front narrow crossover - {timeline?.length ?? 0} timeline samples
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 text-slate-400">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-500 hover:bg-slate-800 hover:text-slate-100"
            onClick={handlePrev}
            aria-label="Previous chart"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[3rem] text-center font-mono text-xs tabular-nums text-slate-300">
            {activeIndex + 1} / {charts.length}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-500 hover:bg-slate-800 hover:text-slate-100"
            onClick={handleNext}
            aria-label="Next chart"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
          <div className="min-w-0 flex-1">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 pt-1">
                <h4 className="truncate text-base font-semibold text-slate-100">
                  {activeChart.title}
                </h4>
                <p className="mt-1 truncate text-xs leading-5 text-slate-400">
                  {activeChart.helper}
                </p>
              </div>
              <div className="shrink-0 rounded-lg border border-slate-700/80 bg-slate-950/60 px-2.5 py-2 text-right sm:px-3">
                <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  {activeChart.valueLabel}
                </div>
                <div className="mt-0.5 text-base font-semibold tabular-nums leading-none text-slate-100 sm:text-sm sm:leading-normal">
                  {activeChart.value}
                </div>
              </div>
            </div>

            <div className="h-[280px] min-h-[280px] w-full min-w-0 rounded-xl border border-slate-800/70 bg-slate-950/25 px-2 py-3 sm:h-[320px] sm:px-3">
              {activeChart.chart}
            </div>
          </div>

          <aside className="flex min-w-0 flex-col rounded-xl border border-slate-800/80 bg-slate-950/35 p-4 sm:p-5 lg:w-[360px]">
            <div className="flex items-start gap-3">
              <span
                className="mt-1 h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: activeChart.accent }}
              />
              <div className="min-w-0">
                <h4 className="text-xl font-bold leading-tight text-slate-50">
                  {activeChart.title}
                </h4>
              </div>
            </div>

            <div className="mt-6 flex items-start gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
              <p className="text-sm leading-6 text-slate-300">{activeChart.explanation}</p>
            </div>

            <div className="mt-5 rounded-lg border border-slate-800/70 bg-slate-900/35 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                High score cue
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{activeChart.advice}</p>
            </div>

            <div className="mt-auto pt-5">
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full"
                  style={{ width: "72%", backgroundColor: activeChart.accent }}
                />
              </div>
            </div>
          </aside>
        </div>
      </CardContent>
    </Card>
  );
}

function FrontOneHandVPerformanceCard({
  timeline,
  savedMetrics,
}: {
  timeline: FrameSample[] | null | undefined;
  savedMetrics?: AngleData[] | null;
}) {
  const leftToeSaved = getSavedMetric(savedMetrics, "toeAngleDegLeft");
  const rightToeSaved = getSavedMetric(savedMetrics, "toeAngleDegRight");
  const alignSaved = getSavedMetric(savedMetrics, "wristAlignOppFootAtPeak");
  const receiveZoneSaved = getSavedMetric(savedMetrics, "receiveZoneQuarterNorm");
  const receiveConsistencySaved = getSavedMetric(savedMetrics, "stdWristXAtContactPerCycleNormByST");
  const heightConsistencySaved = getSavedMetric(savedMetrics, "stdWristHeightRatioToHipPerCycle");

  const leftToePoints = buildSeries(timeline, "toeAngleDegLeft");
  const rightToePoints = buildSeries(timeline, "toeAngleDegRight");
  const alignPoints = chooseClosestSeries(
    timeline,
    ["leftWristAlignOppFootAtPeak", "rightWristAlignOppFootAtPeak", "wristAlignOppFootAtPeak"],
    alignSaved
  );
  const receiveZonePoints = chooseClosestSeries(
    timeline,
    ["leftReceiveZoneQuarterNorm", "rightReceiveZoneQuarterNorm", "receiveZoneQuarterNorm"],
    receiveZoneSaved
  );
  const contactXPoints = chooseMostVariableSeries(timeline, [
    "leftWristXAtContactNormByST",
    "rightWristXAtContactNormByST",
    "wristXAtContactNormByST",
  ]);
  const heightPoints = chooseMostVariableSeries(timeline, [
    "leftWristHeightRatioToHip",
    "rightWristHeightRatioToHip",
    "wristHeightRatioToHip",
    "leftWristHeightRatioToShoulder",
    "rightWristHeightRatioToShoulder",
  ]);
  const contactConsistencyPoints = buildRollingStd(contactXPoints, 12);
  const heightConsistencyPoints = buildRollingStd(heightPoints, 12);

  const charts: PerformanceChartItem[] = [
    {
      title: "Left Toe Direction",
      helper: "Target angle 0-17 deg",
      metricKey: "toeAngleDegLeft",
      valueLabel: "Deg",
      value: formatMetric(getSummaryValue(leftToePoints, leftToeSaved), 1),
      accent: "#38bdf8",
      explanation:
        "Shows whether the left foot stays pointed forward while the ball moves in a V path. A smaller angle keeps the base stable for the next catch.",
      advice:
        "Keep the left toes mostly forward, bend the knees, and avoid rotating the foot outward when reaching across.",
      chart: (
        <MetricLineChart
          points={leftToePoints}
          range={{ min: 0, max: 17, domain: [0, 45] }}
          label="Left toe angle"
          accent="#38bdf8"
          savedValue={leftToeSaved}
        />
      ),
    },
    {
      title: "Right Toe Direction",
      helper: "Target angle 0-17 deg",
      metricKey: "toeAngleDegRight",
      valueLabel: "Deg",
      value: formatMetric(getSummaryValue(rightToePoints, rightToeSaved), 1),
      accent: "#60a5fa",
      explanation:
        "Shows whether the right foot stays pointed forward during the V dribble. Stable toe direction keeps the hips from opening too early.",
      advice:
        "Keep the right toes forward and let the hand guide the V path instead of turning the whole body.",
      chart: (
        <MetricLineChart
          points={rightToePoints}
          range={{ min: 0, max: 17, domain: [0, 45] }}
          label="Right toe angle"
          accent="#60a5fa"
          savedValue={rightToeSaved}
        />
      ),
    },
    {
      title: "Opposite Foot Alignment",
      helper: "Target range 0-0.08",
      metricKey: "wristAlignOppFootAtPeak",
      valueLabel: "Offset",
      value: formatMetric(getSummaryValue(alignPoints, alignSaved), 3),
      accent: "#14b8a6",
      explanation:
        "Shows how close the wrist gets to the opposite foot when the ball is moved across. Lower values mean the V reach is landing in the intended spot.",
      advice:
        "Reach across with a compact hand path, keep the ball low, and finish the move near the opposite foot instead of stopping at the center.",
      chart: (
        <MetricLineChart
          points={alignPoints}
          range={{ min: 0, max: 0.08, domain: [0, 0.45] }}
          label="Opposite foot offset"
          accent="#14b8a6"
          savedValue={alignSaved}
        />
      ),
    },
    {
      title: "Receive Zone",
      helper: "Target range 0.35-0.65",
      metricKey: "receiveZoneQuarterNorm",
      valueLabel: "Zone",
      value: formatMetric(getSummaryValue(receiveZonePoints, receiveZoneSaved), 2),
      accent: "#f59e0b",
      explanation:
        "Shows where the ball is received between the two feet. The middle band means the landing point is controlled near the body center.",
      advice:
        "Catch the bounce in front of the body, keep the landing point centered, and avoid pulling the ball too far toward one foot.",
      chart: (
        <MetricLineChart
          points={receiveZonePoints}
          range={{ min: 0.35, max: 0.65, domain: [0, 1] }}
          label="Receive zone"
          accent="#f59e0b"
          savedValue={receiveZoneSaved}
        />
      ),
    },
    {
      title: "Receive Consistency",
      helper: "Lower variation is better",
      metricKey: "stdWristXAtContactPerCycleNormByST",
      valueLabel: "Variation",
      value: formatMetric(receiveConsistencySaved, 3),
      accent: "#22c55e",
      explanation:
        "Tracks how much the receive point changes from side to side. Smaller bars mean the V dribble is repeating the same landing position.",
      advice:
        "Slow the rhythm down, hit the same receive spot for several reps, then add speed without changing the landing point.",
      chart: (
        <VariationBarChart
          points={contactConsistencyPoints}
          savedValue={receiveConsistencySaved}
          range={{ min: 0, max: 0.125, domain: [0, 0.22] }}
          target={0.08}
          label="Receive variation"
          accent="#22c55e"
        />
      ),
    },
    {
      title: "Height Consistency",
      helper: "Lower variation is better",
      metricKey: "stdWristHeightRatioToHipPerCycle",
      valueLabel: "Variation",
      value: formatMetric(heightConsistencySaved, 3),
      accent: "#2f9e68",
      explanation:
        "Tracks whether the dribble height stays consistent through the V path. Stable height makes the ball easier to control.",
      advice:
        "Use the same bounce force on each side, keep the wrist relaxed, and avoid letting the ball pop up after the reach.",
      chart: (
        <VariationBarChart
          points={heightConsistencyPoints}
          savedValue={heightConsistencySaved}
          range={{ min: 0, max: 0.072, domain: [0, 0.16] }}
          target={0.042}
          label="Height variation"
          accent="#2f9e68"
        />
      ),
    },
  ];

  return (
    <TemplatePerformanceCard
      timeline={timeline}
      subtitle="Front one-hand V dribble"
      charts={charts}
    />
  );
}

function SideNarrowCrossoverPerformanceCard({
  timeline,
  savedMetrics,
}: {
  timeline: FrameSample[] | null | undefined;
  savedMetrics?: AngleData[] | null;
}) {
  const handForwardSaved = getSavedMetric(savedMetrics, "handForwardOffsetSideab");
  const elbowSaved = getSavedMetric(savedMetrics, "elbowAngleDeg");
  const shoulderArmSaved = getSavedMetric(savedMetrics, "shoulderArmAngleDeg");
  const kneeSaved = getSavedMetric(savedMetrics, "kneeOverToeSide");
  const hipSaved = getSavedMetric(savedMetrics, "hipForwardRatioSideab");
  const trunkSaved = getSavedMetric(savedMetrics, "trunkLeanDegSide");
  const heightSaved = getSavedMetric(savedMetrics, "wristHeightRatioToHip");
  const heightConsistencySaved = getSavedMetric(savedMetrics, "stdWristHeightRatioToHipPerCycle");

  const handForwardPoints = chooseClosestSeries(
    timeline,
    ["leftHandForwardOffsetSideab", "rightHandForwardOffsetSideab", "handForwardOffsetSideab"],
    handForwardSaved
  );
  const elbowPoints = chooseClosestSeries(
    timeline,
    ["leftElbowAngleDeg", "rightElbowAngleDeg", "elbowAngleDeg"],
    elbowSaved
  );
  const shoulderArmPoints = chooseClosestSeries(
    timeline,
    ["leftShoulderArmAngleDeg", "rightShoulderArmAngleDeg", "shoulderArmAngleDeg"],
    shoulderArmSaved
  );
  const kneePoints = chooseClosestSeries(
    timeline,
    ["leftKneeOverToeSide", "rightKneeOverToeSide", "kneeOverToeSide"],
    kneeSaved
  );
  const hipPoints = chooseClosestSeries(
    timeline,
    ["leftHipForwardRatioSideab", "rightHipForwardRatioSideab", "hipForwardRatioSideab"],
    hipSaved
  );
  const trunkPoints = buildSeries(timeline, "trunkLeanDegSide");
  const heightPoints = chooseClosestSeries(
    timeline,
    ["leftWristHeightRatioToHip", "rightWristHeightRatioToHip", "wristHeightRatioToHip"],
    heightSaved
  );
  const heightConsistencyPoints = buildRollingStd(heightPoints, 12);

  const charts: PerformanceChartItem[] = [
    {
      title: "Hand Forward Reach",
      helper: "Target range 0-0.35",
      metricKey: "handForwardOffsetSideab",
      valueLabel: "Offset",
      value: formatMetric(getSummaryValue(handForwardPoints, handForwardSaved), 2),
      accent: "#38bdf8",
      explanation:
        "Shows how far the dribbling hand reaches forward from the shoulder. A compact reach keeps the body from leaning over the ball.",
      advice:
        "Relax the arm, keep the hand slightly in front of the body, and avoid chasing the ball too far forward.",
      chart: (
        <MetricLineChart
          points={handForwardPoints}
          range={{ min: 0, max: 0.35, domain: [0, 0.8] }}
          label="Hand forward offset"
          accent="#38bdf8"
          savedValue={handForwardSaved}
        />
      ),
    },
    {
      title: "Elbow Angle",
      helper: "Target range 145-179 deg",
      metricKey: "elbowAngleDeg",
      valueLabel: "Deg",
      value: formatMetric(getSummaryValue(elbowPoints, elbowSaved), 1),
      accent: "#60a5fa",
      explanation:
        "Shows whether the elbow stays relaxed and open during the side crossover. The target band avoids both a collapsed elbow and a stiff locked arm.",
      advice:
        "Keep the elbow open but soft, push with the wrist, and avoid locking the whole arm straight.",
      chart: (
        <MetricLineChart
          points={elbowPoints}
          range={{ min: 145, max: 179, domain: [90, 180] }}
          label="Elbow angle"
          accent="#60a5fa"
          savedValue={elbowSaved}
        />
      ),
    },
    {
      title: "Shoulder Arm Angle",
      helper: "Target range 60-120 deg",
      metricKey: "shoulderArmAngleDeg",
      valueLabel: "Deg",
      value: formatMetric(getSummaryValue(shoulderArmPoints, shoulderArmSaved), 1),
      accent: "#a78bfa",
      explanation:
        "Shows how high the upper arm lifts from the torso. Staying in the target band keeps the shoulder relaxed and the hand naturally below the body line.",
      advice:
        "Drop the shoulder, let the arm hang naturally, and keep the crossover driven by the wrist instead of lifting the upper arm.",
      chart: (
        <MetricLineChart
          points={shoulderArmPoints}
          range={{ min: 60, max: 120, domain: [20, 160] }}
          label="Shoulder arm angle"
          accent="#a78bfa"
          savedValue={shoulderArmSaved}
        />
      ),
    },
    {
      title: "Knee Over Toe",
      helper: "Target offset -0.05-0.05",
      metricKey: "kneeOverToeSide",
      valueLabel: "Offset",
      value: formatMetric(getSummaryValue(kneePoints, kneeSaved), 3),
      accent: "#f59e0b",
      explanation:
        "Shows the knee position relative to the toe from the side view. Staying near the center keeps the child balanced instead of falling forward.",
      advice:
        "Sit the hips back, keep the knees soft, and avoid letting the knees drift far past the toes during the crossover.",
      chart: (
        <MetricLineChart
          points={kneePoints}
          range={{ min: -0.05, max: 0.05, domain: [-0.35, 0.35] }}
          label="Knee-to-toe offset"
          accent="#f59e0b"
          savedValue={kneeSaved}
        />
      ),
    },
    {
      title: "Hip Forward Control",
      helper: "Target range 0-0.22",
      metricKey: "hipForwardRatioSideab",
      valueLabel: "Offset",
      value: formatMetric(getSummaryValue(hipPoints, hipSaved), 2),
      accent: "#14b8a6",
      explanation:
        "Shows whether the hips are drifting forward from the ankle line. Smaller values mean the body stays centered over the feet.",
      advice:
        "Keep the hips back, stay low, and hold the center of gravity over the middle of the foot.",
      chart: (
        <MetricLineChart
          points={hipPoints}
          range={{ min: 0, max: 0.22, domain: [0, 0.7] }}
          label="Hip forward offset"
          accent="#14b8a6"
          savedValue={hipSaved}
        />
      ),
    },
    {
      title: "Trunk Lean",
      helper: "Target angle 10-30 deg",
      metricKey: "trunkLeanDegSide",
      valueLabel: "Deg",
      value: formatMetric(getSummaryValue(trunkPoints, trunkSaved), 1),
      accent: "#f472b6",
      explanation:
        "Shows the forward body lean from the side view. A controlled lean protects the ball while keeping the child ready to move.",
      advice:
        "Lean forward slightly from the hips, keep the chest balanced, and avoid folding too low or standing upright.",
      chart: (
        <MetricLineChart
          points={trunkPoints}
          range={{ min: 10, max: 30, domain: [0, 60] }}
          label="Trunk lean"
          accent="#f472b6"
          savedValue={trunkSaved}
        />
      ),
    },
    {
      title: "Dribble Height",
      helper: "Target range 0.30-0.57",
      metricKey: "wristHeightRatioToHip",
      valueLabel: "Ratio",
      value: formatMetric(getSummaryValue(heightPoints, heightSaved), 2),
      accent: "#22c55e",
      explanation:
        "Shows ball height relative to the body from the side. The target band keeps the crossover low enough for control.",
      advice:
        "Keep the bounce below the hip, stay low through the knees, and avoid letting the ball rise as it crosses.",
      chart: (
        <MetricLineChart
          points={heightPoints}
          range={{ min: 0.3, max: 0.57, domain: [-0.3, 1] }}
          label="Height ratio"
          accent="#22c55e"
          savedValue={heightSaved}
        />
      ),
    },
    {
      title: "Height Consistency",
      helper: "Lower variation is better",
      metricKey: "stdWristHeightRatioToHipPerCycle",
      valueLabel: "Variation",
      value: formatMetric(heightConsistencySaved, 3),
      accent: "#2f9e68",
      explanation:
        "Tracks whether the side crossover keeps a steady bounce height. Smaller bars mean fewer spikes and dips.",
      advice:
        "Use the same bounce force each repetition, keep the wrist path compact, and add speed only after the height is stable.",
      chart: (
        <VariationBarChart
          points={heightConsistencyPoints}
          savedValue={heightConsistencySaved}
          range={{ min: 0, max: 0.1, domain: [0, 0.18] }}
          target={0.06}
          label="Height variation"
          accent="#2f9e68"
        />
      ),
    },
  ];

  return (
    <TemplatePerformanceCard
      timeline={timeline}
      subtitle="Side narrow crossover"
      charts={charts}
    />
  );
}

function SideOneHandOneSidePerformanceCard({
  timeline,
  savedMetrics,
}: {
  timeline: FrameSample[] | null | undefined;
  savedMetrics?: AngleData[] | null;
}) {
  const kneeSaved = getSavedMetric(savedMetrics, "kneeOverToeSide");
  const hipSaved = getSavedMetric(savedMetrics, "hipForwardRatioSide");
  const trunkSaved = getSavedMetric(savedMetrics, "trunkLeanDegSide");
  const handSaved = getSavedMetric(savedMetrics, "handForwardOffsetSide");
  const spotSaved = getSavedMetric(savedMetrics, "wristToToeForwardOffsetSide");
  const heightSaved = getSavedMetric(savedMetrics, "wristHeightRatioToHip");
  const spotConsistencySaved = getSavedMetric(savedMetrics, "stdWristToToeForwardOffsetPerCycle");
  const heightConsistencySaved = getSavedMetric(savedMetrics, "stdWristHeightRatioToHipPerCycle");

  const kneePoints = chooseClosestSeries(
    timeline,
    ["leftKneeOverToeSide", "rightKneeOverToeSide", "kneeOverToeSide"],
    kneeSaved
  );
  const hipPoints = chooseClosestSeries(
    timeline,
    ["leftHipForwardRatioSide", "rightHipForwardRatioSide", "hipForwardRatioSide"],
    hipSaved
  );
  const trunkPoints = buildSeries(timeline, "trunkLeanDegSide");
  const handPoints = chooseClosestSeries(
    timeline,
    ["leftHandForwardOffsetSide", "rightHandForwardOffsetSide", "handForwardOffsetSide"],
    handSaved
  );
  const spotPoints = chooseClosestSeries(
    timeline,
    [
      "leftWristToToeForwardOffsetSide",
      "rightWristToToeForwardOffsetSide",
      "wristToToeForwardOffsetSide",
    ],
    spotSaved
  );
  const heightPoints = chooseClosestSeries(
    timeline,
    ["leftWristHeightRatioToHip", "rightWristHeightRatioToHip", "wristHeightRatioToHip"],
    heightSaved
  );
  const spotConsistencyPoints = buildRollingStd(spotPoints, 12);
  const heightConsistencyPoints = buildRollingStd(heightPoints, 12);

  const charts: PerformanceChartItem[] = [
    {
      title: "Knee Position",
      helper: "Target offset -0.15--0.05",
      metricKey: "kneeOverToeSide",
      valueLabel: "Offset",
      value: formatMetric(getSummaryValue(kneePoints, kneeSaved), 3),
      accent: "#f59e0b",
      explanation:
        "Shows where the knee sits relative to the toe from the side. The target keeps the knee slightly behind the toe for balance.",
      advice:
        "Sit the hips back, keep weight through the middle of the foot, and avoid drifting the knee too far forward.",
      chart: (
        <MetricLineChart
          points={kneePoints}
          range={{ min: -0.15, max: -0.05, domain: [-0.45, 0.25] }}
          label="Knee-to-toe offset"
          accent="#f59e0b"
          savedValue={kneeSaved}
        />
      ),
    },
    {
      title: "Hip Position",
      helper: "Target offset -0.30--0.14",
      metricKey: "hipForwardRatioSide",
      valueLabel: "Offset",
      value: formatMetric(getSummaryValue(hipPoints, hipSaved), 3),
      accent: "#14b8a6",
      explanation:
        "Shows hip position relative to the ankle. The target range encourages a loaded hip instead of pushing the body forward.",
      advice:
        "Keep the hips back, stay in an athletic stance, and avoid sticking the stomach forward while dribbling.",
      chart: (
        <MetricLineChart
          points={hipPoints}
          range={{ min: -0.3, max: -0.14, domain: [-0.55, 0.25] }}
          label="Hip offset"
          accent="#14b8a6"
          savedValue={hipSaved}
        />
      ),
    },
    {
      title: "Trunk Lean",
      helper: "Target angle 15-35 deg",
      metricKey: "trunkLeanDegSide",
      valueLabel: "Deg",
      value: formatMetric(getSummaryValue(trunkPoints, trunkSaved), 1),
      accent: "#f472b6",
      explanation:
        "Shows how much the body leans forward. The target keeps the child low and ready without collapsing over the ball.",
      advice:
        "Lean from the hips, keep the chest steady, and avoid bouncing between upright and folded positions.",
      chart: (
        <MetricLineChart
          points={trunkPoints}
          range={{ min: 15, max: 35, domain: [0, 65] }}
          label="Trunk lean"
          accent="#f472b6"
          savedValue={trunkSaved}
        />
      ),
    },
    {
      title: "Hand Reach Control",
      helper: "Target range 0.12-0.40",
      metricKey: "handForwardOffsetSide",
      valueLabel: "Offset",
      value: formatMetric(getSummaryValue(handPoints, handSaved), 2),
      accent: "#38bdf8",
      explanation:
        "Shows how far the hand reaches forward from the shoulder. The target keeps the dribble slightly in front without overextending.",
      advice:
        "Place the bounce just in front of the body, keep the arm relaxed, and avoid chasing the ball forward.",
      chart: (
        <MetricLineChart
          points={handPoints}
          range={{ min: 0.12, max: 0.4, domain: [-0.2, 0.8] }}
          label="Hand forward offset"
          accent="#38bdf8"
          savedValue={handSaved}
        />
      ),
    },
    {
      title: "Landing Spot",
      helper: "Target offset 0.13-0.43",
      metricKey: "wristToToeForwardOffsetSide",
      valueLabel: "Offset",
      value: formatMetric(getSummaryValue(spotPoints, spotSaved), 2),
      accent: "#60a5fa",
      explanation:
        "Shows the ball landing point relative to the toe. The target means the bounce lands slightly in front of the foot.",
      advice:
        "Aim the bounce one to two ball lengths in front of the toes, then keep that spot steady before increasing speed.",
      chart: (
        <MetricLineChart
          points={spotPoints}
          range={{ min: 0.13, max: 0.43, domain: [-0.2, 0.8] }}
          label="Landing offset"
          accent="#60a5fa"
          savedValue={spotSaved}
        />
      ),
    },
    {
      title: "Dribble Height",
      helper: "Target range 0.40-0.68",
      metricKey: "wristHeightRatioToHip",
      valueLabel: "Ratio",
      value: formatMetric(getSummaryValue(heightPoints, heightSaved), 2),
      accent: "#22c55e",
      explanation:
        "Shows ball height relative to the body. The target keeps the one-hand dribble between knee and hip height.",
      advice:
        "Keep the bounce controlled between the knee and hip, push with the wrist, and avoid letting the ball rise above the hip.",
      chart: (
        <MetricLineChart
          points={heightPoints}
          range={{ min: 0.4, max: 0.68, domain: [-0.3, 1] }}
          label="Height ratio"
          accent="#22c55e"
          savedValue={heightSaved}
        />
      ),
    },
    {
      title: "Spot Consistency",
      helper: "Lower variation is better",
      metricKey: "stdWristToToeForwardOffsetPerCycle",
      valueLabel: "Variation",
      value: formatMetric(spotConsistencySaved, 3),
      accent: "#a78bfa",
      explanation:
        "Tracks whether the forward landing spot stays fixed. Smaller bars mean the ball is landing in the same place each bounce.",
      advice:
        "Practice slowly until the bounce lands on the same spot, then add speed while keeping the foot and wrist path quiet.",
      chart: (
        <VariationBarChart
          points={spotConsistencyPoints}
          savedValue={spotConsistencySaved}
          range={{ min: 0, max: 0.09, domain: [0, 0.16] }}
          target={0.05}
          label="Spot variation"
          accent="#a78bfa"
        />
      ),
    },
    {
      title: "Height Consistency",
      helper: "Lower variation is better",
      metricKey: "stdWristHeightRatioToHipPerCycle",
      valueLabel: "Variation",
      value: formatMetric(heightConsistencySaved, 3),
      accent: "#2f9e68",
      explanation:
        "Tracks whether the one-hand dribble keeps a consistent bounce height. Stable height helps control the ball at speed.",
      advice:
        "Keep the wrist rhythm even, stay low through the legs, and avoid sudden high bounces when tired.",
      chart: (
        <VariationBarChart
          points={heightConsistencyPoints}
          savedValue={heightConsistencySaved}
          range={{ min: 0, max: 0.065, domain: [0, 0.14] }}
          target={0.04}
          label="Height variation"
          accent="#2f9e68"
        />
      ),
    },
  ];

  return (
    <TemplatePerformanceCard
      timeline={timeline}
      subtitle="Side one-hand one-side dribble"
      charts={charts}
    />
  );
}

function makeLineChartItem({
  title,
  helper,
  metricKey,
  valueLabel,
  points,
  savedValue,
  decimals = 2,
  range,
  target,
  label,
  accent,
  explanation,
  advice,
}: {
  title: string;
  helper: string;
  metricKey: string;
  valueLabel: string;
  points: ChartPoint[];
  savedValue: number | null;
  decimals?: number;
  range: MetricRange;
  target?: number;
  label: string;
  accent: string;
  explanation: string;
  advice: string;
}): PerformanceChartItem {
  return {
    title,
    helper,
    metricKey,
    valueLabel,
    value: formatMetric(getSummaryValue(points, savedValue), decimals),
    accent,
    explanation,
    advice,
    chart: (
      <MetricLineChart
        points={points}
        range={range}
        target={target}
        label={label}
        accent={accent}
        savedValue={savedValue}
      />
    ),
  };
}

function makeVariationChartItem({
  title,
  helper,
  metricKey,
  valueLabel = "Variation",
  points,
  savedValue,
  range,
  target,
  label,
  accent,
  explanation,
  advice,
}: {
  title: string;
  helper: string;
  metricKey: string;
  valueLabel?: string;
  points: ChartPoint[];
  savedValue: number | null;
  range: MetricRange;
  target: number;
  label: string;
  accent: string;
  explanation: string;
  advice: string;
}): PerformanceChartItem {
  return {
    title,
    helper,
    metricKey,
    valueLabel,
    value: formatMetric(savedValue, 3),
    accent,
    explanation,
    advice,
    chart: (
      <VariationBarChart
        points={points}
        savedValue={savedValue}
        range={range}
        target={target}
        label={label}
        accent={accent}
      />
    ),
  };
}

function HighKneesPerformanceCard({
  timeline,
  savedMetrics,
}: {
  timeline: FrameSample[] | null | undefined;
  savedMetrics?: AngleData[] | null;
}) {
  const torsoSaved = getSavedMetric(savedMetrics, "torsoLeanDegSide");
  const footStrikeSaved = getSavedMetric(savedMetrics, "footStrikeOffsetXUnderHip");
  const kneeHeightSaved = getSavedMetric(savedMetrics, "kneeToHipHeightRatioSide");
  const heightStdSaved = getSavedMetric(savedMetrics, "stdKneeToHipHeightRatioSide");
  const rhythmSaved = getSavedMetric(savedMetrics, "stepIntervalCV");

  const torsoPoints = chooseClosestSeries(
    timeline,
    ["torsoLeanDegSide", "trunkLeanDegSide"],
    torsoSaved
  );
  const footStrikePoints = buildSeries(timeline, "footStrikeOffsetXUnderHip");
  const kneeHeightPoints = buildSeries(timeline, "kneeToHipHeightRatioSide");
  const kneeEvents = detectTimelineEvents(kneeHeightPoints, "max", 0.5, 0.25);
  const rhythmPoints = buildEventCvSeries(kneeEvents);
  const heightStdPoints = buildRollingStd(kneeHeightPoints, 12);

  const charts: PerformanceChartItem[] = [
    makeLineChartItem({
      title: "Torso Upright",
      helper: "Target angle -12-12 deg",
      metricKey: "torsoLeanDegSide",
      valueLabel: "Deg",
      points: torsoPoints,
      savedValue: torsoSaved,
      decimals: 1,
      range: { min: -12, max: 12, domain: [-35, 35] },
      label: "Torso lean",
      accent: "#38bdf8",
      explanation:
        "Shows whether the torso stays upright during high knees. Less forward or backward sway keeps the drill quick and balanced.",
      advice:
        "Stand tall, brace the core, and lift the knees without bending at the waist.",
    }),
    makeLineChartItem({
      title: "Landing Position",
      helper: "Target offset -0.10-0.10",
      metricKey: "footStrikeOffsetXUnderHip",
      valueLabel: "Offset",
      points: footStrikePoints,
      savedValue: footStrikeSaved,
      decimals: 2,
      range: { min: -0.1, max: 0.1, domain: [-0.5, 0.5] },
      label: "Foot strike offset",
      accent: "#60a5fa",
      explanation:
        "Shows where the foot lands relative to the hip. The target band means the foot is landing under the body instead of reaching forward.",
      advice:
        "Land under the hips, keep steps light, and avoid throwing the leg forward.",
    }),
    makeLineChartItem({
      title: "Knee Height",
      helper: "Target ratio 0.80-1.20",
      metricKey: "kneeToHipHeightRatioSide",
      valueLabel: "Ratio",
      points: kneeHeightPoints,
      savedValue: kneeHeightSaved,
      decimals: 2,
      range: { min: 0.8, max: 1.2, domain: [0, 1.3] },
      label: "Knee height ratio",
      accent: "#22c55e",
      explanation:
        "Shows how high the knee rises relative to the hip. Reaching the target band means the thigh is lifting close to hip height.",
      advice:
        "Drive the knee up with a tall chest, keep the ankle active, and avoid small low steps.",
    }),
    makeVariationChartItem({
      title: "Height Consistency",
      helper: "Target variation 0.20-0.40",
      metricKey: "stdKneeToHipHeightRatioSide",
      points: heightStdPoints,
      savedValue: heightStdSaved,
      range: { min: 0.2, max: 0.4, domain: [0, 0.7] },
      target: 0.3,
      label: "Height variation",
      accent: "#a78bfa",
      explanation:
        "Tracks whether knee height stays consistent across reps. The child should keep both legs lifting to a similar height.",
      advice:
        "Match left and right knee height, keep the torso tall, and hold form even when tired.",
    }),
    makeVariationChartItem({
      title: "Rhythm Stability",
      helper: "Keep an even step rhythm",
      metricKey: "stepIntervalCV",
      points: rhythmPoints,
      savedValue: rhythmSaved,
      range: { min: 0.1, max: 0.3, domain: [0, 0.6] },
      target: 0.2,
      label: "Rhythm change",
      accent: "#2f9e68",
      explanation:
        "Shows whether the time between steps stays even. A lower change means the left and right steps follow a steadier beat.",
      advice:
        "Use a steady count, land lightly, and avoid speeding up and slowing down between steps.",
    }),
  ];

  return (
    <TemplatePerformanceCard
      timeline={timeline}
      subtitle="Side high knees in place"
      charts={charts}
    />
  );
}

function PushupPlankPerformanceCard({
  timeline,
  savedMetrics,
}: {
  timeline: FrameSample[] | null | undefined;
  savedMetrics?: AngleData[] | null;
}) {
  const bodyLineSaved = getSavedMetric(savedMetrics, "plankBodyLineDeg");
  const elbowSaved = getSavedMetric(savedMetrics, "avgElbowAngleDeg");
  const stabilitySaved = getSavedMetric(savedMetrics, "stdPlankBodyLineDeg");

  const bodyLinePoints = chooseClosestSeries(
    timeline,
    ["plankBodyLineDeg", "bodyLineDeg"],
    bodyLineSaved
  );
  const elbowPoints = chooseClosestSeries(
    timeline,
    ["avgElbowAngleDeg", "elbowAngleDeg", "rightElbowAngleDeg", "leftElbowAngleDeg"],
    elbowSaved
  );
  const bodyLineRange = buildRangeFromTemplateMetric(
    TRAINING_PUSHUP_PLANK_TEMPLATE_ID,
    "plankBodyLineDeg",
    { min: 164, max: 180, domain: [120, 200] }
  );
  const elbowRange = buildRangeFromTemplateMetric(
    TRAINING_PUSHUP_PLANK_TEMPLATE_ID,
    "avgElbowAngleDeg",
    { min: 75, max: 95, domain: [40, 130] }
  );
  const stabilityRange = buildRangeFromTemplateMetric(
    TRAINING_PUSHUP_PLANK_TEMPLATE_ID,
    "stdPlankBodyLineDeg",
    { min: 1, max: 5, domain: [0, 10] }
  );
  const stabilityConfig = getTemplateMetricConfig(
    TRAINING_PUSHUP_PLANK_TEMPLATE_ID,
    "stdPlankBodyLineDeg"
  );
  const stabilityTarget =
    typeof stabilityConfig?.params.target === "number" ? stabilityConfig.params.target : 3;
  const stabilityPoints = buildRollingStd(bodyLinePoints, 12);

  const charts: PerformanceChartItem[] = [
    makeLineChartItem({
      title: "Body Line",
      helper: `Target angle ${formatRangeText(bodyLineRange, 0)} deg`,
      metricKey: "plankBodyLineDeg",
      valueLabel: "Deg",
      points: bodyLinePoints,
      savedValue: bodyLineSaved,
      decimals: 1,
      range: bodyLineRange,
      label: "Body line angle",
      accent: "#38bdf8",
      explanation:
        "Shows whether shoulders, hips, and ankles stay in one line. The target band avoids sagging hips or piking up.",
      advice:
        "Squeeze the glutes, brace the core, and keep the body long from shoulders to ankles.",
    }),
    makeLineChartItem({
      title: "Support Elbow Angle",
      helper: `Target angle ${formatRangeText(elbowRange, 0)} deg`,
      metricKey: "avgElbowAngleDeg",
      valueLabel: "Deg",
      points: elbowPoints,
      savedValue: elbowSaved,
      decimals: 1,
      range: elbowRange,
      label: "Elbow angle",
      accent: "#a78bfa",
      explanation:
        "Shows whether the support elbow stays close to a right angle, so the shoulder can remain above the elbow.",
      advice:
        "Place the elbow directly below the shoulder, keep the forearm on the floor, and press the floor away.",
    }),
    makeVariationChartItem({
      title: "Body Stability",
      helper: `Target variation ${formatRangeText(stabilityRange, 1)} deg`,
      metricKey: "stdPlankBodyLineDeg",
      points: stabilityPoints,
      savedValue: stabilitySaved,
      range: stabilityRange,
      target: stabilityTarget,
      label: "Body line variation",
      accent: "#2f9e68",
      explanation:
        "Tracks how much the body line wobbles during the hold. Smaller, steady bars mean the core is controlling the posture.",
      advice:
        "Breathe steadily, keep the ribs tucked, and avoid shaking the hips up and down.",
    }),
  ];

  return (
    <TemplatePerformanceCard
      timeline={timeline}
      subtitle="Side forearm plank"
      charts={charts}
    />
  );
}

function WallSitPerformanceCard({
  timeline,
  savedMetrics,
  variant,
}: {
  timeline: FrameSample[] | null | undefined;
  savedMetrics?: AngleData[] | null;
  variant: "half" | "quarter";
}) {
  const isHalf = variant === "half";
  const kneeTarget = isHalf ? 90 : 135;
  const kneeMin = kneeTarget - 10;
  const kneeMax = kneeTarget + 10;
  const kneeSafeMin = isHalf ? -0.05 : -0.1;
  const kneeSafeMax = isHalf ? 0.08 : 0.05;
  const stabilityTarget = isHalf ? 3 : 3.5;
  const stabilityMin = isHalf ? 1 : 1;
  const stabilityMax = isHalf ? 5 : 6;

  const kneeSaved = getSavedMetric(savedMetrics, "avgKneeAngleDeg");
  const trunkSaved = getSavedMetric(savedMetrics, "trunkLeanDegSide");
  const kneePositionSaved = getSavedMetric(savedMetrics, "kneeOverToeOffsetXSide");
  const stabilitySaved = getSavedMetric(savedMetrics, "stdKneeAngleDeg");

  const kneePoints = chooseClosestSeries(timeline, ["avgKneeAngleDeg", "kneeAngleDeg"], kneeSaved);
  const trunkPoints = buildSeries(timeline, "trunkLeanDegSide");
  const kneePositionPoints = buildSeries(timeline, "kneeOverToeOffsetXSide");
  const stabilityPoints = buildRollingStd(kneePoints, 12);

  const charts: PerformanceChartItem[] = [
    makeLineChartItem({
      title: isHalf ? "Knee Angle 90" : "Knee Angle 135",
      helper: `Target angle ${kneeMin}-${kneeMax} deg`,
      metricKey: "avgKneeAngleDeg",
      valueLabel: "Deg",
      points: kneePoints,
      savedValue: kneeSaved,
      decimals: 1,
      range: { min: kneeMin, max: kneeMax, domain: [60, 170] },
      label: "Knee angle",
      accent: "#38bdf8",
      explanation: isHalf
        ? "Shows whether the knees stay near a right angle. This is the main depth check for a standard wall sit."
        : "Shows whether the knees stay near a shallow quarter-sit angle. This keeps the drill lighter while still controlled.",
      advice: isHalf
        ? "Slide down until the thighs are close to parallel, keep the knees steady, and avoid rising up during the hold."
        : "Hold the shallow bend steadily, keep the feet planted, and avoid sinking too deep for this version.",
    }),
    makeLineChartItem({
      title: "Trunk Vertical",
      helper: "Target angle -5-5 deg",
      metricKey: "trunkLeanDegSide",
      valueLabel: "Deg",
      points: trunkPoints,
      savedValue: trunkSaved,
      decimals: 1,
      range: { min: -5, max: 5, domain: [-25, 25] },
      label: "Trunk lean",
      accent: "#60a5fa",
      explanation:
        "Shows whether the upper body stays vertical against the wall. The target band means the back is not leaning away.",
      advice:
        "Keep the back tall against the wall, ribs down, and avoid folding forward as the legs fatigue.",
    }),
    makeLineChartItem({
      title: "Knee Position",
      helper: `Target offset ${kneeSafeMin}-${kneeSafeMax}`,
      metricKey: "kneeOverToeOffsetXSide",
      valueLabel: "Offset",
      points: kneePositionPoints,
      savedValue: kneePositionSaved,
      decimals: 3,
      range: { min: kneeSafeMin, max: kneeSafeMax, domain: [-0.35, 0.35] },
      label: "Knee-to-toe offset",
      accent: "#f59e0b",
      explanation:
        "Shows the knee position relative to the toes. Staying in the band keeps pressure controlled and the feet placed correctly.",
      advice:
        "Adjust the feet so the knees stay calm over the toes, then keep the lower legs still during the hold.",
    }),
    makeVariationChartItem({
      title: "Depth Stability",
      helper: `Target variation ${stabilityMin.toFixed(1)}-${stabilityMax.toFixed(1)} deg`,
      metricKey: "stdKneeAngleDeg",
      points: stabilityPoints,
      savedValue: stabilitySaved,
      range: { min: stabilityMin, max: stabilityMax, domain: [0, 12] },
      target: stabilityTarget,
      label: "Knee angle variation",
      accent: "#2f9e68",
      explanation:
        "Tracks whether the wall-sit depth is wobbling. Smaller variation means the child is not sliding up and down.",
      advice:
        "Press the back into the wall, keep both feet grounded, and hold the same knee bend until the set ends.",
    }),
  ];

  return (
    <TemplatePerformanceCard
      timeline={timeline}
      subtitle={isHalf ? "Side wall sit half hold" : "Side wall sit quarter hold"}
      charts={charts}
    />
  );
}

function DeepSquatPerformanceCard({
  timeline,
  savedMetrics,
}: {
  timeline: FrameSample[] | null | undefined;
  savedMetrics?: AngleData[] | null;
}) {
  const trunkSaved = getSavedMetric(savedMetrics, "trunkLeanDegSide");
  const kneeTravelSaved = getSavedMetric(savedMetrics, "kneeOverToeOffsetXSide");
  const depthSaved = getSavedMetric(savedMetrics, "hipBelowKneeRatioSide");
  const topKneeSaved = getSavedMetric(savedMetrics, "topKneeAngleDeg");
  const depthStdSaved = getSavedMetric(savedMetrics, "stdHipBelowKneeRatioSidePerRep");
  const trunkStdSaved = getSavedMetric(savedMetrics, "stdTrunkLeanDegSidePerRep");

  const trunkPoints = buildSeries(timeline, "trunkLeanDegSide");
  const kneeTravelPoints = buildSeries(timeline, "kneeOverToeOffsetXSide");
  const depthPoints = buildSeries(timeline, "hipBelowKneeRatioSide");
  const kneeAnglePoints = chooseClosestSeries(
    timeline,
    ["avgKneeAngleDeg", "kneeAngleDeg", "topKneeAngleDeg"],
    topKneeSaved
  );
  const depthStdPoints = buildRollingStd(depthPoints, 12);
  const trunkStdPoints = buildRollingStd(trunkPoints, 12);
  const depthRange = buildRangeFromTemplateMetric(
    TRAINING_DEEP_SQUAT_TEMPLATE_ID,
    "hipBelowKneeRatioSide",
    { min: 0, max: 0.1, domain: [-0.25, 0.45] }
  );

  const charts: PerformanceChartItem[] = [
    makeLineChartItem({
      title: "Trunk Lean",
      helper: "Target range 0-45 deg",
      metricKey: "trunkLeanDegSide",
      valueLabel: "Deg",
      points: trunkPoints,
      savedValue: trunkSaved,
      decimals: 1,
      range: { min: 0, max: 45, domain: [0, 70] },
      label: "Trunk lean",
      accent: "#38bdf8",
      explanation:
        "Shows how much the torso leans during the squat. The target band allows a natural hinge without collapsing forward.",
      advice:
        "Keep the chest proud, brace the core, and let the hips sit back before the knees travel forward.",
    }),
    makeLineChartItem({
      title: "Knee Travel",
      helper: "Target offset -0.05-0.15",
      metricKey: "kneeOverToeOffsetXSide",
      valueLabel: "Offset",
      points: kneeTravelPoints,
      savedValue: kneeTravelSaved,
      decimals: 3,
      range: { min: -0.05, max: 0.15, domain: [-0.4, 0.45] },
      label: "Knee travel",
      accent: "#60a5fa",
      explanation:
        "Shows knee travel relative to the toe at the bottom of the squat. Controlled travel keeps balance over the feet.",
      advice:
        "Start by sending the hips back, then bend the knees without letting them rush far past the toes.",
    }),
    makeLineChartItem({
      title: "Squat Depth",
      helper: `Target ratio ${formatRangeText(depthRange, 2)}`,
      metricKey: "hipBelowKneeRatioSide",
      valueLabel: "Ratio",
      points: depthPoints,
      savedValue: depthSaved,
      decimals: 3,
      range: depthRange,
      label: "Hip below knee ratio",
      accent: "#22c55e",
      explanation:
        "Shows whether the hips reach knee level or slightly below. The target band marks a deep enough squat.",
      advice:
        "Sit down until the hips reach the knee line, keep heels grounded, and avoid cutting reps short.",
    }),
    makeLineChartItem({
      title: "Full Extension",
      helper: "Target angle 165-185 deg",
      metricKey: "topKneeAngleDeg",
      valueLabel: "Deg",
      points: kneeAnglePoints,
      savedValue: topKneeSaved,
      decimals: 1,
      range: { min: 165, max: 185, domain: [70, 190] },
      label: "Knee angle",
      accent: "#f59e0b",
      explanation:
        "Shows whether the knees straighten at the top. Full extension confirms each rep returns to the starting position.",
      advice:
        "Stand tall between reps, finish the hips and knees, then start the next squat under control.",
    }),
    makeVariationChartItem({
      title: "Depth Consistency",
      helper: "Target variation 0.01-0.05",
      metricKey: "stdHipBelowKneeRatioSidePerRep",
      points: depthStdPoints,
      savedValue: depthStdSaved,
      range: { min: 0.01, max: 0.05, domain: [0, 0.12] },
      target: 0.03,
      label: "Depth variation",
      accent: "#14b8a6",
      explanation:
        "Tracks whether each squat reaches a similar depth. Consistent depth shows the child is not cutting later reps short.",
      advice:
        "Use the same bottom position every rep, keep the heels down, and slow the tempo if depth starts changing.",
    }),
    makeVariationChartItem({
      title: "Form Consistency",
      helper: "Target variation 2-6 deg",
      metricKey: "stdTrunkLeanDegSidePerRep",
      points: trunkStdPoints,
      savedValue: trunkStdSaved,
      range: { min: 2, max: 6, domain: [0, 14] },
      target: 4,
      label: "Trunk variation",
      accent: "#2f9e68",
      explanation:
        "Tracks whether torso angle changes from rep to rep. Stable form means the same squat pattern is being repeated.",
      advice:
        "Keep the brace and chest angle consistent, especially as the set gets harder.",
    }),
  ];

  return (
    <TemplatePerformanceCard
      timeline={timeline}
      subtitle="Side deep squat reps"
      charts={charts}
    />
  );
}

const TRAINING_CHART_ACCENTS = [
  "#38bdf8",
  "#60a5fa",
  "#22c55e",
  "#f59e0b",
  "#a78bfa",
  "#14b8a6",
];

function DataDrivenTrainingPerformanceCard({
  timeline,
  template,
  savedMetrics,
  scoringContext,
}: {
  timeline: FrameSample[] | null | undefined;
  template: ActionTemplate;
  savedMetrics?: AngleData[] | null;
  scoringContext?: Record<string, unknown>;
}) {
  if (template.mode !== "training") return null;

  const chartModels = buildTrainingMetricChartModels(
    template,
    savedMetrics,
    timeline,
    scoringContext,
  );
  const charts = chartModels.map(({ metric, points, savedValue, summaryValue, scoreBand }, index) => {
      const range = buildRangeFromMetric(summaryValue, scoreBand);
      const accent = TRAINING_CHART_ACCENTS[index % TRAINING_CHART_ACCENTS.length];
      return makeLineChartItem({
        title:
          metric.displayName ??
          metric.metricId.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
        helper: metric.targetText ?? "Move inside the highlighted target zone.",
        metricKey: metric.computeKey,
        valueLabel: getMetricValueLabel(metric),
        points,
        savedValue,
        decimals: metric.precision ?? (metric.unit === "deg" ? 1 : 3),
        range,
        target: scoreBand?.kind === "target" ? scoreBand.target : undefined,
        label: metric.displayName ?? "Movement result",
        accent,
        explanation: metric.targetText ?? "This check compares the movement with the target zone.",
        advice: getMetricAdvice(metric, summaryValue, range),
      });
    });

  if (charts.length === 0) return null;

  return (
    <TemplatePerformanceCard
      timeline={timeline}
      subtitle={`${template.displayName} - ${template.camera === "front" ? "Front view" : "Side view"}`}
      charts={charts}
    />
  );
}

function TrainingPerformanceCard({
  timeline,
  templateId,
  template,
  savedMetrics,
  scoringContext,
}: {
  timeline: FrameSample[] | null | undefined;
  templateId: string;
  template?: ActionTemplate | null;
  savedMetrics?: AngleData[] | null;
  scoringContext?: Record<string, unknown>;
}) {
  if (template?.mode === "training") {
    return (
      <DataDrivenTrainingPerformanceCard
        timeline={timeline}
        template={template}
        savedMetrics={savedMetrics}
        scoringContext={scoringContext}
      />
    );
  }

  if (templateId === TRAINING_HIGH_KNEES_TEMPLATE_ID) {
    return <HighKneesPerformanceCard timeline={timeline} savedMetrics={savedMetrics} />;
  }

  if (templateId === TRAINING_PUSHUP_PLANK_TEMPLATE_ID) {
    return <PushupPlankPerformanceCard timeline={timeline} savedMetrics={savedMetrics} />;
  }

  if (templateId === TRAINING_WALL_SIT_HALF_TEMPLATE_ID) {
    return <WallSitPerformanceCard timeline={timeline} savedMetrics={savedMetrics} variant="half" />;
  }

  if (templateId === TRAINING_WALL_SIT_QUARTER_TEMPLATE_ID) {
    return (
      <WallSitPerformanceCard timeline={timeline} savedMetrics={savedMetrics} variant="quarter" />
    );
  }

  if (templateId === TRAINING_DEEP_SQUAT_TEMPLATE_ID) {
    return <DeepSquatPerformanceCard timeline={timeline} savedMetrics={savedMetrics} />;
  }

  return (
    <DataDrivenTrainingPerformanceCard
      timeline={timeline}
      template={getTemplateById(templateId) as ActionTemplate}
      savedMetrics={savedMetrics}
      scoringContext={scoringContext}
    />
  );
}

function GenericMetricTimelineCard({ timeline }: { timeline: FrameSample[] | null | undefined }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const availableMetrics = useMemo(() => {
    if (!timeline || timeline.length === 0) return [];

    const firstFrameAngles = timeline[0].angles;
    const keys = firstFrameAngles.map((angle) => angle.name);
    return keys.filter((key) => GENERIC_METRIC_CONFIG[key]);
  }, [timeline]);

  const activeKey = availableMetrics[currentIndex] || "";
  const config = GENERIC_METRIC_CONFIG[activeKey];

  const chartData = useMemo(() => {
    if (!timeline) return [];

    return timeline
      .filter((_, index) => index % 3 === 0)
      .map((frame) => {
        const metric = frame.angles.find((angle) => angle.name === activeKey);
        return {
          time: frame.time.toFixed(1),
          value: metric ? metric.value : 0,
        };
      });
  }, [timeline, activeKey]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % availableMetrics.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + availableMetrics.length) % availableMetrics.length);
  };

  if (availableMetrics.length === 0) return null;

  return (
    <Card className="overflow-hidden border-slate-800 bg-slate-900/50 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/50 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-slate-300">
          <Activity className="h-4 w-4 text-sky-500" />
          Performance Curves
        </CardTitle>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-slate-400 hover:text-white"
            onClick={handlePrev}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-mono text-xs text-slate-500">
            {currentIndex + 1} / {availableMetrics.length}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-slate-400 hover:text-white"
            onClick={handleNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <div className="flex flex-col gap-6 md:flex-row">
          <div className="h-[200px] min-w-0 flex-1">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis
                  dataKey="time"
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={30}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  domain={config.domain || ["auto", "auto"]}
                  hide
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: config.color }}
                  labelStyle={tooltipLabelStyle}
                  formatter={(value: number | string) => [Number(value).toFixed(2), config.label]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={config.color}
                  strokeWidth={2}
                  dot={chartData.length <= 80 ? { r: 1.2, strokeWidth: 0, fill: config.color } : false}
                  activeDot={{ r: 3.5, fill: config.color, stroke: "#f8fafc", strokeWidth: 1 }}
                  animationDuration={500}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col justify-center space-y-3 rounded-xl border border-slate-800/50 bg-slate-950/30 p-4 md:w-1/3">
            <div>
              <h4 className="flex items-center gap-2 text-lg font-bold text-white">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                {config.label}
              </h4>
            </div>

            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
              <p className="text-sm leading-relaxed text-slate-300">{config.desc}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MetricTimelineCard({
  timeline,
  templateId,
  template,
  savedMetrics,
  scoringContext,
}: Props) {
  if (templateId === HIP_HIGH_TEMPLATE_ID) {
    return <HipHighPerformanceCard timeline={timeline} savedMetrics={savedMetrics} />;
  }

  if (templateId === FRONT_NARROW_CROSSOVER_TEMPLATE_ID) {
    return <FrontNarrowCrossoverPerformanceCard timeline={timeline} savedMetrics={savedMetrics} />;
  }

  if (templateId === FRONT_ONEHAND_V_TEMPLATE_ID) {
    return <FrontOneHandVPerformanceCard timeline={timeline} savedMetrics={savedMetrics} />;
  }

  if (templateId === SIDE_NARROW_CROSSOVER_TEMPLATE_ID) {
    return <SideNarrowCrossoverPerformanceCard timeline={timeline} savedMetrics={savedMetrics} />;
  }

  if (templateId === SIDE_ONEHAND_ONESIDE_TEMPLATE_ID) {
    return <SideOneHandOneSidePerformanceCard timeline={timeline} savedMetrics={savedMetrics} />;
  }

  if (getTemplateById(templateId)?.mode === "training") {
    return (
      <TrainingPerformanceCard
        timeline={timeline}
        templateId={templateId}
        template={template}
        savedMetrics={savedMetrics}
        scoringContext={scoringContext}
      />
    );
  }

  return <GenericMetricTimelineCard timeline={timeline} />;
}
