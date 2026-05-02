"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ClipboardList, Eye, Loader2, ShieldAlert } from "lucide-react";

import {
  analysisTypeLabels,
  formatDateTime,
  getTemplateDisplayName,
} from "@/components/coach/coachUtils";
import { CoachShell } from "@/components/coach/CoachShell";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import {
  coachService,
  type CoachClassRead,
  type CoachTaskRead,
} from "@/services/coach";
import { useAuthStore } from "@/store/authStore";

type CoachTaskWithClass = CoachTaskRead & {
  class_name: string;
};

function CoachRouteLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#030712] text-white">
      <div className="rounded-lg border border-white/10 bg-white/[0.055] px-8 py-7 text-center shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
        <Loader2 className="mx-auto h-9 w-9 animate-spin text-[#65f7ff]" />
        <div className="mt-4 text-[0.72rem] uppercase tracking-[0.28em] text-white/48">
          Loading tasks
        </div>
      </div>
    </main>
  );
}

function statusTone(status: string) {
  if (status === "closed" || status === "archived") {
    return "border-white/10 bg-white/[0.04] text-white/48";
  }
  if (status === "completed") {
    return "border-[#d8ff5d]/24 bg-[#d8ff5d]/10 text-[#e8ff9a]";
  }
  return "border-[#65f7ff]/24 bg-[#65f7ff]/10 text-[#dffbff]";
}

export default function CoachTasksPage() {
  const user = useAuthStore((state) => state.user);
  const hasInitialized = useAuthStore((state) => state.hasInitialized);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const [classes, setClasses] = useState<CoachClassRead[]>([]);
  const [tasks, setTasks] = useState<CoachTaskWithClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canAccessCoach = user?.role === "coach" || user?.role === "admin";

  useEffect(() => {
    if (!hasInitialized || !user || !canAccessCoach) {
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);

    void coachService
      .listClasses()
      .then(async (classesResponse) => {
        const visibleClasses = classesResponse.items;
        const taskResponses = await Promise.all(
          visibleClasses.map(async (classItem) => ({
            classItem,
            response: await coachService.listClassTasks(classItem.public_id, { limit: 50 }),
          })),
        );
        const allTasks = taskResponses
          .flatMap(({ classItem, response }) =>
            response.items.map((task) => ({ ...task, class_name: classItem.name })),
          )
          .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
        if (isActive) {
          setClasses(visibleClasses);
          setTasks(allTasks);
        }
      })
      .catch((fetchError) => {
        if (isActive) {
          setError(fetchError instanceof Error ? fetchError.message : "Unable to load tasks.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [canAccessCoach, hasInitialized, user]);

  if (!hasInitialized || isInitializing || !user) {
    return <CoachRouteLoading />;
  }

  if (!canAccessCoach) {
    return (
      <CoachShell user={user} title="Coach access required" breadcrumb={["Access"]}>
        <section className="rounded-lg border border-red-400/20 bg-red-500/10 p-8 text-center backdrop-blur-2xl">
          <ShieldAlert className="mx-auto h-10 w-10 text-red-200" />
          <h2 className="mt-5 font-[var(--font-display)] text-2xl font-bold text-white">
            This workspace is available to coaches only.
          </h2>
        </section>
      </CoachShell>
    );
  }

  const filteredTasks = tasks.filter((task) => {
    if (selectedClassId && task.class_public_id !== selectedClassId) {
      return false;
    }
    if (statusFilter && task.status !== statusFilter) {
      return false;
    }
    return true;
  });

  return (
    <CoachShell user={user} title="Training Tasks" breadcrumb={["Tasks"]}>
      <section className="rounded-lg border border-white/10 bg-white/[0.055] p-5 backdrop-blur-2xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[0.68rem] uppercase tracking-[0.22em] text-white/42">
              Task stream
            </div>
            <h1 className="mt-2 font-[var(--font-display)] text-2xl font-bold text-white">
              Published training work
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="min-h-11 rounded-lg border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition focus:border-[#65f7ff]/46 focus:ring-2 focus:ring-[#65f7ff]/12"
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
            >
              <option value="">All classes</option>
              {classes.map((classItem) => (
                <option key={classItem.public_id} value={classItem.public_id}>
                  {classItem.name}
                </option>
              ))}
            </select>
            <select
              className="min-h-11 rounded-lg border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition focus:border-[#65f7ff]/46 focus:ring-2 focus:ring-[#65f7ff]/12"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All status</option>
              <option value="draft">draft</option>
              <option value="published">published</option>
              <option value="closed">closed</option>
              <option value="archived">archived</option>
            </select>
            {isLoading ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/18 px-3 py-2 text-sm text-white/58">
                <Loader2 className="h-4 w-4 animate-spin text-[#65f7ff]" />
                Loading
              </span>
            ) : null}
          </div>
        </div>
        {error ? (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="mt-5 overflow-hidden rounded-lg border border-white/10 bg-black/18">
          <div className="overflow-x-auto">
            <table className="min-w-[960px] w-full border-collapse text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.035] text-[0.68rem] uppercase tracking-[0.18em] text-white/42">
                <tr>
                  <th className="px-4 py-3 font-semibold">Task</th>
                  <th className="px-4 py-3 font-semibold">Class</th>
                  <th className="px-4 py-3 font-semibold">Motion</th>
                  <th className="px-4 py-3 text-right font-semibold">Progress</th>
                  <th className="px-4 py-3 font-semibold">Due</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {filteredTasks.map((task) => {
                  const progress =
                    task.assignment_count > 0
                      ? Math.round((task.completed_assignment_count / task.assignment_count) * 100)
                      : 0;
                  return (
                    <tr key={task.public_id} className="transition hover:bg-[#65f7ff]/[0.055]">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 font-semibold text-white">
                          <ClipboardList className="h-4 w-4 text-[#65f7ff]" />
                          {task.title}
                        </div>
                        <div className="mt-1 max-w-[22rem] truncate text-xs text-white/42">
                          {task.description || "No description"}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-white/62">{task.class_name}</td>
                      <td className="px-4 py-4 text-white/62">
                        <div>{task.analysis_type ? analysisTypeLabels[task.analysis_type] : "Any"}</div>
                        <div className="mt-1 max-w-[14rem] truncate text-xs text-white/38">
                          {getTemplateDisplayName(task.template_code)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="font-[var(--font-display)] text-xl font-bold text-[#d8ff5d]">
                          {task.completed_assignment_count}/{task.assignment_count}
                        </div>
                        <div className="mt-1 text-xs text-white/42">{progress}% complete</div>
                      </td>
                      <td className="px-4 py-4 text-white/62">{formatDateTime(task.due_at)}</td>
                      <td className="px-4 py-4">
                        <span className={cn("rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em]", statusTone(task.status))}>
                          {task.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link
                          href={`${routes.coach.classDetail(task.class_public_id)}?tab=tasks`}
                          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/24 bg-[#65f7ff]/10 px-3 text-xs font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/16"
                        >
                          <Eye className="h-4 w-4" />
                          Class
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-white/48">
                      No tasks match the current filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </CoachShell>
  );
}
