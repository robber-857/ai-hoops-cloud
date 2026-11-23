"use client";
import { usePlayerCopy } from "@/components/account/playerCopy";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { measurementBmi, measurementTrendByDate } from "@/lib/profile";
import { routes } from "@/lib/routes";
import { playerProfileService, type PlayerMeasurement } from "@/services/playerProfile";
import { AccountTrendChart, formatTrendDate, trendDayTime, type ChartPoint } from "./AccountTrendChart";

const DAY_MS = 86_400_000;
const MEASURES = {
  height: {
    label: "Height",
    unit: "cm",
    read: (item: PlayerMeasurement) => Number(item.height_cm),
  },
  weight: {
    label: "Weight",
    unit: "kg",
    read: (item: PlayerMeasurement) => Number(item.weight_kg),
  },
  bmi: {
    label: "BMI",
    unit: "kg/m²",
    read: (item: PlayerMeasurement) => Number(measurementBmi(item)),
  },
} as const;
type Metric = keyof typeof MEASURES;
const metrics: Metric[] = ["height", "weight", "bmi"];
const displayValue = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 });
const signedValue = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2, signDisplay: "exceptZero" });

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Could not load measurements.";
}

export function MeasurementTrendsSection() {
  const { t, locale, isChinese } = usePlayerCopy();
  const [metric, setMetric] = useState<Metric>("height");
  const [items, setItems] = useState<PlayerMeasurement[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    playerProfileService.history()
      .then((response) => {
        if (active) {
          setItems(response.items);
          setHasMore(response.has_more);
        }
      })
      .catch((reason: unknown) => { if (active) setError(errorMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);

  async function loadOlder() {
    setLoading(true);
    setError("");
    try {
      const next = await playerProfileService.history(items.length);
      setItems((previous) => [...previous, ...next.items]);
      setHasMore(next.has_more);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }

  const measure = MEASURES[metric];
  const points: ChartPoint[] = measurementTrendByDate(items)
    .map((item) => ({ time: trendDayTime(item.measured_on), value: measure.read(item) }))
    .filter(({ value }) => Number.isFinite(value) && value > 0);
  const first = points[0];
  const latest = points.at(-1);
  const firstTime = first?.time ?? 0;
  const lastTime = latest?.time ?? firstTime;
  const timeRange: [number, number] = firstTime === lastTime
    ? [firstTime - DAY_MS * 3, lastTime + DAY_MS * 3]
    : [firstTime, lastTime];
  const values = points.map(({ value }) => value);
  const minValue = values.length ? Math.min(...values) : 0;
  const maxValue = values.length ? Math.max(...values) : 0;
  const padding = Math.max((maxValue - minValue) * 0.14, metric === "bmi" ? 0.5 : 1);
  const valueRange: [number, number] = [Math.max(0, Math.floor(minValue - padding)), Math.ceil(maxValue + padding)];

  return (
    <section id="measurement-trends" aria-labelledby="measurement-trends-title" className="ui-panel min-w-0 scroll-mt-20">
      <header className="border-b border-[var(--ui-border)] px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div>
            <h2 id="measurement-trends-title" className="text-xl font-semibold tracking-tight">{t("Player measurements")}</h2>
            <p className="mt-1 max-w-prose text-sm leading-6 text-[var(--ui-muted)]">
              {t("See the latest saved measurement for each date.")}
            </p>
          </div>
          <Link href={`${routes.user.profile}#player-measurements`} className="ui-link">
            {t("Add a measurement")} <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-4 inline-flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-subtle)] p-1" role="group" aria-label={t("Measurement type")}>
          {metrics.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={metric === key}
              className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-semibold text-[var(--ui-muted)] hover:text-[var(--ui-text)] aria-pressed:bg-[var(--ui-surface)] aria-pressed:text-[var(--ui-text)] aria-pressed:shadow-sm sm:px-3.5"
              onClick={() => setMetric(key)}
            >
              {t(MEASURES[key].label)}
            </button>
          ))}
        </div>
      </header>

      <div className="min-w-0 px-4 pb-2 pt-4 sm:px-6 sm:pt-5">
        {error && (
          <div role="alert" className="mb-3 flex flex-wrap items-center gap-x-3 text-sm text-[var(--ui-danger)]">
            <p>{t(error)}</p>
            <button
              type="button"
              className="ui-link"
              onClick={() => {
                if (items.length) {
                  void loadOlder();
                } else {
                  setLoading(true);
                  setError("");
                  setRetry((value) => value + 1);
                }
              }}
            >
              {t("Retry")}
            </button>
          </div>
        )}
        {loading && <p role="status" className="mb-3 text-sm text-[var(--ui-muted)]">{t("Loading measurements…")}</p>}
        {latest && (
          <dl className="mb-4 flex flex-wrap items-end gap-x-6 gap-y-3 sm:gap-x-8">
            <div className="min-w-28 sm:mr-auto">
              <dt className="text-sm font-semibold text-[var(--ui-muted)]">{isChinese ? `最新${t(measure.label)}` : `Latest ${metric === "bmi" ? "BMI" : measure.label.toLowerCase()}`}</dt>
              <dd className="mt-1">
                <span className="text-4xl font-bold tabular-nums leading-none tracking-tight sm:text-5xl">{displayValue.format(latest.value)}</span>
                <span className="ml-1.5 text-sm font-medium text-[var(--ui-muted)]">{measure.unit}</span>
                <time className="mt-1.5 block text-xs text-[var(--ui-muted)]" dateTime={new Date(latest.time).toISOString().slice(0, 10)}>
                  {formatTrendDate(latest.time, locale)}
                </time>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-[var(--ui-muted)]">{t("Dates recorded")}</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">{points.length}</dd>
            </div>
            {first && points.length > 1 && (
              <div>
                <dt className="text-xs font-medium text-[var(--ui-muted)]">{t("Change from first shown date")}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums">
                  {signedValue.format(latest.value - first.value)}
                  <span className="ml-1 text-xs text-[var(--ui-muted)]">{measure.unit}</span>
                </dd>
              </div>
            )}
          </dl>
        )}
        {((!loading && !error) || points.length > 0) && (
          <AccountTrendChart
            points={points}
            title={t(measure.label)}
            unit={measure.unit}
            color="var(--ui-chart-teal)"
            timeRange={timeRange}
            valueRange={valueRange}
            emptyMessage={t("No measurements recorded yet. Add a measurement to start tracking.")}
          />
        )}
        {hasMore && !error && (
          <button type="button" className="ui-button mb-2 mt-3" onClick={() => void loadOlder()} disabled={loading}>
            {t("Load older measurements")}
          </button>
        )}
      </div>
    </section>
  );
}
