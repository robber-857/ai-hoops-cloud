import Link from "next/link";
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
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-semibold">{plan.title}</h2>
        <span className="text-sm text-white/70">
          {plan.planned_on} · {plan.status === "draft" ? "Draft" : "Published"}
        </span>
      </div>
      <p className="mt-2 text-sm text-white/75">
        {plan.class_name} ·{" "}
        {plan.student_name
          ? `Personal plan: ${plan.student_name}`
          : "Class plan"}{" "}
        · {focusLabels[plan.focus]}
      </p>
      {plan.supersedes_public_id && (
        <p className="mt-2 text-sm text-[#d8ff5d]">
          Revision of an earlier plan. Earlier versions remain in history.
        </p>
      )}
      {plan.notes && (
        <p className="mt-4 max-w-prose whitespace-pre-wrap text-white/85">
          {plan.notes}
        </p>
      )}
      <ol className="mt-5 divide-y divide-white/15">
        {plan.items.map((item, i) => (
          <li key={i} className="py-4">
            <h3 className="font-medium">
              {i + 1}. {item.name}
            </h3>
            <p className="mt-1 text-sm text-white/75">
              {[
                item.sets && `${item.sets} sets`,
                item.reps && `${item.reps} reps`,
                item.duration_minutes && `${item.duration_minutes} min`,
              ]
                .filter(Boolean)
                .join(" · ") || "Follow coach instructions"}
            </p>
            {item.instructions && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-white/80">
                {item.instructions}
              </p>
            )}
            {item.template_code &&
              ["training", "shooting", "dribbling"].includes(
                item.analysis_type ?? "",
              ) && (
                <Link
                  className="mt-3 inline-flex min-h-11 items-center text-sm text-[#d8ff5d] underline underline-offset-4"
                  href={`/pose-2d/${item.analysis_type}?templateCode=${encodeURIComponent(item.template_code)}&classId=${encodeURIComponent(plan.class_public_id)}`}
                >
                  Open assessment · {item.template_code}
                </Link>
              )}
          </li>
        ))}
      </ol>
    </div>
  );
}
