import { cn } from "@/lib/utils";
import type { StatOverviewItem } from "./types";

type StatOverviewRowProps = {
  items: StatOverviewItem[];
};

export function StatOverviewRow({ items }: StatOverviewRowProps) {
  return (
    <dl
      aria-label="Training at a glance"
      className="mt-2 grid min-w-0 grid-cols-2 gap-x-3 gap-y-4 rounded-xl bg-[var(--ui-subtle)] px-3 py-4 sm:grid-cols-4 sm:px-4"
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0 border-l border-[var(--ui-border)] pl-2.5 sm:pl-3">
          <dt className="text-xs font-semibold text-[var(--ui-muted)]">{item.label}</dt>
          <dd className={cn("my-1 text-2xl leading-none font-bold tracking-tight tabular-nums", item.accent && "text-[var(--ui-accent)]")}>
            {item.value === "--" ? "—" : item.value}
          </dd>
          <dd className="text-xs leading-4 text-[var(--ui-muted)]">{item.helper}</dd>
        </div>
      ))}
    </dl>
  );
}
