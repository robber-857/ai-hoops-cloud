"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Eye,
  Loader2,
  Save,
  Search,
} from "lucide-react";

import {
  AdminForbiddenSurface,
  AdminLoadingSurface,
  AdminShell,
} from "@/components/admin/AdminShell";
import {
  analysisTypeLabels,
  formatDateTime,
  getTemplateDisplayName,
} from "@/components/coach/coachUtils";
import { cn } from "@/lib/utils";
import {
  adminService,
  type AdminCampRead,
  type AdminClassRead,
  type AdminTaskDetailRead,
  type AdminTaskRead,
  type AdminUserRead,
} from "@/services/admin";
import type { ReportAnalysisType } from "@/services/reports";
import { useAuthStore } from "@/store/authStore";

const fieldClass =
  "min-h-11 w-full rounded-lg border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#65f7ff]/46 focus:bg-black/34 focus:ring-2 focus:ring-[#65f7ff]/12";
const labelClass = "text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/46";
const taskStatuses = ["draft", "published", "completed", "cancelled", "closed", "archived"];
const analysisTypes: ReportAnalysisType[] = ["shooting", "dribbling", "training", "comprehensive"];

function statusTone(status: string) {
  if (status === "completed") {
    return "border-[#d8ff5d]/24 bg-[#d8ff5d]/10 text-[#e8ff9a]";
  }
  if (status === "cancelled" || status === "closed" || status === "archived") {
    return "border-white/10 bg-white/[0.04] text-white/48";
  }
  if (status === "draft") {
    return "border-[#a78bfa]/24 bg-[#8b5cf6]/12 text-[#ddd6fe]";
  }
  return "border-[#65f7ff]/24 bg-[#65f7ff]/10 text-[#dffbff]";
}

function assignmentProgress(task: AdminTaskRead) {
  if (task.assignment_count === 0) {
    return 0;
  }
  return Math.round((task.completed_assignment_count / task.assignment_count) * 100);
}

