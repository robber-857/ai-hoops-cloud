"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { sydneyDateKey } from "@/lib/profile";
import {
  AccountTrendChart,
  formatTrendDate,
  trendDayTime,
  type ChartPoint,
} from "./AccountTrendChart";
import type { AccountAnalysisType, TrendPointsByType } from "./types";

const DAY_MS = 86_400_000;
const TRAINING_TYPES = [
  { key: "shooting", label: "Shooting", color: "var(--ui-chart-orange)" },
  { key: "dribbling", label: "Dribbling", color: "var(--ui-chart-teal)" },
  { key: "training", label: "Training", color: "var(--ui-chart-violet)" },
] as const;
const TIME_WINDOWS = [7, 30] as const;
const dateWindowFormat = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const segmentedGroup = "inline-flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-subtle)] p-1";
const segmentedButton = "inline-flex min-h-11 items-center justify-center rounded-lg px-2.5 text-sm font-semibold text-[var(--ui-muted)] hover:text-[var(--ui-text)] aria-pressed:bg-[var(--ui-surface)] aria-pressed:text-[var(--ui-text)] aria-pressed:shadow-sm sm:px-3.5";
const dateButton = "inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-[var(--ui-muted)] enabled:hover:bg-[var(--ui-subtle)] enabled:hover:text-[var(--ui-text)] disabled:opacity-40";

export function GrowthTrendsSection({ pointsByType }: { pointsByType: TrendPointsByType }) {
  const [selectedType, setSelectedType] = useState<AccountAnalysisType | null>(null);
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [dayCount, setDayCount] = useState<7 | 30>(7);

  const currentDay = trendDayTime(sydneyDateKey());
  const type = selectedType ?? TRAINING_TYPES.find(({ key }) => pointsByType[key].length)?.key ?? "shooting";
  const config = TRAINING_TYPES.find(({ key }) => key === type)!;
  const data = pointsByType[type]
    .map((point) => ({
      time: trendDayTime(point.dateKey),
      value: Math.round(point.score),
      detail: point.metaLabel,
    }))
    .filter(({ time, value }) => Number.isFinite(time) && Number.isFinite(value))
    .sort((left, right) => left.time - right.time);
  const latestDay = data.at(-1)?.time ?? currentDay;
  const end = Math.min(currentDay, selectedDate ?? latestDay);
  const start = end - (dayCount - 1) * DAY_MS;
  const points: ChartPoint[] = data.filter(({ time }) => time >= start && time <= end);
  const hasUnscoredDays = points.some((point, index) => index > 0 && point.time - points[index - 1].time > DAY_MS);
  const first = points[0];
  const latest = points.at(-1);
  const comparison = points.length > 1 && first && latest
    ? { best: Math.max(...points.map(({ value }) => value)), change: latest.value - first.value }
    : null;

  return (
    <section className="ui-panel min-w-0" aria-labelledby="score-trends-title">
      <header className="border-b border-[var(--ui-border)] px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="score-trends-title" className="text-xl font-semibold tracking-tight">Training scores</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--ui-muted)]">Daily averages from your saved analysis reports.</p>
          </div>
          <div role="group" aria-label="Trend time range" className={segmentedGroup}>
            {TIME_WINDOWS.map((days) => (
              <button
                key={days}
                type="button"
                aria-pressed={dayCount === days}
                className={segmentedButton}
                onClick={() => setDayCount(days)}
              >
                {days} days
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Training type trend" className={segmentedGroup}>
            {TRAINING_TYPES.map(({ key, label, color }) => (
              <button
                key={key}
                type="button"
                aria-pressed={key === type}
                className={segmentedButton + " gap-1.5"}
                onClick={() => setSelectedType(key)}
              >
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                {label}
              </button>
            ))}
          </div>
          <div role="group" aria-label="Score date window" className="flex max-w-full flex-wrap items-center gap-1 sm:gap-2">
            <div className="flex max-w-full items-center rounded-xl border border-[var(--ui-border)]">
              <button
                type="button"
                className={dateButton}
                aria-label="Previous trend window"
                onClick={() => setSelectedDate(end - dayCount * DAY_MS)}
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <span className="min-w-0 px-1 text-center text-xs font-semibold text-[var(--ui-text)] sm:px-2 sm:text-sm" aria-live="polite">
                {dateWindowFormat.formatRange(start, end)}
              </span>
              <button
                type="button"
                className={dateButton}
                aria-label="Next trend window"
                disabled={end >= currentDay}
                onClick={() => setSelectedDate(Math.min(currentDay, end + dayCount * DAY_MS))}
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              className="ui-button"
              disabled={end >= currentDay}
              onClick={() => setSelectedDate(currentDay)}
            >
              Today
            </button>
          </div>
        </div>
      </header>

      <div className="min-w-0 px-4 pb-2 pt-4 sm:px-6 sm:pt-5">
        {latest && (
          <dl className="mb-4 flex flex-wrap items-end gap-x-6 gap-y-3 sm:gap-x-8">
            <div className="min-w-28 sm:mr-auto">
              <dt className="text-sm font-semibold text-[var(--ui-muted)]">Latest {config.label.toLowerCase()} score</dt>
              <dd className="mt-1">
                <span className="text-4xl font-bold tabular-nums leading-none tracking-tight sm:text-5xl">{latest.value}</span>
                <span className="ml-1.5 text-sm font-medium text-[var(--ui-muted)]">/ 100</span>
                <time className="mt-1.5 block text-xs text-[var(--ui-muted)]" dateTime={new Date(latest.time).toISOString().slice(0, 10)}>
                  {formatTrendDate(latest.time)}
                </time>
              </dd>
            </div>
            {comparison ? (
              <>
                <div>
                  <dt className="text-xs font-medium text-[var(--ui-muted)]">Best day</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums">{comparison.best}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--ui-muted)]">Window change</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums">
                    {comparison.change > 0 ? "+" : ""}{comparison.change}
                    <span className="ml-1 text-xs text-[var(--ui-muted)]">pts</span>
                  </dd>
                </div>
              </>
            ) : (
              <div>
                <dt className="text-xs font-medium text-[var(--ui-muted)]">Scored dates</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums">1</dd>
              </div>
            )}
          </dl>
        )}

        {hasUnscoredDays && <p className="mb-1 text-xs text-[var(--ui-muted)]">Gaps mark days without a saved score.</p>}
        <AccountTrendChart
          points={points}
          title={`${config.label} score`}
          unit="pts"
          color={config.color}
          timeRange={[start, end]}
          valueRange={[0, 100]}
          series="scores"
          emptyMessage={`No ${config.label.toLowerCase()} scores in this date range.`}
        />
      </div>
    </section>
  );
}
