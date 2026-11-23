"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, LineChart } from "lucide-react";
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
  const first = points[0]?.value;
  const latest = points.at(-1)?.value;
  const best = points.length ? Math.max(...points.map(({ value }) => value)) : undefined;
  const change = points.length > 1 && first !== undefined && latest !== undefined
    ? `${latest > first ? "+" : ""}${latest - first}`
    : "—";

  return (
    <section className="ui-panel space-y-4 p-4 sm:p-6" aria-labelledby="score-trends-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="score-trends-title" className="flex items-center gap-2 text-xl font-bold">
            <LineChart size={20} className="text-[var(--ui-chart-teal)]" aria-hidden="true" />
            Training scores
          </h2>
          <p className="mt-1.5 text-sm text-[var(--ui-muted)]">Daily average scores from saved analysis reports.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Trend time range">
          {[7, 30].map((days) => (
            <button
              key={days}
              type="button"
              aria-pressed={dayCount === days}
              className="ui-button"
              onClick={() => setDayCount(days === 7 ? 7 : 30)}
            >
              {days} days
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-[var(--ui-border)] pb-3">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Training type trend">
          {TRAINING_TYPES.map(({ key, label, color }) => (
            <button
              key={key}
              type="button"
              aria-pressed={key === type}
              className="ui-button"
              onClick={() => setSelectedType(key)}
            >
              <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: color }} />
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="ui-link" onClick={() => setSelectedDate(currentDay)}>Today</button>
      </div>
      <dl className="grid grid-cols-3 gap-2 rounded-xl bg-[var(--ui-subtle)] px-3 py-3 sm:gap-4 sm:px-4">
        {[
          { label: "Latest", value: latest ?? "—" },
          { label: "Best day", value: best ?? "—" },
          { label: "Change", value: change },
        ].map(({ label, value }) => (
          <div key={label}>
            <dt className="text-xs font-medium text-[var(--ui-muted)]">{label}</dt>
            <dd className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex items-center justify-between gap-2" aria-label="Score date window">
        <button
          type="button"
          className="ui-icon-button"
          aria-label="Previous trend window"
          onClick={() => setSelectedDate(end - dayCount * DAY_MS)}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <span className="text-center text-xs font-semibold text-[var(--ui-muted)] sm:text-sm" aria-live="polite">
          {formatTrendDate(start)} – {formatTrendDate(end)}
        </span>
        <button
          type="button"
          className="ui-icon-button disabled:opacity-45"
          aria-label="Next trend window"
          disabled={end >= currentDay}
          onClick={() => setSelectedDate(Math.min(currentDay, end + dayCount * DAY_MS))}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
      <AccountTrendChart
        points={points}
        title={`${config.label} score`}
        unit="pts"
        color={config.color}
        timeRange={[start, end]}
        valueRange={[0, 100]}
        emptyMessage={`No ${config.label.toLowerCase()} scores in this window.`}
      />
    </section>
  );
}
