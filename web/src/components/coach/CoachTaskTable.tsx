"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ClipboardList, Eye, Loader2, Lock, Pencil, RotateCcw, Save, X } from "lucide-react";

import {
  analysisTypeLabels,
  formatDateTime,
  formatScore,
  getTemplateDisplayName,
} from "@/components/coach/coachUtils";
import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";
import {
  coachService,
  type CoachTaskDetailRead,
  type CoachTaskRead,
  type CoachUpdateTaskPayload,
} from "@/services/coach";
import type { ReportAnalysisType } from "@/services/reports";

type CoachTaskTableProps = {
  classPublicId: string;
  tasks: CoachTaskRead[];
  updatingTaskId: string | null;
  selectedTaskIds: string[];
  onSelectedTaskIdsChange: (ids: string[]) => void;
  onStatusChange: (task: CoachTaskRead, status: string) => void;
  onPatch: (task: CoachTaskRead, patch: CoachUpdateTaskPayload) => Promise<void>;
};

const analysisTypes: ReportAnalysisType[] = ["shooting", "dribbling", "training", "comprehensive"];
const fieldClass =
  "min-h-10 w-full rounded-lg border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#65f7ff]/46 focus:bg-black/34 focus:ring-2 focus:ring-[#65f7ff]/12";
const labelClass = "text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/46";

function statusTone(status: string) {
  if (status === "closed" || status === "archived") {
    return "border-white/10 bg-white/[0.04] text-white/48";
  }

  if (status === "completed") {
    return "border-[#d8ff5d]/24 bg-[#d8ff5d]/10 text-[#e8ff9a]";
  }

  return "border-[#65f7ff]/24 bg-[#65f7ff]/10 text-[#dffbff]";
}

function toDateTimeLocal(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 16);
}

