"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Ruler } from "lucide-react";
import { measurementBmi, measurementTrendByDate } from "@/lib/profile";
import { routes } from "@/lib/routes";
import { playerProfileService, type PlayerMeasurement } from "@/services/playerProfile";
import { AccountTrendChart, formatTrendDate, trendDayTime, type ChartPoint } from "./AccountTrendChart";

const DAY_MS = 86_400_000;
const MEASURES = {
  height: {
    label: "Height",
    unit: "cm",
    color: "var(--ui-chart-teal)",
    read: (item: PlayerMeasurement) => Number(item.height_cm),
  },
  weight: {
    label: "Weight",
    unit: "kg",
    color: "var(--ui-chart-orange)",
    read: (item: PlayerMeasurement) => Number(item.weight_kg),
  },
  bmi: {
    label: "BMI",
    unit: "kg/m²",
    color: "var(--ui-chart-violet)",
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
    <section id="measurement-trends" aria-labelledby="measurement-trends-title" className="ui-panel scroll-mt-20 space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div>
          <h2 id="measurement-trends-title" className="flex items-center gap-2 text-xl font-bold">
            <Ruler size={20} className="text-[var(--ui-chart-orange)]" aria-hidden="true" /> Player measurements
          </h2>
          <p className="mt-1.5 max-w-prose text-sm text-[var(--ui-muted)]">
            Track your saved measurements by date. A corrected date shows its latest saved value.
          </p>
        </div>
        <Link href={`${routes.user.profile}#player-measurements`} className="ui-link">
          Add a measurement <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Measurement type">
        {metrics.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={metric === key}
            className="ui-button"
            onClick={() => setMetric(key)}
          >
            {MEASURES[key].label}
          </button>
        ))}
      </div>
      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-x-3 text-sm text-[var(--ui-danger)]">
          <p>{error}</p>
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
            Retry
          </button>
        </div>
      )}
      {loading && <p role="status" className="text-sm text-[var(--ui-muted)]">Loading measurements…</p>}
      {latest && (
        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-[var(--ui-subtle)] p-4">
          <div>
            <dt className="text-xs font-medium text-[var(--ui-muted)]">Latest · {formatTrendDate(latest.time)}</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums">
              {displayValue.format(latest.value)} <span className="text-sm font-medium">{measure.unit}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-[var(--ui-muted)]">Change over shown dates</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums">
              {first && points.length > 1
                ? <>{signedValue.format(latest.value - first.value)} <span className="text-sm font-medium">{measure.unit}</span></>
                : "—"}
            </dd>
          </div>
        </dl>
      )}
      {((!loading && !error) || points.length > 0) && (
        <AccountTrendChart
          points={points}
          title={measure.label}
          unit={measure.unit}
          color={measure.color}
          timeRange={timeRange}
          valueRange={valueRange}
          emptyMessage="No measurement values to chart yet. Add one in your personal profile to get started."
        />
      )}
      {hasMore && !error && (
        <button type="button" className="ui-button" onClick={() => void loadOlder()} disabled={loading}>
          Load older measurements
        </button>
      )}
    </section>
  );
}
