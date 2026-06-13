import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Eye, History, RefreshCw, UploadCloud, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { WeeklyTask, WeeklyTaskDetail } from "./types";

type WeeklyTasksSectionProps = {
  tasks: WeeklyTask[];
  taskDetailsById?: Record<string, WeeklyTaskDetail | undefined>;
  loadingTaskDetailId?: string | null;
  taskDetailErrors?: Record<string, string | undefined>;
  taskSubmitErrors?: Record<string, string | undefined>;
  submittingTaskId?: string | null;
  isRefreshing?: boolean;
  refreshLabel?: string;
  refreshError?: string | null;
  onRequestTaskDetail?: (task: WeeklyTask) => void;
  onRefresh?: () => void;
  onSubmitReport?: (task: WeeklyTask, reportPublicId: string) => void;
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

export function WeeklyTasksSection({
  tasks,
  taskDetailsById = {},
  loadingTaskDetailId,
  taskDetailErrors = {},
  taskSubmitErrors = {},
  submittingTaskId,
  isRefreshing = false,
  refreshLabel,
  refreshError,
  onRequestTaskDetail,
  onRefresh,
  onSubmitReport,
}: WeeklyTasksSectionProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedReportByTask, setSelectedReportByTask] = useState<Record<string, string>>({});
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks],
  );
  const selectedTaskDetail = selectedTask ? taskDetailsById[selectedTask.id] : undefined;
  const selectedSubmissionHistory = selectedTaskDetail?.submissionHistory ?? [];
  const isSelectedDetailLoading = selectedTask ? loadingTaskDetailId === selectedTask.id : false;
  const selectedDetailError = selectedTask ? taskDetailErrors[selectedTask.id] : undefined;
  const selectedSubmitError = selectedTask ? taskSubmitErrors[selectedTask.id] : undefined;

  useEffect(() => {
    setSelectedReportByTask((current) => {
      const next = { ...current };
      for (const task of tasks) {
        if (!next[task.id] && task.reportOptions[0]) {
          next[task.id] = task.reportOptions[0].id;
        }
      }
      return next;
    });
  }, [tasks]);

  const getSelectedReportId = (task: WeeklyTask) =>
    selectedReportByTask[task.id] ?? task.reportOptions[0]?.id ?? "";

  const handleOpenDetail = (task: WeeklyTask) => {
    setSelectedTaskId(task.id);
    onRequestTaskDetail?.(task);
  };

  const handleSubmit = (task: WeeklyTask) => {
    const reportPublicId = getSelectedReportId(task);
    if (!reportPublicId) {
      return;
    }
    onSubmitReport?.(task, reportPublicId);
  };

  return (
    <section className="analysis-surface flex max-h-[min(44rem,calc(100dvh-2rem))] min-w-0 flex-col overflow-hidden rounded-[28px] border border-white/10 p-4 sm:rounded-[32px] sm:p-6 xl:h-[min(42rem,calc(100dvh-6rem))]">
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-[0.72rem] uppercase tracking-[0.28em] text-white/42">
            Weekly tasks
          </div>
          <h2 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
            Keep your training rhythm visible
          </h2>
          {refreshLabel ? (
            <div className="mt-2 truncate text-xs uppercase tracking-[0.16em] text-white/36 sm:tracking-[0.2em]">
              {refreshLabel}
            </div>
          ) : null}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={isRefreshing}
            onClick={onRefresh}
            className="min-h-10 flex-1 rounded-full border-white/10 bg-white/[0.03] px-3 text-xs text-white hover:bg-white/[0.08] sm:flex-none"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing ? "animate-spin" : null)} />
            {isRefreshing ? "Refreshing" : "Refresh"}
          </Button>
          <Badge className="min-h-10 justify-center border border-[#d8ff5d]/20 bg-[#d8ff5d]/12 px-3 text-[#e8ff9a]">
            Live tasks
          </Badge>
        </div>
      </div>
      {refreshError ? (
        <div className="mt-4 flex shrink-0 items-start gap-2 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-xs leading-5 text-rose-100/80">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{refreshError}</span>
        </div>
      ) : null}

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable] sm:mt-6">
        <div className="grid gap-3 sm:gap-4">
        {tasks.map((task) => {
          const tone = statusMap[task.status];
          const progress = Math.max(0, Math.min(100, Math.round(task.progress * 100)));
          const taskSubmitError = taskSubmitErrors[task.id];

          return (
            <article
              key={task.id}
              className="min-w-0 rounded-[22px] border border-white/10 bg-white/[0.03] p-3 transition-all duration-200 hover:border-white/16 hover:bg-white/[0.05] sm:rounded-[24px] sm:p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="break-words text-base font-medium text-white sm:text-lg">
                    {task.title}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-white/56">{task.description}</p>
                  <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-[0.62rem] uppercase tracking-[0.12em] text-white/38 sm:text-[0.68rem] sm:tracking-[0.18em]">
                    <span>{task.className}</span>
                    <span>{task.analysisType}</span>
                    <span>{task.targetLabel}</span>
                    {task.scoreGateLabel ? <span>{task.scoreGateLabel}</span> : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
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

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.22em] text-white/36">
                <span>{progress}% complete</span>
                <span>{task.dueLabel}</span>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  asChild
                  className="min-h-10 w-full justify-center rounded-full border border-[#d8ff5d]/20 bg-[#d8ff5d] px-4 text-slate-950 hover:bg-[#e8ff9a] sm:w-auto"
                >
                  <Link href={task.actionHref}>
                    <UploadCloud className="h-4 w-4" />
                    {task.status === "done" ? "Train again" : "Start task"}
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenDetail(task)}
                  className="min-h-10 w-full justify-center rounded-full border-white/10 bg-white/[0.03] px-4 text-white hover:bg-white/[0.08] sm:w-auto"
                >
                  <Eye className="h-4 w-4" />
                  Details
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!task.candidateReportId || submittingTaskId === task.id}
                  onClick={() => handleSubmit(task)}
                  className="min-h-10 w-full justify-center rounded-full border-white/10 bg-white/[0.03] px-4 text-white hover:bg-white/[0.08] sm:w-auto"
                  title={task.candidateReportLabel ?? "No matching report found"}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {submittingTaskId === task.id ? "Submitting" : "Use selected report"}
                </Button>
                {task.latestReportId ? (
                  <span className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">
                    Report linked
                  </span>
                ) : null}
              </div>
              {taskSubmitError ? (
                <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-xs leading-5 text-rose-100/80">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{taskSubmitError}</span>
                </div>
              ) : null}
            </article>
          );
        })}
        {tasks.length === 0 ? (
          <div className="rounded-[24px] border border-white/10 bg-black/18 px-4 py-8 text-center">
            <div className="text-sm font-semibold text-white">No coach tasks assigned.</div>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/50">
              New weekly work will appear here as soon as your coach publishes it.
            </p>
          </div>
        ) : null}
        </div>
      </div>

      {selectedTask ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 py-5 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="task-detail-title"
          onClick={() => setSelectedTaskId(null)}
        >
          <div
            className="analysis-surface flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-white/12 bg-[#090b10] shadow-[0_28px_90px_rgba(0,0,0,0.45)] sm:max-h-[calc(100dvh-3rem)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
              <div>
                <div className="text-[0.7rem] uppercase tracking-[0.28em] text-white/42">
                  Task detail
                </div>
                <h3 id="task-detail-title" className="mt-2 text-2xl font-semibold text-white">
                  {selectedTask.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/58">
                  {selectedTask.description}
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08]"
                onClick={() => setSelectedTaskId(null)}
                aria-label="Close task detail"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="text-[0.68rem] uppercase tracking-[0.24em] text-white/38">
                    Class
                  </div>
                  <div className="mt-2 text-sm font-medium text-white">{selectedTask.className}</div>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="text-[0.68rem] uppercase tracking-[0.24em] text-white/38">
                    Template
                  </div>
                  <div className="mt-2 text-sm font-medium text-white">
                    {selectedTask.templateName}
                  </div>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="text-[0.68rem] uppercase tracking-[0.24em] text-white/38">
                    Target
                  </div>
                  <div className="mt-2 text-sm font-medium text-white">
                    {selectedTask.targetLabel}
                  </div>
                </div>
                <div className="rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div className="text-[0.68rem] uppercase tracking-[0.24em] text-white/38">
                    Progress
                  </div>
                  <div className="mt-2 text-sm font-medium text-white">
                    {Math.round(selectedTask.progress * 100)}% / {selectedTask.progressDetailLabel}
                  </div>
                  {selectedTask.scoreGateLabel ? (
                    <div className="mt-1 text-xs leading-5 text-white/48">
                      {selectedTask.scoreGateLabel}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.24em] text-white/42">
                    <History className="h-4 w-4" />
                    Submission history
                  </div>
                  {isSelectedDetailLoading ? (
                    <span className="text-xs text-white/45">Loading</span>
                  ) : null}
                </div>

                {selectedDetailError ? (
                  <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-3 py-3">
                    <div className="flex items-start gap-2 text-sm leading-6 text-rose-100/78">
                      <AlertCircle className="mt-1 h-4 w-4 shrink-0" />
                      <span>{selectedDetailError}</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onRequestTaskDetail?.(selectedTask)}
                      className="mt-3 min-h-9 rounded-full border-rose-100/20 bg-rose-100/10 px-3 text-xs text-rose-50 hover:bg-rose-100/15"
                    >
                      Try loading again
                    </Button>
                  </div>
                ) : isSelectedDetailLoading ? (
                  <div className="mt-4 h-16 rounded-2xl border border-white/8 bg-black/20" />
                ) : selectedSubmissionHistory.length > 0 ? (
                  <div className="mt-4 max-h-56 overflow-y-auto pr-1">
                    <div className="grid gap-2">
                      {selectedSubmissionHistory.map((submission) => (
                        <div
                          key={submission.id}
                          className="flex flex-col gap-2 rounded-2xl border border-white/8 bg-black/18 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-white">
                              {submission.title}
                            </div>
                            <div className="mt-1 text-xs text-white/42">
                              {submission.dateLabel}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/60">
                            <span>{submission.scoreLabel}</span>
                            <span>{submission.gradeLabel}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 rounded-2xl border border-white/8 bg-black/18 px-3 py-3 text-sm leading-6 text-white/48">
                    No submitted reports yet.
                  </p>
                )}
              </div>

              {selectedSubmitError ? (
                <div className="mt-5 rounded-[20px] border border-rose-300/20 bg-rose-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-100/80" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-rose-100">Submit failed</div>
                      <p className="mt-1 text-sm leading-6 text-rose-100/72">
                        {selectedSubmitError}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={selectedTask.reportOptions.length === 0 || submittingTaskId === selectedTask.id}
                    onClick={() => handleSubmit(selectedTask)}
                    className="mt-3 min-h-10 rounded-full border-rose-100/20 bg-rose-100/10 px-4 text-rose-50 hover:bg-rose-100/15"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {submittingTaskId === selectedTask.id ? "Retrying" : "Try again"}
                  </Button>
                </div>
              ) : null}

              <div className="mt-5 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <label
                  htmlFor="task-report-select"
                  className="text-[0.7rem] uppercase tracking-[0.24em] text-white/42"
                >
                  Matching report
                </label>
                <select
                  id="task-report-select"
                  value={getSelectedReportId(selectedTask)}
                  onChange={(event) =>
                    setSelectedReportByTask((current) => ({
                      ...current,
                      [selectedTask.id]: event.target.value,
                    }))
                  }
                  disabled={selectedTask.reportOptions.length === 0}
                  className="mt-3 min-h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-[#d8ff5d]/40"
                >
                  {selectedTask.reportOptions.length > 0 ? (
                    selectedTask.reportOptions.map((report) => (
                      <option key={report.id} value={report.id} className="bg-[#090b10] text-white">
                        {report.label} - {report.scoreLabel} - {report.dateLabel}
                      </option>
                    ))
                  ) : (
                    <option value="" className="bg-[#090b10] text-white">
                      No matching completed report
                    </option>
                  )}
                </select>
                <p className="mt-3 text-xs leading-5 text-white/45">
                  Reports are filtered by this task analysis type and template.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-white/10 bg-[#090b10]/96 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
              <Button
                asChild
                className="min-h-11 rounded-full border border-[#d8ff5d]/20 bg-[#d8ff5d] px-4 text-slate-950 hover:bg-[#e8ff9a]"
              >
                <Link href={selectedTask.actionHref}>
                  <UploadCloud className="h-4 w-4" />
                  Start task upload
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={selectedTask.reportOptions.length === 0 || submittingTaskId === selectedTask.id}
                onClick={() => handleSubmit(selectedTask)}
                className="min-h-11 rounded-full border-white/10 bg-white/[0.03] px-4 text-white hover:bg-white/[0.08]"
              >
                <CheckCircle2 className="h-4 w-4" />
                {submittingTaskId === selectedTask.id ? "Submitting" : "Submit selected report"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
