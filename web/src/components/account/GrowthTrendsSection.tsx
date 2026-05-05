"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { GrowthSummary, ReportSource, TrendPoint } from "./types";

type GrowthTrendsSectionProps = {
  points: TrendPoint[];
  highlights: GrowthSummary[];
  source: ReportSource;
};

type ChartPoint = TrendPoint & {
  x: number;
  y: number;
};

const CHART_LEFT = 8;
const CHART_RIGHT = 96;
const CHART_TOP = 12;
const CHART_BOTTOM = 86;

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

function buildChartPoints(points: TrendPoint[]): ChartPoint[] {
  return points.map((point, index) => {
    const x =
      points.length === 1
        ? (CHART_LEFT + CHART_RIGHT) / 2
        : CHART_LEFT + (index / (points.length - 1)) * (CHART_RIGHT - CHART_LEFT);
    const y = CHART_BOTTOM - (clampScore(point.score) / 100) * (CHART_BOTTOM - CHART_TOP);

    return {
      ...point,
      x,
      y,
    };
  });
}

function buildChartPath(points: ChartPoint[]): string {
  if (points.length === 0) {
    return "";
  }

  return points
    .map((point, index) => {
      return `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`;
    })
    .join(" ");
}

function buildAreaPath(points: ChartPoint[]): string {
  if (points.length === 0) {
    return "";
  }

  const line = buildChartPath(points);
  const startX = points[0].x;
  const endX = points[points.length - 1].x;
  return `${line} L ${endX} ${CHART_BOTTOM} L ${startX} ${CHART_BOTTOM} Z`;
}

