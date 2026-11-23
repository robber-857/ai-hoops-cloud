"use client";
import { usePlayerCopy } from "@/components/account/playerCopy";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { sydneyDateKey } from "@/lib/profile";
import { meService } from "@/services/me";
import { normalizeTrendPoints } from "./AccountDataProvider";
import {
  AccountTrendChart,
  formatTrendDate,
  trendDayTime,
  type ChartPoint,
} from "./AccountTrendChart";
import type { AccountAnalysisType } from "./types";

const DAY_MS = 86_400_000;
const TRAINING_TYPES = [
  { key: "shooting", label: "Shooting", color: "var(--ui-chart-orange)" },
  { key: "dribbling", label: "Dribbling", color: "var(--ui-chart-teal)" },
  { key: "training", label: "Training", color: "var(--ui-chart-violet)" },
] as const;
const TIME_WINDOWS = [7, 30] as const;

const segmentedGroup = "inline-flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-subtle)] p-1";
const segmentedButton = "inline-flex min-h-11 items-center justify-center rounded-lg px-2.5 text-sm font-semibold text-[var(--ui-muted)] hover:text-[var(--ui-text)] aria-pressed:bg-[var(--ui-surface)] aria-pressed:text-[var(--ui-text)] aria-pressed:shadow-sm sm:px-3.5";
const dateButton = "inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-[var(--ui-muted)] enabled:hover:bg-[var(--ui-subtle)] enabled:hover:text-[var(--ui-text)] disabled:opacity-40";

type TrendHistory = { points: (ChartPoint & { sessionCount?: number })[]; failed?: boolean };

