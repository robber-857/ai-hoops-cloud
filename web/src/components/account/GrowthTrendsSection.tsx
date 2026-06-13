"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

import type {
  AccountAnalysisType,
  ReportSource,
  TrendPoint,
  TrendPointsByType,
} from "./types";

type GrowthTrendsSectionProps = {
  pointsByType: TrendPointsByType;
  source: ReportSource;
};

type TrendConfig = {
  type: AccountAnalysisType;
  title: string;
  helper: string;
  accent: string;
  accentSoft: string;
  gradientId: string;
};

type TrendRangeKey = "7d" | "30d";

type TrendRangeOption = {
  key: TrendRangeKey;
  label: string;
  shortLabel: string;
  dayCount: number;
  stepDays: number;
};

type RangeDay = {
  date: Date;
  dateKey: string;
  weekdayLabel: string;
  monthLabel: string;
  dayLabel: string;
  fullLabel: string;
};

type RangePoint = RangeDay & {
  point: TrendPoint | null;
  score: number | null;
  x: number;
  y: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const CHART_LEFT = 8;
const CHART_RIGHT = 96;
const CHART_TOP = 8;
const CHART_BOTTOM = 72;
const SCORE_LINES = [100, 75, 50, 25, 0];

const TREND_RANGE_OPTIONS: TrendRangeOption[] = [
  { key: "7d", label: "7 days", shortLabel: "7D", dayCount: 7, stepDays: 7 },
  { key: "30d", label: "30 days", shortLabel: "30D", dayCount: 30, stepDays: 30 },
];

const TREND_CONFIGS: TrendConfig[] = [
  {
    type: "shooting",
    title: "Shooting",
    helper: "Daily shooting report score",
    accent: "#d8ff5d",
    accentSoft: "rgba(216,255,93,0.16)",
    gradientId: "growth-shooting-bar",
  },
  {
    type: "dribbling",
    title: "Dribbling",
    helper: "Daily dribbling report score",
    accent: "#65f7ff",
    accentSoft: "rgba(101,247,255,0.16)",
    gradientId: "growth-dribbling-bar",
  },
  {
    type: "training",
    title: "Training",
    helper: "Daily training report score",
    accent: "#c4b5fd",
    accentSoft: "rgba(196,181,253,0.16)",
    gradientId: "growth-training-bar",
  },
];

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

function scoreToY(score: number): number {
  return CHART_BOTTOM - (clampScore(score) / 100) * (CHART_BOTTOM - CHART_TOP);
}

function dayCenterToX(index: number, dayCount: number): number {
  return CHART_LEFT + ((index + 0.5) / dayCount) * (CHART_RIGHT - CHART_LEFT);
}

function dayBoundaryToX(index: number, dayCount: number): number {
  return CHART_LEFT + (index / dayCount) * (CHART_RIGHT - CHART_LEFT);
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatFullDate(date: Date): string {
  return new Intl.DateTimeFormat("en-AU", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function buildRangeDays(rangeEnd: Date, dayCount: number): RangeDay[] {
  const rangeStart = addDays(rangeEnd, 1 - dayCount);
  return Array.from({ length: dayCount }, (_, index) => {
    const date = addDays(rangeStart, index);
    return {
      date,
      dateKey: toDateKey(date),
      weekdayLabel: new Intl.DateTimeFormat("en-AU", { weekday: "short" }).format(date),
      monthLabel: new Intl.DateTimeFormat("en-AU", { month: "short" }).format(date),
      dayLabel: new Intl.DateTimeFormat("en-AU", { day: "numeric" }).format(date),
      fullLabel: formatFullDate(date),
    };
  });
}

function buildLinePath(points: RangePoint[]): string {
  return points
    .filter((point) => point.score !== null && point.y !== null)
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function buildAreaPath(points: RangePoint[]): string {
  const scoredPoints = points.filter((point) => point.score !== null && point.y !== null);
  if (scoredPoints.length < 2) {
    return "";
  }

  const firstPoint = scoredPoints[0];
  const lastPoint = scoredPoints[scoredPoints.length - 1];
  return `${buildLinePath(scoredPoints)} L ${lastPoint.x} ${CHART_BOTTOM} L ${firstPoint.x} ${CHART_BOTTOM} Z`;
}

function scoreDeltaLabel(first: RangePoint | null, latest: RangePoint | null): string {
  if (!first || !latest || first === latest || first.score === null || latest.score === null) {
    return "--";
  }

  const delta = Math.round(latest.score - first.score);
  if (delta === 0) return "Flat";
  return `${delta > 0 ? "+" : ""}${delta}`;
}

function getLatestDataDay(pointsByType: TrendPointsByType): Date {
  const latestDate = TREND_CONFIGS.flatMap((config) => pointsByType[config.type])
    .map((point) => parseDateKey(point.dateKey))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => right.getTime() - left.getTime())[0];

  return latestDate ?? startOfLocalDay(new Date());
}

function shouldShowAxisLabel(index: number, dayCount: number): boolean {
  return dayCount <= 7 || index === 0 || index === dayCount - 1 || (index + 1) % 5 === 0;
}

function axisLabelLeft(pointX: number, compactRange: boolean): string {
  const halfLabelWidth = compactRange ? "1.25rem" : "1.7rem";
  return `clamp(${halfLabelWidth}, ${pointX}%, calc(100% - ${halfLabelWidth}))`;
}

function TrendPanel({
  config,
  points,
  rangeDays,
  rangeOption,
}: {
  config: TrendConfig;
  points: TrendPoint[];
  rangeDays: RangeDay[];
  rangeOption: TrendRangeOption;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const rangePoints = useMemo<RangePoint[]>(() => {
    const byDate = new Map(points.map((point) => [point.dateKey, point]));
    return rangeDays.map((day, index) => {
      const point = byDate.get(day.dateKey) ?? null;
      const score = point ? Math.round(point.score) : null;
      return {
        ...day,
        point,
        score,
        x: dayCenterToX(index, rangeDays.length),
        y: score === null ? null : scoreToY(score),
      };
    });
  }, [points, rangeDays]);

  const scoredPoints = rangePoints.filter((point) => point.score !== null);
  const firstPoint = scoredPoints[0] ?? null;
  const latestPoint = scoredPoints[scoredPoints.length - 1] ?? null;
  const bestPoint =
    scoredPoints.length > 0
      ? scoredPoints.reduce((best, point) =>
          (point.score ?? 0) > (best.score ?? 0) ? point : best,
        )
      : null;
  const averageScore =
    scoredPoints.length > 0
      ? Math.round(
          scoredPoints.reduce((sum, point) => sum + (point.score ?? 0), 0) /
            scoredPoints.length,
        )
      : null;
  const activePoint =
    activeIndex !== null && rangePoints[activeIndex]?.score !== null
      ? rangePoints[activeIndex]
      : null;
  const linePath = buildLinePath(rangePoints);
  const areaPath = buildAreaPath(rangePoints);
  const deltaLabel = scoreDeltaLabel(firstPoint, latestPoint);
  const compactRange = rangeDays.length > 7;
  const pointRadius = compactRange ? 1.45 : 2.1;

  return (
    <article className="rounded-[24px] border border-white/10 bg-white/[0.035] p-3 sm:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: config.accent }}
            />
            <h3 className="font-[var(--font-display)] text-xl font-semibold text-white">
              {config.title}
            </h3>
          </div>
          <p className="mt-1 text-sm text-white/50">{config.helper}</p>
        </div>
        <div className="grid w-full grid-cols-3 gap-2 text-center md:max-w-sm md:text-right">
          <div className="min-w-0 rounded-2xl border border-white/8 bg-black/18 px-2 py-2 sm:px-3">
            <div className="truncate text-[0.55rem] uppercase tracking-[0.12em] text-white/38 sm:text-[0.62rem] sm:tracking-[0.16em]">
              Latest
            </div>
            <div className="mt-1 font-[var(--font-display)] text-xl font-semibold text-white sm:text-2xl">
              {latestPoint?.score ?? "--"}
            </div>
          </div>
          <div className="min-w-0 rounded-2xl border border-white/8 bg-black/18 px-2 py-2 sm:px-3">
            <div className="truncate text-[0.55rem] uppercase tracking-[0.12em] text-white/38 sm:text-[0.62rem] sm:tracking-[0.16em]">
              Best
            </div>
            <div
              className="mt-1 font-[var(--font-display)] text-xl font-semibold sm:text-2xl"
              style={{ color: config.accent }}
            >
              {bestPoint?.score ?? "--"}
            </div>
          </div>
          <div className="min-w-0 rounded-2xl border border-white/8 bg-black/18 px-2 py-2 sm:px-3">
            <div className="truncate text-[0.55rem] uppercase tracking-[0.12em] text-white/38 sm:text-[0.62rem] sm:tracking-[0.16em]">
              Change
            </div>
            <div className="mt-1 font-[var(--font-display)] text-xl font-semibold text-sky-100 sm:text-2xl">
              {deltaLabel}
            </div>
          </div>
        </div>
      </div>

      <div
        className="relative mt-4 h-[clamp(15rem,58vw,18rem)] overflow-hidden rounded-[22px] border border-white/10 bg-[#070b10] sm:h-72"
        aria-label={`${config.title} ${rangeOption.label} score trend. ${
          latestPoint ? `Latest ${latestPoint.score}.` : "No scores in this window."
        }`}
      >
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, rgba(255,255,255,0.045), transparent 40%), radial-gradient(circle at 88% 12%, ${config.accentSoft}, transparent 32%)`,
          }}
        />
        <div className="absolute bottom-[24%] left-0 top-[8%] z-10 flex w-9 flex-col justify-between pr-2 text-right text-[0.65rem] font-medium text-white/38">
          {SCORE_LINES.map((score) => (
            <span key={score}>{score}</span>
          ))}
        </div>

        <svg
          viewBox="0 0 100 86"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={config.gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={config.accent} stopOpacity="0.22" />
              <stop offset="100%" stopColor={config.accent} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {SCORE_LINES.map((score) => {
            const y = scoreToY(score);
            return (
              <line
                key={score}
                x1={CHART_LEFT}
                x2={CHART_RIGHT}
                y1={y}
                y2={y}
                stroke={score === 0 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.09)"}
                strokeWidth="0.45"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
          {Array.from({ length: rangeDays.length + 1 }, (_, index) => (
            <line
              key={`day-boundary-${index}`}
              x1={dayBoundaryToX(index, rangeDays.length)}
              x2={dayBoundaryToX(index, rangeDays.length)}
              y1={CHART_TOP}
              y2={CHART_BOTTOM}
              stroke={compactRange ? "rgba(255,255,255,0.026)" : "rgba(255,255,255,0.045)"}
              strokeWidth={compactRange ? "0.22" : "0.35"}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {rangePoints.map((point) => (
            <circle
              key={`${point.dateKey}-empty`}
              cx={point.x}
              cy={CHART_BOTTOM}
              r={compactRange ? "0.65" : "1.2"}
              fill="rgba(255,255,255,0.2)"
            />
          ))}
          {areaPath ? (
            <path d={areaPath} fill={`url(#${config.gradientId})`} opacity="0.95" />
          ) : null}
          {linePath ? (
            <path
              d={linePath}
              fill="none"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="4.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          {linePath ? (
            <path
              d={linePath}
              fill="none"
              stroke={config.accent}
              strokeWidth={compactRange ? "1.8" : "2.2"}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          {rangePoints.map((point, index) =>
            point.score !== null && point.y !== null ? (
              <circle
                key={`${point.dateKey}-point`}
                cx={point.x}
                cy={point.y}
                r={activeIndex === index ? pointRadius + 0.7 : pointRadius}
                fill={activeIndex === index ? "#ffffff" : config.accent}
                stroke="#071018"
                strokeWidth="0.8"
                vectorEffect="non-scaling-stroke"
              />
            ) : null,
          )}
        </svg>

        <div className="absolute inset-x-0 bottom-0 h-[24%] border-t border-white/8 bg-black/24">
          {rangePoints.map((point, index) =>
            shouldShowAxisLabel(index, rangeDays.length) ? (
              <div
                key={`${point.dateKey}-label`}
                className={cn(
                  "absolute top-2 -translate-x-1/2 text-center",
                  compactRange ? "w-10" : "w-[clamp(2.5rem,11vw,3.4rem)]",
                )}
                style={{ left: axisLabelLeft(point.x, compactRange) }}
                title={point.fullLabel}
              >
                <div className="truncate text-[0.58rem] uppercase tracking-[0.08em] text-white/44 sm:text-[0.62rem]">
                  {compactRange ? point.monthLabel : point.weekdayLabel}
                </div>
                <div className="mt-0.5 text-xs font-semibold tabular-nums text-white/64">
                  {point.dayLabel}
                </div>
              </div>
            ) : null,
          )}
        </div>

        {rangePoints.map((point, index) => (
          <button
            type="button"
            key={`${point.dateKey}-target`}
            aria-label={`${config.title} ${point.fullLabel}: ${
              point.score === null ? "no score" : `${point.score} score`
            }`}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-white/70",
              compactRange ? "h-8 w-6 sm:h-10 sm:w-8" : "h-11 w-11",
            )}
            style={{
              left: `${point.x}%`,
              top: `${point.y ?? CHART_BOTTOM}%`,
            }}
            onFocus={() => setActiveIndex(index)}
            onBlur={() => setActiveIndex(null)}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          />
        ))}

        {activePoint ? (
          <div
            className={cn(
              "pointer-events-none absolute z-20 w-44 rounded-xl border border-white/12 bg-[#071018]/95 px-3 py-2 text-left shadow-[0_18px_48px_rgba(0,0,0,0.42)] backdrop-blur-xl",
              activePoint.x > 72 ? "-translate-x-full" : "-translate-x-2",
              (activePoint.y ?? CHART_BOTTOM) < 28 ? "translate-y-4" : "-translate-y-full",
            )}
            style={{
              left: `${activePoint.x}%`,
              top: `${activePoint.y ?? CHART_BOTTOM}%`,
            }}
          >
            <div className="text-[0.65rem] uppercase tracking-[0.16em] text-white/54">
              {activePoint.fullLabel}
            </div>
            <div className="mt-1 font-[var(--font-display)] text-3xl font-semibold text-white">
              {activePoint.score}
            </div>
            <div className="mt-1 text-xs leading-5 text-white/54">
              {activePoint.point?.metaLabel ?? "0-100 daily score"}
            </div>
          </div>
        ) : null}

        {scoredPoints.length === 0 ? (
          <div className="absolute inset-x-10 top-1/2 -translate-y-1/2 text-center text-sm text-white/48">
            No {config.title.toLowerCase()} scores in this {rangeOption.label.toLowerCase()} window.
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/46">
        <span>{scoredPoints.length} scored days</span>
        <span className="h-1 w-1 rounded-full bg-white/26" />
        <span>
          {averageScore === null
            ? `No ${rangeOption.label.toLowerCase()} average`
            : `${averageScore} ${rangeOption.label.toLowerCase()} average`}
        </span>
        <span className="h-1 w-1 rounded-full bg-white/26" />
        <span>{bestPoint?.point?.metaLabel ?? "Daily average uses completed reports"}</span>
      </div>
    </article>
  );
}

export function GrowthTrendsSection({
  pointsByType,
}: GrowthTrendsSectionProps) {
  const [selectedRangeEndKey, setSelectedRangeEndKey] = useState<string | null>(null);
  const [activeRangeKey, setActiveRangeKey] = useState<TrendRangeKey>("7d");
  const [activeType, setActiveType] = useState<AccountAnalysisType>("shooting");
  const [hasUserSelectedType, setHasUserSelectedType] = useState(false);
  const activeRange =
    TREND_RANGE_OPTIONS.find((option) => option.key === activeRangeKey) ??
    TREND_RANGE_OPTIONS[0];
  const latestDataDay = useMemo(() => getLatestDataDay(pointsByType), [pointsByType]);
  const currentDay = useMemo(() => startOfLocalDay(new Date()), []);
  const selectedRangeEnd = selectedRangeEndKey ? parseDateKey(selectedRangeEndKey) : latestDataDay;
  const selectedRangeEndStable = startOfLocalDay(selectedRangeEnd);
  const selectedRangeEndStableKey = toDateKey(selectedRangeEndStable);
  const rangeDays = useMemo(
    () => buildRangeDays(parseDateKey(selectedRangeEndStableKey), activeRange.dayCount),
    [selectedRangeEndStableKey, activeRange.dayCount],
  );
  const rangeStart = rangeDays[0]?.date ?? selectedRangeEndStable;
  const rangeEnd = rangeDays[rangeDays.length - 1]?.date ?? selectedRangeEndStable;
  const canGoNext = selectedRangeEndStable.getTime() < currentDay.getTime();
  const rangeLabel = `${formatFullDate(rangeStart)} - ${formatFullDate(rangeEnd)}`;
  const activeConfig =
    TREND_CONFIGS.find((config) => config.type === activeType) ?? TREND_CONFIGS[0];

  useEffect(() => {
    if (hasUserSelectedType) {
      return;
    }

    const firstTypeWithData = TREND_CONFIGS.find(
      (config) => pointsByType[config.type].length > 0,
    )?.type;
    if (firstTypeWithData) {
      setActiveType(firstTypeWithData);
    }
  }, [hasUserSelectedType, pointsByType]);

  const moveRange = (offset: number) => {
    const nextRangeEnd = addDays(selectedRangeEndStable, offset * activeRange.stepDays);
    const boundedRangeEnd =
      nextRangeEnd.getTime() > currentDay.getTime() ? currentDay : nextRangeEnd;
    setSelectedRangeEndKey(toDateKey(boundedRangeEnd));
  };

  const resetToToday = () => {
    setSelectedRangeEndKey(toDateKey(currentDay));
  };

  const handleTypeSelect = (type: AccountAnalysisType) => {
    setHasUserSelectedType(true);
    setActiveType(type);
  };

  return (
    <section className="analysis-surface min-w-0 rounded-[28px] border border-white/10 p-4 sm:rounded-[32px] sm:p-6 xl:min-h-[min(42rem,calc(100dvh-6rem))]">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="min-w-0 sm:max-w-2xl">
          <div className="text-[0.72rem] uppercase tracking-[0.24em] text-white/42">
            Growth trends
          </div>
          <h2 className="mt-2 max-w-xl text-xl font-semibold leading-tight text-white sm:text-2xl">
            Daily score trends by training type
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/52">
            Switch training type and time range to compare daily scores without mixing report categories.
          </p>
        </div>
        <div className="grid w-full min-w-0 gap-2 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
          <div
            className="grid w-full grid-cols-2 gap-1 rounded-2xl border border-white/10 bg-black/18 p-1.5"
            role="tablist"
            aria-label="Trend time range"
          >
            {TREND_RANGE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                role="tab"
                aria-selected={option.key === activeRange.key}
                onClick={() => setActiveRangeKey(option.key)}
                className={cn(
                  "min-h-10 rounded-xl px-3 text-xs font-semibold uppercase tracking-[0.12em] transition focus:outline-none focus:ring-2 focus:ring-white/60",
                  option.key === activeRange.key
                    ? "bg-white text-[#071018]"
                    : "text-white/58 hover:bg-white/[0.06] hover:text-white/82",
                )}
              >
                {option.shortLabel}
              </button>
            ))}
          </div>
          <div className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] gap-2 rounded-2xl border border-white/10 bg-black/18 p-1.5 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]">
            <button
              type="button"
              onClick={() => moveRange(-1)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/72 transition hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-[#65f7ff]/22"
              aria-label="Previous trend window"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-xl px-2 text-center text-xs font-semibold text-white sm:px-3 sm:text-sm">
              <CalendarDays className="h-4 w-4 shrink-0 text-[#65f7ff]" />
              <span className="min-w-0 truncate">{rangeLabel}</span>
            </div>
            <button
              type="button"
              onClick={() => moveRange(1)}
              disabled={!canGoNext}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/72 transition hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-[#65f7ff]/22 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next trend window"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={resetToToday}
              className="col-span-3 inline-flex min-h-10 items-center justify-center rounded-xl border border-[#65f7ff]/20 bg-[#65f7ff]/10 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#dffbff] transition hover:bg-[#65f7ff]/16 focus:outline-none focus:ring-2 focus:ring-[#65f7ff]/22 sm:col-span-1"
            >
              Today
            </button>
          </div>
        </div>
      </div>

      <div
        className="mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/18 p-1.5"
        role="tablist"
        aria-label="Training type trend"
      >
        {TREND_CONFIGS.map((config) => (
          <button
            key={config.type}
            type="button"
            role="tab"
            id={`growth-trend-tab-${config.type}`}
            aria-selected={config.type === activeType}
            aria-controls={`growth-trend-${config.type}`}
            onClick={() => handleTypeSelect(config.type)}
            className={cn(
              "min-h-11 min-w-0 rounded-xl px-2 text-center text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-white/60 sm:px-3 sm:text-sm",
              config.type === activeType
                ? "bg-white text-[#071018] shadow-[0_10px_30px_rgba(0,0,0,0.22)]"
                : "text-white/58 hover:bg-white/[0.06] hover:text-white/82",
            )}
            style={
              config.type === activeType
                ? { boxShadow: `0 0 0 1px ${config.accent}44, 0 14px 36px rgba(0,0,0,0.28)` }
                : undefined
            }
          >
            <span className="block truncate">{config.title}</span>
          </button>
        ))}
      </div>

      <div
        className="mt-4"
        id={`growth-trend-${activeConfig.type}`}
        role="tabpanel"
        aria-labelledby={`growth-trend-tab-${activeConfig.type}`}
      >
        <TrendPanel
          key={`${activeConfig.type}-${activeRange.key}-${selectedRangeEndStableKey}`}
          config={activeConfig}
          points={pointsByType[activeConfig.type]}
          rangeDays={rangeDays}
          rangeOption={activeRange}
        />
      </div>
    </section>
  );
}