export function GrowthTrendsSection({
  points,
  highlights,
  source,
}: GrowthTrendsSectionProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const chartPoints = useMemo(() => buildChartPoints(points), [points]);
  const activePoint =
    activeIndex !== null && chartPoints[activeIndex] ? chartPoints[activeIndex] : null;
  const linePath = buildChartPath(chartPoints);
  const areaPath = buildAreaPath(chartPoints);
  const lastPoint = chartPoints[chartPoints.length - 1] ?? null;
  const bestPoint =
    chartPoints.length > 0
      ? chartPoints.reduce((best, point) => (point.score > best.score ? point : best), chartPoints[0])
      : null;

  return (
    <section className="analysis-surface rounded-[32px] border border-white/10 p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[0.72rem] uppercase tracking-[0.28em] text-white/42">
            Growth trends
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Score movement over your recent sessions
          </h2>
        </div>
        <Badge
          variant="outline"
          className="border-white/12 bg-white/[0.03] text-white/62"
        >
          {source === "live" ? "Recent reports" : "Preview curve"}
        </Badge>
      </div>

      <div className="mt-6 overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.01))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-5">
        <div className="relative h-72 overflow-hidden rounded-[24px] border border-[#65f7ff]/10 bg-[#05090f]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(101,247,255,0.16),transparent_28%),radial-gradient(circle_at_86%_22%,rgba(216,255,93,0.12),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0))]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(101,247,255,0.075)_1px,transparent_1px),linear-gradient(to_bottom,rgba(101,247,255,0.06)_1px,transparent_1px)] bg-[size:36px_36px] opacity-70" />
          <div className="absolute inset-x-0 top-0 h-20 bg-[linear-gradient(180deg,rgba(101,247,255,0.12),transparent)]" />
          <div className="account-chart-scan absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,transparent,rgba(216,255,93,0.1),transparent)]" />
          <div className="absolute bottom-10 left-0 top-4 flex w-9 flex-col justify-between pr-2 text-right text-[0.68rem] font-semibold text-white/42">
            <span>100</span>
            <span>50</span>
            <span>0</span>
          </div>
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="account-area-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#d8ff5d" stopOpacity="0.34" />
                <stop offset="48%" stopColor="#65f7ff" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#d8ff5d" stopOpacity="0.02" />
              </linearGradient>
              <filter id="account-line-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="2.8" result="blur" />
                <feColorMatrix
                  in="blur"
                  type="matrix"
                  values="0 0 0 0 0.85 0 0 0 0 1 0 0 0 0 0.36 0 0 0 0.65 0"
                  result="glow"
                />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {[CHART_TOP, (CHART_TOP + CHART_BOTTOM) / 2, CHART_BOTTOM].map((y) => (
              <line
                key={y}
                x1={CHART_LEFT}
                x2={CHART_RIGHT}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="0.4"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {chartPoints.length > 0 ? (
              <path
                d={linePath}
                fill="none"
                stroke="rgba(216,255,93,0.22)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                filter="url(#account-line-glow)"
              />
            ) : null}
            <path d={areaPath} fill="url(#account-area-fill)" />
            <path
              d={linePath}
              fill="none"
              stroke="#d8ff5d"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {chartPoints.map((point, index) => (
              <g key={`${point.label}-${index}`}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="4.2"
                  fill="rgba(216,255,93,0.18)"
                  className={index === chartPoints.length - 1 ? "account-chart-pulse" : ""}
                />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="2.2"
                  fill={activeIndex === index ? "#ffffff" : "#d8ff5d"}
                  stroke="rgba(9,11,15,0.9)"
                  strokeWidth="0.8"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ))}
          </svg>

          <div className="absolute inset-x-9 bottom-0 grid auto-cols-fr grid-flow-col gap-2 border-t border-white/8 bg-black/18 px-1 py-3 text-[0.68rem] uppercase tracking-[0.18em] text-white/42">
            {points.map((point) => (
              <div key={point.fullLabel} className="truncate text-center" title={point.fullLabel}>
                {point.label}
              </div>
            ))}
          </div>
          {chartPoints.map((point, index) => (
            <button
              type="button"
              key={`${point.fullLabel}-target`}
              aria-label={`${point.fullLabel}: ${Math.round(point.score)} score`}
              className="absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-[#d8ff5d]/70"
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              onFocus={() => setActiveIndex(index)}
              onBlur={() => setActiveIndex(null)}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            />
          ))}
          {activePoint ? (
            <div
              className={cn(
                "pointer-events-none absolute z-10 w-36 rounded-lg border border-[#65f7ff]/22 bg-[#07111d]/92 px-3 py-2 text-left shadow-[0_14px_40px_rgba(0,0,0,0.36),0_0_24px_rgba(101,247,255,0.14)] backdrop-blur-xl",
                activePoint.x > 72 ? "-translate-x-full" : "-translate-x-2",
                activePoint.y < 28 ? "translate-y-4" : "-translate-y-full",
              )}
              style={{
                left: `${activePoint.x}%`,
                top: `${activePoint.y}%`,
              }}
            >
              <div className="text-[0.65rem] uppercase tracking-[0.18em] text-[#65f7ff]/74">
                {activePoint.fullLabel}
              </div>
              <div className="mt-1 font-[var(--font-display)] text-2xl font-bold text-white">
                {Math.round(activePoint.score)}
              </div>
              <div className="text-xs text-white/50">0-100 score</div>
            </div>
          ) : null}
          {lastPoint ? (
            <div className="absolute right-3 top-3 rounded-lg border border-white/10 bg-black/26 px-3 py-2 text-right backdrop-blur-xl">
              <div className="text-[0.62rem] uppercase tracking-[0.18em] text-white/38">
                Latest
              </div>
              <div className="mt-1 text-lg font-semibold text-[#d8ff5d]">
                {Math.round(lastPoint.score)}
              </div>
            </div>
          ) : null}
          {bestPoint ? (
            <div className="absolute left-12 top-3 rounded-lg border border-white/10 bg-black/24 px-3 py-2 backdrop-blur-xl">
              <div className="text-[0.62rem] uppercase tracking-[0.18em] text-white/38">
                Peak
              </div>
              <div className="mt-1 text-lg font-semibold text-white">
                {Math.round(bestPoint.score)}
              </div>
            </div>
          ) : null}
          {points.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/54">
              No score trend yet. Complete a few sessions to light up the curve.
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {highlights.map((item) => (
            <div
              key={item.label}
              className="rounded-[22px] border border-white/10 bg-black/20 p-4"
            >
              <div className="text-[0.68rem] uppercase tracking-[0.24em] text-white/40">
                {item.label}
              </div>
              <div className="mt-3 text-2xl font-semibold text-white">
                {item.value}
              </div>
              <div className="mt-1 text-sm text-white/50">{item.helper}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
