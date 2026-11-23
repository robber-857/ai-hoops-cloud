import Link from "next/link";
import { ArrowUpRight, CalendarDays, Dumbbell, UsersRound } from "lucide-react";
import { getTemplateById } from "@/config/templates";
import type { CampPlan } from "@/services/campPlans";
export const focusLabels: Record<string, string> = {
  fitness: "Fitness foundations",
  coordination: "Movement and coordination",
  basketball: "Basketball performance",
  general: "All-round development",
};
export function PlanDetails({ plan }: { plan: CampPlan }) {
  return (
    <div className="min-w-0 break-words">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{plan.title}</h2>
          <p className="mt-1 text-sm font-medium text-[var(--ui-muted)]">{focusLabels[plan.focus] ?? plan.focus}</p>
        </div>
        <span className="rounded-full bg-[var(--ui-accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--ui-accent)]">
          {plan.status === "draft" ? "Draft" : "Published"}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--ui-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays size={16} className="shrink-0" aria-hidden="true" />
          <time dateTime={plan.planned_on}>{plan.planned_on}</time>
        </span>
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <UsersRound size={16} className="shrink-0" aria-hidden="true" />
          {plan.class_name} · {plan.student_name ? `Personal plan for ${plan.student_name}` : "Class plan"}
        </span>
      </div>
      {plan.supersedes_public_id && (
        <p className="mt-3 text-sm text-[var(--ui-accent)]">
          Updated plan. Earlier versions are available in history.
        </p>
      )}
      {plan.notes && (
        <p className="mt-4 max-w-prose whitespace-pre-wrap text-sm leading-6">{plan.notes}</p>
      )}
      <ol className="mt-5 space-y-2.5">
        {plan.items.map((item, index) => {
          const workload = [
            item.sets && `${item.sets} ${item.sets === 1 ? "set" : "sets"}`,
            item.reps && `${item.reps} ${item.reps === 1 ? "rep" : "reps"}`,
            item.duration_minutes && `${item.duration_minutes} min`,
          ].filter(Boolean);
          const assessmentHref = item.template_code && ["training", "shooting", "dribbling"].includes(item.analysis_type ?? "")
            ? `/pose-2d/${item.analysis_type}?templateCode=${encodeURIComponent(item.template_code)}&classId=${encodeURIComponent(plan.class_public_id)}`
            : null;
          const assessmentName = item.template_code ? getTemplateById(item.template_code)?.displayName : null;
          return (
            <li key={index} className="flex flex-col gap-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-subtle)] p-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 gap-3">
                <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--ui-surface)] text-[var(--ui-chart-violet)]">
                  <Dumbbell size={17} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold">{item.name}</h3>
                  {workload.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs font-medium text-[var(--ui-muted)]">
                      {workload.map((detail) => (
                        <span key={detail} className="rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2 py-1">{detail}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-[var(--ui-muted)]">Follow coach instructions</p>
                  )}
                  {item.instructions && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--ui-muted)]">{item.instructions}</p>
                  )}
                </div>
              </div>
              {assessmentHref && (
                <Link
                  className="ui-button ui-primary self-start sm:shrink-0"
                  href={assessmentHref}
                  aria-label={`Start assessment for ${assessmentName ?? item.name}`}
                >
                  Start assessment <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
