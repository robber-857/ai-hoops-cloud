import { Badge } from "@/components/ui/badge";

import type { GrowthSummary, ReportSource, TrendPoint } from "./types";

type GrowthTrendsSectionProps = {
  points: TrendPoint[];
  highlights: GrowthSummary[];
  source: ReportSource;
};

function buildChartPath(points: TrendPoint[]): string {
  if (points.length === 0) {
    return "";
  }

  return points
    .map((point, index) => {
      const x = points.length === 1 ? 52 : 10 + (index / (points.length - 1)) * 84;
      const y = 84 - Math.max(0, Math.min(100, point.score)) * 0.72;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function buildAreaPath(points: TrendPoint[]): string {
  if (points.length === 0) {
    return "";
  }

  const line = buildChartPath(points);
  const startX = points.length === 1 ? 52 : 10;
  const endX = points.length === 1 ? 52 : 94;
  return `${line} L ${endX} 84 L ${startX} 84 Z`;
}

export function GrowthTrendsSection({
  points,
  highlights,
  source,
}: GrowthTrendsSectionProps) {
  const linePath = buildChartPath(points);
  const areaPath = buildAreaPath(points);

  return (
    <section className="analysis-surface rounded-[32px] border border-white/10 p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[0.72rem] uppercase tracking-[0.28em] text-white/42">
            Growth trends
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white">
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

      <div className="mt-6 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-4 sm:p-5">
        <div className="relative h-64">
          <div className="absolute inset-0 rounded-[24px] bg-black/16" />
          <div className="absolute bottom-10 left-0 top-2 flex w-8 flex-col justify-between text-right text-[0.68rem] font-medium text-white/38">
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
                <stop offset="0%" stopColor="#d8ff5d" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#d8ff5d" stopOpacity="0.04" />
              </linearGradient>
            </defs>
            {[12, 48, 84].map((y) => (
              <line
                key={y}
                x1="10"
                x2="94"
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="0.4"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <path d={areaPath} fill="url(#account-area-fill)" />
            <path
              d={linePath}
              fill="none"
              stroke="#d8ff5d"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {points.map((point, index) => {
              const x = points.length === 1 ? 52 : 10 + (index / (points.length - 1)) * 84;
              const y = 84 - Math.max(0, Math.min(100, point.score)) * 0.72;

              return (
                <circle
                  key={`${point.label}-${index}`}
                  cx={x}
                  cy={y}
                  r="2.6"
                  fill="#d8ff5d"
                  stroke="rgba(9,11,15,0.9)"
                  strokeWidth="0.8"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>

          <div className="absolute inset-x-8 bottom-0 grid auto-cols-fr grid-flow-col gap-2 pt-4 text-[0.68rem] uppercase tracking-[0.18em] text-white/38">
            {points.map((point) => (
              <div key={point.fullLabel} className="truncate text-center" title={point.fullLabel}>
                {point.label}
              </div>
            ))}
          </div>
          {points.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/48">
              No score trend yet.
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
              <div className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
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
