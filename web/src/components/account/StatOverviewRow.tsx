import { cn } from "@/lib/utils";

import type { StatOverviewItem } from "./types";

type StatOverviewRowProps = {
  items: StatOverviewItem[];
};

export function StatOverviewRow({ items }: StatOverviewRowProps) {
  return (
    <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="analysis-surface min-w-0 rounded-[24px] border border-white/10 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.22)] sm:rounded-[28px] sm:p-5"
        >
          <div className="truncate text-[0.68rem] uppercase tracking-[0.22em] text-white/42 sm:text-[0.72rem] sm:tracking-[0.28em]">
            {item.label}
          </div>
          <div
            className={cn(
              "mt-4 text-3xl font-semibold tracking-[-0.05em] text-white sm:mt-5 sm:text-4xl",
              item.accent && "text-[#d8ff5d]"
            )}
          >
            {item.value}
          </div>
          <div className="mt-2 text-sm leading-5 text-white/52">{item.helper}</div>
        </div>
      ))}
    </section>
  );
}