function toApiDate(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function targetNumber(task: CoachTaskRead, key: "target_sessions" | "target_score") {
  const value = task.target_config?.[key];
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

export function CoachTaskTable({
  classPublicId,
  tasks,
  updatingTaskId,
  selectedTaskIds,
  onSelectedTaskIdsChange,
  onStatusChange,
  onPatch,
}: CoachTaskTableProps) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [taskDetail, setTaskDetail] = useState<CoachTaskDetailRead | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAnalysisType, setEditAnalysisType] = useState<ReportAnalysisType>("shooting");
  const [editTemplateCode, setEditTemplateCode] = useState("");
  const [editTargetSessions, setEditTargetSessions] = useState("");
  const [editTargetScore, setEditTargetScore] = useState("");
  const [editStatus, setEditStatus] = useState("published");
  const [editPublishAt, setEditPublishAt] = useState("");
  const [editStartAt, setEditStartAt] = useState("");
  const [editDueAt, setEditDueAt] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const beginEdit = (task: CoachTaskRead) => {
    setEditingTaskId(task.public_id);
    setEditTitle(task.title);
    setEditDescription(task.description || "");
    setEditAnalysisType(task.analysis_type || "shooting");
    setEditTemplateCode(task.template_code || "");
    setEditTargetSessions(targetNumber(task, "target_sessions"));
    setEditTargetScore(targetNumber(task, "target_score"));
    setEditStatus(task.status);
    setEditPublishAt(toDateTimeLocal(task.publish_at));
    setEditStartAt(toDateTimeLocal(task.start_at));
    setEditDueAt(toDateTimeLocal(task.due_at));
  };

  const toggleSelected = (taskPublicId: string, checked: boolean) => {
    if (checked) {
      onSelectedTaskIdsChange([...new Set([...selectedTaskIds, taskPublicId])]);
      return;
    }
    onSelectedTaskIdsChange(selectedTaskIds.filter((id) => id !== taskPublicId));
  };

  const submitEdit = async (event: React.FormEvent<HTMLFormElement>, task: CoachTaskRead) => {
    event.preventDefault();
    setIsSavingEdit(true);
    try {
      const targetConfig: Record<string, number> = {};
      const sessions = Number(editTargetSessions);
      const score = Number(editTargetScore);
      if (Number.isFinite(sessions) && sessions > 0) {
        targetConfig.target_sessions = sessions;
      }
      if (Number.isFinite(score) && score > 0) {
        targetConfig.target_score = score;
      }

      await onPatch(task, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        analysis_type: editAnalysisType,
        template_code: editTemplateCode.trim() || null,
        target_config: Object.keys(targetConfig).length > 0 ? targetConfig : null,
        status: editStatus,
        publish_at: toApiDate(editPublishAt),
        start_at: toApiDate(editStartAt),
        due_at: toApiDate(editDueAt),
      });
      setEditingTaskId(null);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const inspectTask = async (task: CoachTaskRead) => {
    if (expandedTaskId === task.public_id) {
      setExpandedTaskId(null);
      return;
    }

    setExpandedTaskId(task.public_id);
    setTaskDetail(null);
    setDetailError(null);
    setIsLoadingDetail(true);

    try {
      const detail = await coachService.getClassTask(classPublicId, task.public_id);
      setTaskDetail(detail);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Unable to load task detail.");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/18 p-8 text-center">
        <ClipboardList className="mx-auto h-8 w-8 text-[#65f7ff]/70" />
        <div className="mt-4 font-[var(--font-display)] text-lg font-semibold text-white">
          No training tasks yet.
        </div>
        <p className="mt-2 text-sm text-white/52">Published tasks will appear here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-black/18">
      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full border-collapse text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.035] text-[0.68rem] uppercase tracking-[0.18em] text-white/42">
            <tr>
              <th className="px-4 py-3 font-semibold">Pick</th>
              <th className="px-4 py-3 font-semibold">Task</th>
              <th className="px-4 py-3 font-semibold">Motion</th>
              <th className="px-4 py-3 text-right font-semibold">Progress</th>
              <th className="px-4 py-3 font-semibold">Due</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {tasks.map((task) => {
              const isUpdating = updatingTaskId === task.public_id;
              const isClosed = task.status === "closed" || task.status === "archived";
              const progress =
                task.assignment_count > 0
                  ? Math.round((task.completed_assignment_count / task.assignment_count) * 100)
                  : 0;

              return (
                <Fragment key={task.public_id}>
                  <tr className="transition-colors hover:bg-[#65f7ff]/[0.055]">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedTaskIds.includes(task.public_id)}
                        onChange={(event) => toggleSelected(task.public_id, event.target.checked)}
                        className="h-4 w-4 accent-[#d8ff5d]"
                        aria-label={`Select ${task.title}`}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-white">{task.title}</div>
                      <div className="mt-1 max-w-[22rem] truncate text-xs text-white/42">
                        {task.description || "No description"}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-white/62">
                      <div>{task.analysis_type ? analysisTypeLabels[task.analysis_type] : "Any"}</div>
                      <div className="mt-1 max-w-[16rem] truncate text-xs text-white/38">
                        {task.template_code ? getTemplateDisplayName(task.template_code) : "No template"}
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
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em]",
                          statusTone(task.status),
                        )}
                      >
                        {task.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => inspectTask(task)}
                          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 text-xs font-semibold text-white/78 transition hover:border-[#65f7ff]/32 hover:bg-[#65f7ff]/10"
                        >
                          <Eye className="h-4 w-4" />
                          Detail
                        </button>
                        <button
                          type="button"
                          onClick={() => beginEdit(task)}
                          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/24 bg-[#65f7ff]/10 px-3 text-xs font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/16"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => onStatusChange(task, isClosed ? "published" : "closed")}
                          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#d8ff5d]/24 bg-[#d8ff5d]/10 px-3 text-xs font-semibold text-[#f1ffc1] transition hover:bg-[#d8ff5d]/16 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isUpdating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isClosed ? (
                            <RotateCcw className="h-4 w-4" />
                          ) : (
                            <Lock className="h-4 w-4" />
                          )}
                          {isClosed ? "Reopen" : "Close"}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedTaskId === task.public_id ? (
                    <tr className="bg-white/[0.025]">
                      <td colSpan={7} className="px-4 py-4">
                        {isLoadingDetail ? (
                          <div className="flex items-center gap-2 text-sm text-white/58">
                            <Loader2 className="h-4 w-4 animate-spin text-[#65f7ff]" />
                            Loading assignment detail
                          </div>
                        ) : detailError ? (
                          <div className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                            {detailError}
                          </div>
                        ) : taskDetail ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            {taskDetail.assignments.map((assignment) => (
                              <div
                                key={assignment.public_id}
                                className="rounded-lg border border-white/10 bg-black/22 p-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="font-semibold text-white">
                                      {assignment.student_name}
                                    </div>
                                    <div className="mt-1 text-xs text-white/42">
                                      {assignment.completed_sessions} sessions / best{" "}
                                      {formatScore(assignment.best_score)}
                                    </div>
                                  </div>
                                  <span className="rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-white/62">
                                    {assignment.status}
                                  </span>
                                </div>
                                <div className="mt-3 flex items-center justify-between text-xs text-white/44">
                                  <span>{formatDateTime(assignment.last_submission_at)}</span>
                                  {assignment.latest_report_public_id ? (
                                    <Link
                                      href={`${routes.pose2d.report}?id=${assignment.latest_report_public_id}`}
                                      className="text-[#65f7ff] hover:text-[#d8ff5d]"
                                    >
                                      Open report
                                    </Link>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ) : null}
                  {editingTaskId === task.public_id ? (
                    <tr className="bg-[#65f7ff]/[0.035]">
                      <td colSpan={7} className="px-4 py-4">
                        <form className="grid gap-4 lg:grid-cols-2" onSubmit={(event) => submitEdit(event, task)}>
                          <label className="block space-y-2">
                            <span className={labelClass}>Title</span>
                            <input className={fieldClass} value={editTitle} onChange={(event) => setEditTitle(event.target.value)} required />
                          </label>
                          <label className="block space-y-2">
                            <span className={labelClass}>Status</span>
                            <select className={fieldClass} value={editStatus} onChange={(event) => setEditStatus(event.target.value)}>
                              <option value="draft">draft</option>
                              <option value="published">published</option>
                              <option value="closed">closed</option>
                              <option value="archived">archived</option>
                            </select>
                          </label>
                          <label className="block space-y-2 lg:col-span-2">
                            <span className={labelClass}>Description</span>
                            <textarea className={`${fieldClass} min-h-20 resize-none py-3`} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
                          </label>
                          <label className="block space-y-2">
                            <span className={labelClass}>Motion</span>
                            <select className={fieldClass} value={editAnalysisType} onChange={(event) => setEditAnalysisType(event.target.value as ReportAnalysisType)}>
                              {analysisTypes.map((type) => (
                                <option key={type} value={type}>
                                  {analysisTypeLabels[type]}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block space-y-2">
                            <span className={labelClass}>Template code</span>
                            <input className={fieldClass} value={editTemplateCode} onChange={(event) => setEditTemplateCode(event.target.value)} />
                          </label>
                          <label className="block space-y-2">
                            <span className={labelClass}>Sessions</span>
                            <input className={fieldClass} value={editTargetSessions} onChange={(event) => setEditTargetSessions(event.target.value)} inputMode="numeric" />
                          </label>
                          <label className="block space-y-2">
                            <span className={labelClass}>Score</span>
                            <input className={fieldClass} value={editTargetScore} onChange={(event) => setEditTargetScore(event.target.value)} inputMode="numeric" />
                          </label>
                          <label className="block space-y-2">
                            <span className={labelClass}>Publish</span>
                            <input className={fieldClass} type="datetime-local" value={editPublishAt} onChange={(event) => setEditPublishAt(event.target.value)} />
                          </label>
                          <label className="block space-y-2">
                            <span className={labelClass}>Start</span>
                            <input className={fieldClass} type="datetime-local" value={editStartAt} onChange={(event) => setEditStartAt(event.target.value)} />
                          </label>
                          <label className="block space-y-2">
                            <span className={labelClass}>Due</span>
                            <input className={fieldClass} type="datetime-local" value={editDueAt} onChange={(event) => setEditDueAt(event.target.value)} />
                          </label>
                          <div className="flex items-end justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingTaskId(null)}
                              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-4 text-sm font-semibold text-white/70 transition hover:bg-white/[0.08]"
                            >
                              <X className="h-4 w-4" />
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isSavingEdit}
                              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#d8ff5d]/24 bg-[#d8ff5d]/10 px-4 text-sm font-semibold text-[#f1ffc1] transition hover:bg-[#d8ff5d]/16 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isSavingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                              Save task
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
