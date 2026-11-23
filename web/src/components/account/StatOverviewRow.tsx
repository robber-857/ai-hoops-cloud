import { CalendarDays, ClipboardCheck, FileChartColumn, Trophy } from "lucide-react";

import type { StatOverviewItem } from "./types";

type StatOverviewRowProps = {
  items: StatOverviewItem[];
};

export function StatOverviewRow({ items }: StatOverviewRowProps) {
  const icons = [FileChartColumn, CalendarDays, Trophy, ClipboardCheck];
  return (
    <section aria-label="Training at a glance" className="grid min-w-0 grid-cols-2 gap-3 xl:grid-cols-4">
      {items.map((item, index) => {
        const Icon = icons[index] ?? FileChartColumn;
        const colors = ["--ui-chart-teal", "--ui-chart-violet", "--ui-chart-orange", "--ui-chart-green"];
        return (
          <div key={item.label} className="ui-panel p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--ui-muted)] sm:text-sm">
              <span className="rounded-md bg-[var(--ui-subtle)] p-1.5" style={{ color: `var(${colors[index] ?? colors[0]})` }}>
                <Icon size={16} aria-hidden="true" />
              </span>
              {item.label}
            </div>
            <div className={`mt-2.5 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl ${item.accent ? "text-[var(--ui-accent)]" : ""}`}>{item.value}</div>
            <div className="mt-1 text-xs leading-4 text-[var(--ui-muted)]">{item.helper}</div>
          </div>
        );
      })}
    </section>
  );
}
