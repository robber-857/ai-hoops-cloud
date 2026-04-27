import { cn } from "@/lib/utils";

import type { StatOverviewItem } from "./types";

type StatOverviewRowProps = {
  items: StatOverviewItem[];
};

export function StatOverviewRow({ items }: StatOverviewRowProps) {
  return (
    <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="analysis-surface rounded-[28px] border border-white/10 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.22)]"
        >
          <div className="text-[0.72rem] uppercase tracking-[0.28em] text-white/42">
            {item.label}
          </div>
          <div
            className={cn(
              "mt-5 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl",
              item.accent && "text-[#d8ff5d]"
            )}
          >
            {item.value}
          </div>
          <div className="mt-2 text-sm text-white/52">{item.helper}</div>
        </div>
      ))}
    </section>
  );
}
