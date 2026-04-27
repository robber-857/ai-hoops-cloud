import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { WeeklyTask } from "./types";

type WeeklyTasksSectionProps = {
  tasks: WeeklyTask[];
};

const statusMap: Record<
  WeeklyTask["status"],
  { label: string; className: string; barClassName: string }
> = {
  done: {
    label: "Done",
    className: "border-emerald-300/20 bg-emerald-400/12 text-emerald-200",
    barClassName: "bg-emerald-300",
  },
  in_progress: {
    label: "In progress",
    className: "border-[#d8ff5d]/25 bg-[#d8ff5d]/12 text-[#e8ff9a]",
    barClassName: "bg-[#d8ff5d]",
  },
  pending: {
    label: "Pending",
    className: "border-white/12 bg-white/[0.05] text-white/55",
    barClassName: "bg-white/24",
  },
};

export function WeeklyTasksSection({ tasks }: WeeklyTasksSectionProps) {
  return (
    <section className="analysis-surface rounded-[32px] border border-white/10 p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[0.72rem] uppercase tracking-[0.28em] text-white/42">
            Weekly tasks
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white">
            Keep your training rhythm visible
          </h2>
        </div>
        <Badge className="border border-[#d8ff5d]/20 bg-[#d8ff5d]/12 text-[#e8ff9a]">
          Week focus
        </Badge>
      </div>

      <div className="mt-6 grid gap-4">
        {tasks.map((task) => {
          const tone = statusMap[task.status];
          const progress = Math.max(0, Math.min(100, Math.round(task.progress * 100)));

          return (
            <article
              key={task.title}
              className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 transition-all duration-200 hover:border-white/16 hover:bg-white/[0.05]"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-lg font-medium text-white">{task.title}</div>
                  <p className="mt-1 text-sm leading-6 text-white/56">{task.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cn("border", tone.className)}>{tone.label}</Badge>
                  <span className="text-sm font-semibold text-white/76">{task.valueLabel}</span>
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", tone.barClassName)}
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs uppercase tracking-[0.22em] text-white/36">
                <span>{progress}% complete</span>
                <span>{task.dueLabel}</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
