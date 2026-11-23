"use client";
import { usePlayerCopy } from "@/components/account/playerCopy";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrendPointsByType } from "./types";

const SERIES = [
  { type: "shooting", label: "Shooting", color: "var(--ui-chart-orange)" },
  { type: "dribbling", label: "Dribbling", color: "var(--ui-chart-teal)" },
  { type: "training", label: "Training", color: "var(--ui-chart-violet)" },
] as const;
const DAY_MS = 86_400_000;


function activityDays(pointsByType: TrendPointsByType, today: string) {
  const end = Date.parse(`${today}T00:00:00Z`);
  const counts = SERIES.map((series) => ({
    ...series,
    byDate: new Map(pointsByType[series.type].map((point) => [point.dateKey, point.sessionCount ?? 0])),
  }));

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(end - (6 - index) * DAY_MS);
    const key = date.toISOString().slice(0, 10);
    const series = counts.map(({ type, label, color, byDate }) => ({
      type,
      label,
      color,
      count: byDate.get(key) ?? 0,
    }));
    return {
      key,
      date,
      series,
      total: series.reduce((sum, entry) => sum + entry.count, 0),
    };
  });
}

export function OverviewActivity({ pointsByType, today }: { pointsByType: TrendPointsByType; today: string }) {
  const { t, locale, isChinese } = usePlayerCopy();
  const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const dateFormat = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const days = activityDays(pointsByType, today);
  const first = days[0];
  const last = days[days.length - 1];
  const selected = days.find(({ key }) => key === selectedKey) ?? [...days].reverse().find(({ total }) => total > 0) ?? last;
  const range = `${dateFormat.format(first.date)} – ${dateFormat.format(last.date)}`;
  const maximum = Math.max(2, Math.ceil(Math.max(...days.map(({ total }) => total)) / 2) * 2);
  const hasActivity = days.some(({ total }) => total > 0);

  return (
    <section className="mt-5" aria-labelledby="overview-activity-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 id="overview-activity-title" className="text-sm font-semibold">{t("Scored reports")}</h3>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--ui-border)] px-2 py-1 text-xs font-medium text-[var(--ui-muted)]">
          <CalendarDays size={13} aria-hidden="true" /> {range}
        </span>
      </div>
      {hasActivity ? (
        <>
          <div className="grid grid-cols-[2rem_minmax(0,1fr)] sm:grid-cols-[2.5rem_minmax(0,1fr)]">
            <div className="-my-2 flex h-[calc(9rem+1rem)] flex-col justify-between pr-1.5 text-right text-xs tabular-nums text-[var(--ui-muted)]" aria-hidden="true">
              <span>{maximum}</span>
              <span>{maximum / 2}</span>
              <span>0</span>
            </div>
            <div className="relative grid grid-cols-7 gap-0.5 sm:gap-2" role="group" aria-label={t("Scored reports by day")}>
              <div className="pointer-events-none absolute inset-x-0 top-0 flex h-36 flex-col justify-between" aria-hidden="true">
                <span className="border-t border-dashed border-[var(--ui-border)]" />
                <span className="border-t border-dashed border-[var(--ui-border)]" />
                <span className="border-t border-[var(--ui-border)]" />
              </div>
              {days.map((day) => (
                <button
                  type="button"
                  key={day.key}
                  onClick={() => setSelectedKey(day.key)}
                  aria-label={isChinese ? `${dateFormat.format(day.date)}，${day.total} 份评分报告` : `${dateFormat.format(day.date)}, ${day.total} scored ${day.total === 1 ? "report" : "reports"}`}
                  aria-pressed={day.key === selected.key}
                  className="group relative flex min-w-0 flex-col items-center rounded-md"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "relative flex h-36 w-full items-end justify-center rounded-t-md group-hover:bg-[var(--ui-subtle)]",
                      day.key === selected.key && "bg-[var(--ui-subtle)]",
                    )}
                  >
                    {day.total > 0 && (
                      <span
                        className="flex w-[62%] max-w-9 flex-col-reverse overflow-hidden rounded-t-md"
                        style={{ height: `${day.total / maximum * 100}%` }}
                      >
                        {day.series.filter(({ count }) => count > 0).map(({ type, color, count }) => (
                          <span key={type} style={{ flexGrow: count, backgroundColor: color }} />
                        ))}
                      </span>
                    )}
                  </span>
                  <span className={cn(
                    "min-h-7 pt-2 text-[0.68rem] text-[var(--ui-muted)] sm:text-xs",
                    day.key === selected.key && "font-semibold text-[var(--ui-text)]",
                  )}>
                    {weekdayFormat.format(day.date)}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div aria-live="polite" className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-[var(--ui-border)] pt-3 text-xs">
            <span className="font-semibold" title={selected.key}>
              {dateFormat.format(selected.date)} · {selected.total} {isChinese ? "份报告" : selected.total === 1 ? "report" : "reports"}
            </span>
            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[var(--ui-muted)]">
              {selected.series.map(({ type, label, color, count }) => (
                <li key={type} className="inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                  {t(label)} <span className="font-semibold tabular-nums text-[var(--ui-text)]">{count}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <div className="flex min-h-44 items-center justify-center rounded-xl border border-dashed border-[var(--ui-border)] bg-[var(--ui-subtle)] px-4 text-center text-sm text-[var(--ui-muted)]">
          {t("No scored reports in the last seven days.")}
        </div>
      )}
    </section>
  );
}
