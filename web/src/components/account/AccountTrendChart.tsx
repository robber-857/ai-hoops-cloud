"use client";

import { useId, useState } from "react";
import { ChevronDown, Table2 } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ChartPoint = { time: number; value: number; detail?: string };
type PlotPoint = { time: number; value: number | null; detail?: string };
const DAY_MS = 86_400_000;
const SCORE_TICKS = [0, 25, 50, 75, 100];

const fullDate = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const shortDate = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const valueFormat = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 });

export function trendDayTime(key: string): number {
  return Date.parse(`${key}T00:00:00Z`);
}

export function formatTrendDate(time: number): string {
  return fullDate.format(time);
}

function dateTicks([start, end]: [number, number], limit: number) {
  const days = Math.round((end - start) / DAY_MS);
  const intervals = Math.min(days, limit - 1);
  if (intervals < 1) return [start];
  return Array.from({ length: intervals + 1 }, (_, index) =>
    start + DAY_MS * Math.round((days * index) / intervals),
  );
}

function buildScorePlot(points: ChartPoint[]) {
  const plotPoints: PlotPoint[] = [];
  const gaps: { from: ChartPoint; to: ChartPoint }[] = [];
  points.forEach((point, index) => {
    const previous = points[index - 1];
    if (previous && point.time - previous.time > DAY_MS) {
      plotPoints.push({ time: previous.time + DAY_MS, value: null });
      gaps.push({ from: previous, to: point });
    }
    plotPoints.push(point);
  });
  return { plotPoints, gaps };
}

export function AccountTrendChart({
  points,
  title,
  unit,
  color,
  timeRange,
  valueRange,
  emptyMessage,
  series = "measurements",
}: {
  points: ChartPoint[];
  title: string;
  unit: string;
  color: string;
  timeRange: [number, number];
  valueRange: [number, number];
  emptyMessage: string;
  series?: "scores" | "measurements";
}) {
  const gradient = `chart-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [plotWidth, setPlotWidth] = useState(0);
  const unitSuffix = unit ? ` ${unit}` : "";
  const displayValue = (value: number) => `${valueFormat.format(value)}${unitSuffix}`;
  const { plotPoints, gaps } = series === "scores" ? buildScorePlot(points) : { plotPoints: points, gaps: [] };
  const tickLimit = plotWidth < 420 ? 3 : plotWidth < 750 ? 5 : 7;
  if (!points.length) {
    return (
      <p className="flex min-h-40 items-center justify-center rounded-xl bg-[var(--ui-subtle)] px-5 text-center text-sm text-[var(--ui-muted)]">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="min-w-0">
      {gaps.length > 0 && (
        <p className="mb-2 flex items-center gap-2 text-xs text-[var(--ui-muted)]">
          <span aria-hidden="true" className="w-6 shrink-0 border-t-2 border-dashed" style={{ borderColor: color }} />
          Dashed lines span days with no saved score.
        </p>
      )}
      <div className="h-[clamp(15rem,38vw,21rem)] min-w-0 rounded-xl bg-[color-mix(in_srgb,var(--ui-subtle)_42%,var(--ui-surface))] [&_.recharts-surface:focus-visible]:outline-2 [&_.recharts-surface:focus-visible]:outline-offset-2 [&_.recharts-surface:focus-visible]:outline-[var(--ui-accent)] [&_.recharts-surface_g:focus:not(:focus-visible)]:outline-none">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} onResize={setPlotWidth}>
          <AreaChart
            title={title}
            desc="Use the arrow keys to inspect data points. The data table is below the chart."
            data={plotPoints}
            margin={{ top: 22, right: 20, bottom: 12, left: 4 }}
            accessibilityLayer
          >
            <defs>
              <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.16} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--ui-border)" strokeOpacity={0.72} />
            <XAxis
              type="number"
              dataKey="time"
              domain={timeRange}
              ticks={dateTicks(timeRange, tickLimit)}
              tickFormatter={(time: number) => shortDate.format(time)}
              interval={0}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--ui-muted)", fontSize: 11 }}
              tickMargin={10}
              padding={{ left: 12, right: 12 }}
            />
            <YAxis
              domain={valueRange}
              tickCount={4}
              ticks={series === "scores" ? SCORE_TICKS : undefined}
              tickFormatter={(value: number) => valueFormat.format(value)}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--ui-muted)", fontSize: 11 }}
              tickMargin={8}
              width={38}
            />
            {gaps.map(({ from, to }) => (
              <ReferenceLine
                key={from.time}
                segment={[{ x: from.time, y: from.value }, { x: to.time, y: to.value }]}
                stroke={color}
                strokeDasharray="4 5"
                strokeOpacity={0.65}
                strokeWidth={1.75}
                strokeLinecap="round"
                pointerEvents="none"
              />
            ))}
            <Tooltip
              isAnimationActive={false}
              content={({ active, payload }) => {
                const point: PlotPoint | undefined = payload[0]?.payload;
                if (!active || !point || point.value === null) return null;
                return (
                  <div role="status" className="min-w-32 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2.5 text-xs text-[var(--ui-text)] shadow-lg">
                    <p className="text-[var(--ui-muted)]">{formatTrendDate(point.time)}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                      <span>{title}</span>
                      <strong className="ml-auto whitespace-nowrap tabular-nums">{displayValue(point.value)}</strong>
                    </div>
                    {point.detail && <p className="mt-1 text-[var(--ui-muted)]">{point.detail}</p>}
                  </div>
                );
              }}
              cursor={{ stroke: color, strokeOpacity: 0.6, strokeDasharray: "3 5" }}
            />
            <Area
              type="monotoneX"
              dataKey="value"
              isAnimationActive={false}
              connectNulls={false}
              stroke={color}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={gaps.length ? "none" : `url(#${gradient})`}
              baseValue={valueRange[0]}
              dot={points.length <= 30 && { r: points.length <= 3 ? 5 : 3.5, stroke: "var(--ui-surface)", strokeWidth: 2, fill: color }}
              activeDot={{ r: 6, stroke: "var(--ui-surface)", strokeWidth: 2.5, fill: color }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <details className="group mt-2 text-sm">
        <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 font-semibold text-[var(--ui-accent)] [&::-webkit-details-marker]:hidden">
          <Table2 size={15} aria-hidden="true" />
          View chart data
          <ChevronDown size={14} aria-hidden="true" className="transition-transform group-open:rotate-180 motion-reduce:transition-none" />
        </summary>
        <table className="w-full text-left text-[var(--ui-muted)]">
          <caption className="sr-only">{title} data</caption>
          <thead>
            <tr className="border-b border-[var(--ui-border)]">
              <th scope="col" className="py-2">Date</th>
              <th scope="col" className="py-2 text-right">{title}</th>
            </tr>
          </thead>
          <tbody>
            {points.map(({ time, value, detail }) => (
              <tr key={time} className="border-b border-[var(--ui-border)]">
                <th scope="row" className="py-2 font-medium">
                  {formatTrendDate(time)}
                  {detail && <span className="block text-xs">{detail}</span>}
                </th>
                <td className="py-2 text-right tabular-nums">{displayValue(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