export default function AdminTasksPage() {
  const user = useAuthStore((state) => state.user);
  const hasInitialized = useAuthStore((state) => state.hasInitialized);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const [tasks, setTasks] = useState<AdminTaskRead[]>([]);
  const [selectedTask, setSelectedTask] = useState<AdminTaskDetailRead | null>(null);
  const [classes, setClasses] = useState<AdminClassRead[]>([]);
  const [camps, setCamps] = useState<AdminCampRead[]>([]);
  const [coaches, setCoaches] = useState<AdminUserRead[]>([]);
  const [coachFilter, setCoachFilter] = useState("");
  const [campFilter, setCampFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [analysisTypeFilter, setAnalysisTypeFilter] = useState<ReportAnalysisType | "">("");
  const [keyword, setKeyword] = useState("");
  const [detailStatus, setDetailStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";

  const loadTasks = async () => {
    const response = await adminService.listTasks({
      coach_public_id: coachFilter,
      camp_public_id: campFilter,
      class_public_id: classFilter,
      status: statusFilter,
      analysis_type: analysisTypeFilter,
      keyword: keyword.trim(),
      limit: 100,
    });
    setTasks(response.items);
  };

  const loadTaskDetail = async (taskPublicId: string) => {
    const detail = await adminService.getTask(taskPublicId);
    setSelectedTask(detail);
    setDetailStatus(detail.status);
  };

  useEffect(() => {
    if (!hasInitialized || !user || !isAdmin) {
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      adminService.listTasks({ limit: 100 }),
      adminService.listClasses(),
      adminService.listCamps(),
      adminService.listUsers({ role: "coach", page: 1, page_size: 100 }),
    ])
      .then(([tasksResponse, classesResponse, campsResponse, coachesResponse]) => {
        if (!isActive) {
          return;
        }
        setTasks(tasksResponse.items);
        setClasses(classesResponse.items);
        setCamps(campsResponse.items);
        setCoaches(coachesResponse.items);
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
  }, [hasInitialized, isAdmin, user]);

  const submitFilters = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await loadTasks();
    } catch (filterError) {
      setError(filterError instanceof Error ? filterError.message : "Unable to filter tasks.");
    }
  };

  const saveTaskStatus = async () => {
    if (!selectedTask) {
      return;
    }
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await adminService.updateTask(selectedTask.public_id, {
        status: detailStatus,
      });
      setSelectedTask(updated);
      setMessage(`Task ${updated.title} is now ${updated.status}.`);
      await loadTasks();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update task.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!hasInitialized || isInitializing || !user) {
    return <AdminLoadingSurface />;
  }

  if (!isAdmin) {
    return <AdminForbiddenSurface user={user} />;
  }

  return (
    <AdminShell user={user} title="Task Supervision" breadcrumb={["Tasks"]}>
      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {message ? (
        <div className="flex items-center gap-2 rounded-lg border border-[#d8ff5d]/24 bg-[#d8ff5d]/10 px-4 py-3 text-sm font-medium text-[#efffb8]">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]">
        <section className="min-w-0 rounded-lg border border-white/10 bg-white/[0.055] p-5 backdrop-blur-2xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className={labelClass}>Coach task monitor</div>
              <h1 className="mt-2 font-[var(--font-display)] text-2xl font-bold text-white">
                Training assignments
              </h1>
              <p className="mt-2 text-sm text-white/52">{tasks.length} tasks in the current view</p>
            </div>
            <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-[9rem_9rem_9rem_9rem_10rem_auto]" onSubmit={submitFilters}>
              <select className={fieldClass} value={coachFilter} onChange={(event) => setCoachFilter(event.target.value)}>
                <option value="">All coaches</option>
                {coaches.map((coach) => (
                  <option key={coach.public_id} value={coach.public_id}>
                    {coach.nickname || coach.username}
                  </option>
                ))}
              </select>
              <select className={fieldClass} value={campFilter} onChange={(event) => setCampFilter(event.target.value)}>
                <option value="">All camps</option>
                {camps.map((camp) => (
                  <option key={camp.public_id} value={camp.public_id}>
                    {camp.name}
                  </option>
                ))}
              </select>
              <select className={fieldClass} value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
                <option value="">All classes</option>
                {classes.map((classItem) => (
                  <option key={classItem.public_id} value={classItem.public_id}>
                    {classItem.name}
                  </option>
                ))}
              </select>
              <select className={fieldClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">All status</option>
                {taskStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <select className={fieldClass} value={analysisTypeFilter} onChange={(event) => setAnalysisTypeFilter(event.target.value as ReportAnalysisType | "")}>
                <option value="">All motions</option>
                {analysisTypes.map((type) => (
                  <option key={type} value={type}>
                    {analysisTypeLabels[type]}
                  </option>
                ))}
              </select>
              <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/24 bg-[#65f7ff]/10 px-4 text-sm font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/16">
                <Search className="h-4 w-4" />
                Search
              </button>
            </form>
          </div>

          <div className="mt-4">
            <input
              className={fieldClass}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Search title, description, or template"
            />
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-white/10 bg-black/18">
            <div className="overflow-x-auto">
              <table className="min-w-[1080px] w-full border-collapse text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.035] text-[0.68rem] uppercase tracking-[0.18em] text-white/42">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Task</th>
                    <th className="px-4 py-3 font-semibold">Coach</th>
                    <th className="px-4 py-3 font-semibold">Class</th>
                    <th className="px-4 py-3 font-semibold">Motion</th>
                    <th className="px-4 py-3 text-right font-semibold">Progress</th>
                    <th className="px-4 py-3 font-semibold">Due</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {tasks.map((task) => (
                    <tr key={task.public_id} className="transition hover:bg-[#65f7ff]/[0.055]">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 font-semibold text-white">
                          <ClipboardList className="h-4 w-4 text-[#65f7ff]" />
                          {task.title}
                        </div>
                        <div className="mt-1 max-w-[20rem] truncate text-xs text-white/42">
                          {task.description || "No description"}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-white/62">{task.coach_name}</td>
                      <td className="px-4 py-4 text-white/62">
                        <div>{task.class_name}</div>
                        <div className="mt-1 text-xs text-white/38">{task.camp_name || "No camp"}</div>
                      </td>
                      <td className="px-4 py-4 text-white/62">
                        <div>{task.analysis_type ? analysisTypeLabels[task.analysis_type] : "Any"}</div>
                        <div className="mt-1 max-w-[13rem] truncate text-xs text-white/38">
                          {getTemplateDisplayName(task.template_code)}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="font-[var(--font-display)] text-xl font-bold text-[#d8ff5d]">
                          {task.completed_assignment_count}/{task.assignment_count}
                        </div>
                        <div className="mt-1 text-xs text-white/42">{assignmentProgress(task)}% complete</div>
                      </td>
                      <td className="px-4 py-4 text-white/62">{formatDateTime(task.due_at)}</td>
                      <td className="px-4 py-4">
                        <span className={cn("rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em]", statusTone(task.status))}>
                          {task.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button type="button" onClick={() => loadTaskDetail(task.public_id)} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/24 bg-[#65f7ff]/10 px-3 text-xs font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/16">
                          <Eye className="h-4 w-4" />
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))}
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-white/48">
                        {isLoading ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-[#65f7ff]" />
                            Loading tasks
                          </span>
                        ) : (
                          "No tasks match the current filters."
                        )}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-lg border border-white/10 bg-white/[0.055] p-5 backdrop-blur-2xl">
            <div className={labelClass}>Task detail</div>
            {selectedTask ? (
              <>
                <h2 className="mt-2 font-[var(--font-display)] text-xl font-bold text-white">
                  {selectedTask.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/52">
                  {selectedTask.description || "No task description."}
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-black/18 p-3">
                    <div className={labelClass}>Assignments</div>
                    <div className="mt-2 font-[var(--font-display)] text-2xl font-bold text-[#d8ff5d]">
                      {selectedTask.completed_assignment_count}/{selectedTask.assignment_count}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/18 p-3">
                    <div className={labelClass}>Due</div>
                    <div className="mt-2 text-sm font-semibold text-white">
                      {formatDateTime(selectedTask.due_at)}
                    </div>
                  </div>
                </div>
                <label className="mt-5 block space-y-2">
                  <span className={labelClass}>Admin status override</span>
                  <select className={fieldClass} value={detailStatus} onChange={(event) => setDetailStatus(event.target.value)}>
                    {taskStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={saveTaskStatus} disabled={isSaving} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#d8ff5d]/32 bg-[#d8ff5d]/10 px-4 text-sm font-semibold text-[#f1ffc1] transition hover:bg-[#d8ff5d]/16 disabled:cursor-not-allowed disabled:opacity-60">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save status
                </button>
              </>
            ) : (
              <p className="mt-3 text-sm leading-6 text-white/50">
                Select a task to inspect assignments and supervise status.
              </p>
            )}
          </section>

          {selectedTask ? (
            <section className="rounded-lg border border-white/10 bg-white/[0.055] p-5 backdrop-blur-2xl">
              <div className={labelClass}>Student progress</div>
              <div className="mt-4 max-h-[32rem] space-y-3 overflow-y-auto pr-1">
                {selectedTask.assignments.map((assignment) => (
                  <div key={assignment.public_id} className="rounded-lg border border-white/10 bg-black/18 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-white">{assignment.student_name}</div>
                        <div className="mt-1 text-xs text-white/40">
                          Last submission {formatDateTime(assignment.last_submission_at)}
                        </div>
                      </div>
                      <span className={cn("rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em]", statusTone(assignment.status))}>
                        {assignment.status}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-white/48">
                      <span>{assignment.completed_sessions} sessions</span>
                      <span>Best {assignment.best_score ?? "--"}</span>
                      <span>{assignment.progress_percent ?? 0}%</span>
                    </div>
                  </div>
                ))}
                {selectedTask.assignments.length === 0 ? (
                  <div className="rounded-lg border border-white/10 bg-black/18 p-5 text-center text-sm text-white/48">
                    No assignments are attached to this task.
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </AdminShell>
  );
}