export function GrowthTrendsSection({ initialType = "shooting" }: { initialType?: AccountAnalysisType }) {
  const { t, locale, isChinese } = usePlayerCopy();
  const dateWindowFormat = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const [type, setType] = useState<AccountAnalysisType>(initialType);
  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [dayCount, setDayCount] = useState<7 | 30>(7);
  const [historyByType, setHistoryByType] = useState<Partial<Record<AccountAnalysisType, TrendHistory>>>({});

  const history = historyByType[type];
  useEffect(() => {
    if (history) return;

    let active = true;
    meService.getTrends({ range: "all", analysisType: type })
      .then((response) => {
        if (!active) return;
        const points = normalizeTrendPoints(response.points, type)
          .map((point) => ({ time: trendDayTime(point.dateKey), value: point.score, sessionCount: point.sessionCount }))
          .filter(({ time }) => Number.isFinite(time))
          .sort((left, right) => left.time - right.time);
        setHistoryByType((current) => ({ ...current, [type]: { points } }));
      })
      .catch(() => {
        if (active) setHistoryByType((current) => ({ ...current, [type]: { points: [], failed: true } }));
      });
    return () => { active = false; };
  }, [history, type]);

  const currentDay = trendDayTime(sydneyDateKey());
  const config = TRAINING_TYPES.find(({ key }) => key === type)!;
  const data = history?.points ?? [];
  const earliestDay = data[0]?.time;
  const latestDay = data.at(-1)?.time ?? currentDay;
  const end = Math.min(currentDay, selectedDate ?? latestDay);
  const start = end - (dayCount - 1) * DAY_MS;
  const points: ChartPoint[] = data.filter(({ time }) => time >= start && time <= end)
    .map((point) => ({ ...point, detail: point.sessionCount == null ? undefined : isChinese
      ? `${point.sessionCount} 次训练` : `${point.sessionCount} ${point.sessionCount === 1 ? "session" : "sessions"}` }));
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
            <h2 id="score-trends-title" className="text-xl font-semibold tracking-tight">{t("Training scores")}</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--ui-muted)]">{t("Daily averages from your saved analysis reports.")}</p>
          </div>
          <div role="group" aria-label={t("Trend time range")} className={segmentedGroup}>
            {TIME_WINDOWS.map((days) => (
              <button
                key={days}
                type="button"
                aria-pressed={dayCount === days}
                className={segmentedButton}
                onClick={() => setDayCount(days)}
              >
                {days} {t("days")}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label={t("Training type trend")} className={segmentedGroup}>
            {TRAINING_TYPES.map(({ key, label, color }) => (
              <button
                key={key}
                type="button"
                aria-pressed={key === type}
                className={segmentedButton + " gap-1.5"}
                onClick={() => setType(key)}
              >
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                {t(label)}
              </button>
            ))}
          </div>
          <div role="group" aria-label={t("Score date window")} className="flex max-w-full flex-wrap items-center gap-1 sm:gap-2">
            <div className="flex max-w-full items-center rounded-xl border border-[var(--ui-border)]">
              <button
                type="button"
                className={dateButton}
                aria-label={t("Previous trend window")}
                disabled={earliestDay === undefined || earliestDay >= start}
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
                aria-label={t("Next trend window")}
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
              {t("Today")}
            </button>
          </div>
        </div>
      </header>

      <div className="min-w-0 px-4 pb-2 pt-4 sm:px-6 sm:pt-5">
        {latest && (
          <dl className="mb-4 flex flex-wrap items-end gap-x-6 gap-y-3 sm:gap-x-8">
            <div className="min-w-28 sm:mr-auto">
              <dt className="text-sm font-semibold text-[var(--ui-muted)]">{isChinese ? `最新${t(config.label)}得分` : `Latest ${config.label.toLowerCase()} score`}</dt>
              <dd className="mt-1">
                <span className="text-4xl font-bold tabular-nums leading-none tracking-tight sm:text-5xl">{latest.value}</span>
                <span className="ml-1.5 text-sm font-medium text-[var(--ui-muted)]">/ 100</span>
                <time className="mt-1.5 block text-xs text-[var(--ui-muted)]" dateTime={new Date(latest.time).toISOString().slice(0, 10)}>
                  {formatTrendDate(latest.time, locale)}
                </time>
              </dd>
            </div>
            {comparison ? (
              <>
                <div>
                  <dt className="text-xs font-medium text-[var(--ui-muted)]">{t("Best day")}</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums">{comparison.best}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-[var(--ui-muted)]">{t("Window change")}</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums">
                    {comparison.change > 0 ? "+" : ""}{comparison.change}
                    <span className="ml-1 text-xs text-[var(--ui-muted)]">{t("pts")}</span>
                  </dd>
                </div>
              </>
            ) : (
              <div>
                <dt className="text-xs font-medium text-[var(--ui-muted)]">{t("Scored dates")}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums">1</dd>
              </div>
            )}
          </dl>
        )}

        {!history ? (
          <p role="status" className="flex min-h-40 items-center justify-center rounded-xl bg-[var(--ui-subtle)] px-5 text-center text-sm text-[var(--ui-muted)]">{t("Loading saved scores…")}</p>
        ) : history.failed ? (
          <div role="alert" className="flex min-h-40 flex-col items-center justify-center gap-1 rounded-xl bg-[var(--ui-subtle)] px-5 text-center text-sm text-[var(--ui-muted)]">
            <p>{t("Could not load saved scores.")}</p>
            <button type="button" className="ui-link" onClick={() => setHistoryByType((current) => ({ ...current, [type]: undefined }))}>{t("Retry")}</button>
          </div>
        ) : (
          <>
            <AccountTrendChart
              points={points}
              title={isChinese ? `${t(config.label)}得分` : `${config.label} score`}
              unit={t("pts")}
              color={config.color}
              timeRange={[start, end]}
              valueRange={[0, 100]}
              series="scores"
              emptyMessage={data.length
                ? (isChinese ? `此日期范围内没有${t(config.label)}得分。` : `No ${config.label.toLowerCase()} scores in this date range.`)
                : (isChinese ? `尚未保存${t(config.label)}得分。` : `No ${config.label.toLowerCase()} scores saved yet.`)}
            />
            {data.length > 0 && !points.length && (
              <button type="button" className="ui-link" onClick={() => setSelectedDate(null)}>{t("View latest scores")}</button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
