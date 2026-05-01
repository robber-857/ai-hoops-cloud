import { RadioTower } from "lucide-react";

import { CoachClassSummary } from "@/components/coach/CoachClassSummary";
import type { CoachClassRead } from "@/services/coach";

type CoachClassListProps = {
  classes: CoachClassRead[];
};

export function CoachClassList({ classes }: CoachClassListProps) {
  if (classes.length === 0) {
    return (
      <section className="rounded-lg border border-white/10 bg-white/[0.045] p-8 text-center backdrop-blur-2xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#65f7ff]/24 bg-[#65f7ff]/10 text-[#65f7ff]">
          <RadioTower className="h-6 w-6" />
        </div>
        <h2 className="mt-5 font-[var(--font-display)] text-xl font-bold text-white">
          No active classes assigned yet.
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/55">
          Once an administrator assigns a class, this console will show class status,
          students, and recent training activity.
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
      {classes.map((classItem, index) => (
        <CoachClassSummary key={classItem.public_id} classItem={classItem} index={index} />
      ))}
    </section>
  );
}
