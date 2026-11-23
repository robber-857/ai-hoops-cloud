"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ChartPoint = { time: number; value: number; detail?: string };

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

export function trendDayTime(key: string): number {
  return Date.parse(`${key}T00:00:00Z`);
}

export function formatTrendDate(time: number): string {
  return fullDate.format(time);
}

export function AccountTrendChart({
  points,
  title,
  unit,
  color,
  timeRange,
  valueRange,
  emptyMessage,
}: {
  points: ChartPoint[];
  title: string;
  unit: string;
  color: string;
  timeRange: [number, number];
  valueRange: [number, number];
  emptyMessage: string;
}) {
  const gradient = `chart-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const unitSuffix = unit ? ` ${unit}` : "";
  if (!points.length) {
    return (
      <p className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-[var(--ui-border)] px-5 text-center text-sm text-[var(--ui-muted)]">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="min-w-0">
      <div className="h-[clamp(14rem,45vw,18rem)] min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart
            title={title}
            data={points}
            margin={{ top: 12, right: 20, bottom: 6, left: 0 }}
          >
            <defs>
              <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={color} stopOpacity={0.015} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--ui-border)" strokeDasharray="3 5" />
            <XAxis
              type="number"
              dataKey="time"
              domain={timeRange}
              tickFormatter={(time: number) => shortDate.format(time)}
              minTickGap={20}
              axisLine={{ stroke: "var(--ui-border)" }}
              tickLine={false}
              tick={{ fill: "var(--ui-muted)", fontSize: 12 }}
              tickMargin={10}
            />
            <YAxis
              domain={valueRange}
              tickCount={5}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--ui-muted)", fontSize: 12 }}
              tickMargin={8}
              width={42}
            />
            <Tooltip
              labelFormatter={(value) => formatTrendDate(Number(value))}
              formatter={(value) => [`${value}${unitSuffix}`, title]}
              contentStyle={{
                borderColor: "var(--ui-border)",
                background: "var(--ui-surface)",
                color: "var(--ui-text)",
                borderRadius: 12,
                fontSize: 13,
              }}
              cursor={{ stroke: "var(--ui-muted)", strokeDasharray: "3 4" }}
            />
            <Area
              type="linear"
              dataKey="value"
              isAnimationActive={false}
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#${gradient})`}
              dot={points.length <= 30 && { r: 3.5, stroke: "var(--ui-surface)", fill: color }}
              activeDot={{ r: 5, stroke: "var(--ui-surface)", strokeWidth: 2, fill: color }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-1 border-t border-[var(--ui-border)] text-sm">
        <summary className="min-h-11 w-fit cursor-pointer py-3 font-semibold text-[var(--ui-accent)]">View chart data</summary>
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
                <td className="py-2 text-right tabular-nums">{value}{unitSuffix}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
