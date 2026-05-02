"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Archive,
  ClipboardList,
  Filter,
  Loader2,
  Megaphone,
  Pin,
  PinOff,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import { CoachReportTable } from "@/components/coach/CoachReportTable";
import { CoachShell } from "@/components/coach/CoachShell";
import { CoachStudentTable } from "@/components/coach/CoachStudentTable";
import { CoachAnnouncementTable } from "@/components/coach/CoachAnnouncementTable";
import { CoachTaskTable } from "@/components/coach/CoachTaskTable";
import { CreateAnnouncementPanel } from "@/components/coach/CreateAnnouncementPanel";
import { CreateTaskPanel } from "@/components/coach/CreateTaskPanel";
import { formatDate, formatScore, getClassStatusTone } from "@/components/coach/coachUtils";
import { cn } from "@/lib/utils";
import {
  coachService,
  type CoachClassRead,
  type CoachClassReportRead,
  type CoachAnnouncementRead,
  type CoachAnnouncementFilters,
  type CoachUpdateAnnouncementPayload,
  type CoachStudentRead,
  type CoachTaskFilters,
  type CoachTaskRead,
  type CoachUpdateTaskPayload,
} from "@/services/coach";
import type { ReportAnalysisType } from "@/services/reports";
import { useAuthStore } from "@/store/authStore";

type TabId = "students" | "reports" | "tasks" | "announcements";
type ComposerId = "task" | "announcement";

const filterFieldClass =
  "min-h-10 rounded-lg border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#65f7ff]/46 focus:bg-black/34 focus:ring-2 focus:ring-[#65f7ff]/12";
const analysisFilterOptions: Array<{ value: "" | ReportAnalysisType; label: string }> = [
  { value: "", label: "All motions" },
  { value: "shooting", label: "Shooting" },
  { value: "dribbling", label: "Dribbling" },
  { value: "training", label: "Training" },
  { value: "comprehensive", label: "Comprehensive" },
];

function toApiDate(value: string) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function CountUp({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (value === null) {
      setDisplayValue(0);
      return;
    }

    let frame = 0;
    let animationFrame = 0;
    const durationFrames = 34;

    const animate = () => {
      frame += 1;
      const progress = Math.min(frame / durationFrames, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(value * eased);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [value]);

  if (value === null) {
    return <>--</>;
  }

  return (
    <>
      {Math.round(displayValue)}
      {suffix}
    </>
  );
}

function HeroMetric({
  label,
  value,
  helper,
  suffix,
}: {
  label: string;
  value: number | null;
  helper: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/18 p-4">
      <div className="text-[0.68rem] uppercase tracking-[0.18em] text-white/42">{label}</div>
      <div className="mt-3 font-[var(--font-display)] text-3xl font-bold text-[#d8ff5d]">
        <CountUp value={value} suffix={suffix} />
      </div>
      <div className="mt-2 text-xs leading-5 text-white/48">{helper}</div>
    </div>
  );
}

function CoachDetailLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#030712] text-white">
      <div className="rounded-lg border border-white/10 bg-white/[0.055] px-8 py-7 text-center shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
        <Loader2 className="mx-auto h-9 w-9 animate-spin text-[#65f7ff]" />
        <div className="mt-4 text-[0.72rem] uppercase tracking-[0.28em] text-white/48">
          Loading class telemetry
        </div>
      </div>
    </main>
  );
}

export default function CoachClassDetailPage() {
  const params = useParams<{ classPublicId: string }>();
  const classPublicId = params.classPublicId;
  const user = useAuthStore((state) => state.user);
  const hasInitialized = useAuthStore((state) => state.hasInitialized);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const [classItem, setClassItem] = useState<CoachClassRead | null>(null);
  const [students, setStudents] = useState<CoachStudentRead[]>([]);
  const [reports, setReports] = useState<CoachClassReportRead[]>([]);
  const [tasks, setTasks] = useState<CoachTaskRead[]>([]);
  const [announcements, setAnnouncements] = useState<CoachAnnouncementRead[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("students");
  const [activeComposer, setActiveComposer] = useState<ComposerId>("task");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activityMessage, setActivityMessage] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [updatingAnnouncementId, setUpdatingAnnouncementId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectedAnnouncementIds, setSelectedAnnouncementIds] = useState<string[]>([]);
  const [taskStatusFilter, setTaskStatusFilter] = useState("");
  const [taskAnalysisFilter, setTaskAnalysisFilter] = useState<"" | ReportAnalysisType>("");
  const [taskKeywordFilter, setTaskKeywordFilter] = useState("");
  const [taskFromFilter, setTaskFromFilter] = useState("");
  const [taskToFilter, setTaskToFilter] = useState("");
  const [announcementStatusFilter, setAnnouncementStatusFilter] = useState("");
  const [announcementPinnedFilter, setAnnouncementPinnedFilter] = useState("");
  const [announcementKeywordFilter, setAnnouncementKeywordFilter] = useState("");
  const [announcementFromFilter, setAnnouncementFromFilter] = useState("");
  const [announcementToFilter, setAnnouncementToFilter] = useState("");
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const canAccessCoach = user?.role === "coach" || user?.role === "admin";

  useEffect(() => {
    if (!hasInitialized || !user || !canAccessCoach || !classPublicId) {
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      coachService.listClasses(),
      coachService.listClassStudents(classPublicId),
      coachService.listClassReports(classPublicId, 50),
      coachService.listClassTasks(classPublicId, { limit: 50 }),
      coachService.listClassAnnouncements(classPublicId, { limit: 50 }),
    ])
      .then(([classesResponse, studentsResponse, reportsResponse, tasksResponse, announcementsResponse]) => {
        if (!isActive) {
          return;
        }

        const currentClass =
          classesResponse.items.find((item) => item.public_id === classPublicId) ?? null;

        setClassItem(currentClass);
        setStudents(studentsResponse.items);
        setReports(reportsResponse.items);
        setTasks(tasksResponse.items);
        setAnnouncements(announcementsResponse.items);
        if (!currentClass) {
          setError("Class not found.");
        }
      })
      .catch((fetchError) => {
        if (!isActive) {
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load class.");
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [canAccessCoach, classPublicId, hasInitialized, user]);

  const summary = useMemo(() => {
    const scores = reports
      .map((report) => report.overall_score)
      .filter((score): score is number => typeof score === "number" && Number.isFinite(score));
    const bestScore = scores.length > 0 ? Math.max(...scores) : null;
    const averageScore =
      scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
    const recentReports = reports.filter((report) => {
      const createdAt = new Date(report.created_at).getTime();
      return Date.now() - createdAt <= 7 * 24 * 60 * 60 * 1000;
    }).length;

    return {
      bestScore,
      averageScore,
      recentReports,
      openTasks: tasks.filter((task) => task.status !== "closed" && task.status !== "archived").length,
      pinnedAnnouncements: announcements.filter((announcement) => announcement.is_pinned).length,
    };
  }, [announcements, reports, tasks]);

  const buildTaskFilters = (): CoachTaskFilters => ({
    limit: 50,
    status: taskStatusFilter || undefined,
    analysis_type: taskAnalysisFilter || undefined,
    keyword: taskKeywordFilter.trim() || undefined,
    from_date: toApiDate(taskFromFilter),
    to_date: toApiDate(taskToFilter),
  });

  const buildAnnouncementFilters = (): CoachAnnouncementFilters => ({
    limit: 50,
    status: announcementStatusFilter || undefined,
    is_pinned:
      announcementPinnedFilter === "pinned"
        ? true
        : announcementPinnedFilter === "unpinned"
          ? false
          : undefined,
    keyword: announcementKeywordFilter.trim() || undefined,
    from_date: toApiDate(announcementFromFilter),
    to_date: toApiDate(announcementToFilter),
  });

  const refreshTasks = async () => {
    const response = await coachService.listClassTasks(classPublicId, buildTaskFilters());
    setTasks(response.items);
    setSelectedTaskIds((current) =>
      current.filter((id) => response.items.some((task) => task.public_id === id)),
    );
  };

  const refreshAnnouncements = async () => {
    const response = await coachService.listClassAnnouncements(
      classPublicId,
      buildAnnouncementFilters(),
    );
    setAnnouncements(response.items);
    setSelectedAnnouncementIds((current) =>
      current.filter((id) =>
        response.items.some((announcement) => announcement.public_id === id),
      ),
    );
  };

  const applyTaskFilters = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      await refreshTasks();
    } catch (filterError) {
      setError(filterError instanceof Error ? filterError.message : "Unable to filter tasks.");
    }
  };

  const applyAnnouncementFilters = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      await refreshAnnouncements();
    } catch (filterError) {
      setError(
        filterError instanceof Error ? filterError.message : "Unable to filter announcements.",
      );
    }
  };

  const handleTaskStatusChange = async (task: CoachTaskRead, status: string) => {
    setUpdatingTaskId(task.public_id);
    setError(null);

    try {
      const updatedTask = await coachService.updateClassTask(classPublicId, task.public_id, {
        status,
      });
      setTasks((currentTasks) =>
        currentTasks.map((item) => (item.public_id === task.public_id ? updatedTask : item)),
      );
      setActivityMessage(`Task "${updatedTask.title}" moved to ${updatedTask.status}.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update task.");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleTaskPatch = async (task: CoachTaskRead, patch: CoachUpdateTaskPayload) => {
    setUpdatingTaskId(task.public_id);
    setError(null);

    try {
      const updatedTask = await coachService.updateClassTask(classPublicId, task.public_id, patch);
      setTasks((currentTasks) =>
        currentTasks.map((item) => (item.public_id === task.public_id ? updatedTask : item)),
      );
      setActivityMessage(`Task "${updatedTask.title}" updated.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update task.");
      throw updateError;
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const bulkUpdateTasks = async (status: string) => {
    if (selectedTaskIds.length === 0) {
      return;
    }
    setIsBulkUpdating(true);
    setError(null);

    try {
      const response = await coachService.bulkUpdateClassTasks(classPublicId, {
        task_public_ids: selectedTaskIds,
        status,
      });
      const updatedById = new Map(response.items.map((task) => [task.public_id, task]));
      setTasks((currentTasks) =>
        currentTasks.map((task) => updatedById.get(task.public_id) ?? task),
      );
      setSelectedTaskIds([]);
      setActivityMessage(`${response.items.length} tasks moved to ${status}.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to bulk update tasks.");
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleAnnouncementPatch = async (
    announcement: CoachAnnouncementRead,
    patch: CoachUpdateAnnouncementPayload,
  ) => {
    setUpdatingAnnouncementId(announcement.public_id);
    setError(null);

    try {
      const updatedAnnouncement = await coachService.updateClassAnnouncement(
        classPublicId,
        announcement.public_id,
        patch,
      );
      setAnnouncements((currentAnnouncements) =>
        currentAnnouncements.map((item) =>
          item.public_id === announcement.public_id ? updatedAnnouncement : item,
        ),
      );
      setActivityMessage(`Announcement "${updatedAnnouncement.title}" updated.`);
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "Unable to update announcement.",
      );
    } finally {
      setUpdatingAnnouncementId(null);
    }
  };

  const bulkUpdateAnnouncements = async (patch: { status?: string; is_pinned?: boolean }) => {
    if (selectedAnnouncementIds.length === 0) {
      return;
    }
    setIsBulkUpdating(true);
    setError(null);

    try {
      const response = await coachService.bulkUpdateClassAnnouncements(classPublicId, {
        announcement_public_ids: selectedAnnouncementIds,
        ...patch,
      });
      const updatedById = new Map(
        response.items.map((announcement) => [announcement.public_id, announcement]),
      );
      setAnnouncements((currentAnnouncements) =>
        currentAnnouncements.map((announcement) =>
          updatedById.get(announcement.public_id) ?? announcement,
        ),
      );
      setSelectedAnnouncementIds([]);
      setActivityMessage(`${response.items.length} announcements updated.`);
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "Unable to bulk update announcements.",
      );
    } finally {
      setIsBulkUpdating(false);
    }
  };

  if (!hasInitialized || isInitializing || !user) {
    return <CoachDetailLoading />;
  }

  if (!canAccessCoach) {
    return (
      <CoachShell user={user} title="Coach access required" breadcrumb={["Access"]}>
        <section className="rounded-lg border border-red-400/20 bg-red-500/10 p-8 text-center backdrop-blur-2xl">
          <ShieldAlert className="mx-auto h-10 w-10 text-red-200" />
          <h2 className="mt-5 font-[var(--font-display)] text-2xl font-bold text-white">
            This workspace is available to coaches only.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/58">
            Current role: {user.role}. Ask an administrator to assign coach or admin access.
          </p>
        </section>
      </CoachShell>
    );
  }

  const title = classItem?.name ?? "Class Detail";

  const focusComposer = (composer: ComposerId) => {
    setActiveComposer(composer);
    window.setTimeout(() => {
      document.getElementById("coach-composer")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 30);
  };

  return (
    <CoachShell user={user} title={title} breadcrumb={["Classes", title]}>
      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="rounded-lg border border-white/10 bg-white/[0.055] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em]",
                  getClassStatusTone(classItem?.status ?? "loading"),
                )}
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                {classItem?.status ?? "loading"}
              </span>
              <span className="rounded-full border border-[#65f7ff]/24 bg-[#65f7ff]/10 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#dffbff]">
                {classItem?.code ?? "Class"}
              </span>
            </div>
            <h1 className="mt-4 font-[var(--font-display)] text-4xl font-bold tracking-[0.01em] text-white sm:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-white/58">
              {classItem?.description ||
                "Review student telemetry, inspect reports, and publish class operations."}
            </p>
            <div className="mt-4 text-sm text-white/44">
              {formatDate(classItem?.start_date)} to {formatDate(classItem?.end_date)}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => focusComposer("task")}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/34 bg-[#65f7ff]/12 px-4 text-sm font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/18"
            >
              <ClipboardList className="h-4 w-4" />
              Publish task
            </button>
            <button
              type="button"
              onClick={() => focusComposer("announcement")}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#d8ff5d]/32 bg-[#d8ff5d]/10 px-4 text-sm font-semibold text-[#f1ffc1] transition hover:bg-[#d8ff5d]/16"
            >
              <Megaphone className="h-4 w-4" />
              Publish announcement
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <HeroMetric label="Students" value={students.length} helper="Active class roster" />
          <HeroMetric label="Reports" value={reports.length} helper="Latest 50 records" />
          <HeroMetric
            label="7-day reports"
            value={summary.recentReports}
            helper="Recent submitted reports"
          />
          <HeroMetric
            label="Best score"
            value={summary.bestScore}
            helper={`Average ${formatScore(summary.averageScore)}`}
          />
          <HeroMetric label="Open tasks" value={summary.openTasks} helper="Published work queue" />
          <HeroMetric
            label="Pinned notices"
            value={summary.pinnedAnnouncements}
            helper="Top of class channel"
          />
        </div>
      </section>

      {activityMessage ? (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-lg border border-[#d8ff5d]/24 bg-[#d8ff5d]/10 px-4 py-3 text-sm font-medium text-[#efffb8]"
        >
          <Sparkles className="h-4 w-4" />
          {activityMessage}
        </motion.div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <section className="min-w-0 rounded-lg border border-white/10 bg-white/[0.055] p-5 backdrop-blur-2xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[0.68rem] uppercase tracking-[0.22em] text-white/42">
                Class telemetry
              </div>
              <h2 className="mt-2 font-[var(--font-display)] text-2xl font-bold text-white">
                Operations and telemetry
              </h2>
            </div>
            {isLoading ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/18 px-3 py-2 text-sm text-white/58">
                <Loader2 className="h-4 w-4 animate-spin text-[#65f7ff]" />
                Loading
              </span>
            ) : null}
          </div>

          <div className="mt-5 flex gap-2 border-b border-white/10">
            {[
              { id: "students" as const, label: "Class students", count: students.length },
              { id: "reports" as const, label: "Recent reports", count: reports.length },
              { id: "tasks" as const, label: "Tasks", count: tasks.length },
              {
                id: "announcements" as const,
                label: "Announcements",
                count: announcements.length,
              },
            ].map((tab) => {
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative min-h-12 px-3 text-sm font-semibold transition",
                    isActive ? "text-white" : "text-white/48 hover:text-white/78",
                  )}
                >
                  <span className="relative z-10">
                    {tab.label} <span className="text-white/34">{tab.count}</span>
                  </span>
                  {isActive ? (
                    <motion.span
                      layoutId="coach-detail-tab"
                      className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#65f7ff] shadow-[0_0_18px_rgba(101,247,255,0.7)]"
                      transition={{ type: "spring", stiffness: 360, damping: 32 }}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <AnimatePresence mode="wait">
              {activeTab === "students" ? (
                <motion.div
                  key="students"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                >
                  <CoachStudentTable students={students} />
                </motion.div>
              ) : activeTab === "reports" ? (
                <motion.div
                  key="reports"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                >
                  <CoachReportTable reports={reports} />
                </motion.div>
              ) : activeTab === "tasks" ? (
                <motion.div
                  key="tasks"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                >
                  <form
                    className="mb-4 rounded-lg border border-white/10 bg-black/14 p-3"
                    onSubmit={applyTaskFilters}
                  >
                    <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.2fr_1fr_1fr_auto]">
                      <select
                        className={filterFieldClass}
                        value={taskStatusFilter}
                        onChange={(event) => setTaskStatusFilter(event.target.value)}
                        aria-label="Task status filter"
                      >
                        <option value="">All status</option>
                        <option value="draft">draft</option>
                        <option value="published">published</option>
                        <option value="closed">closed</option>
                        <option value="archived">archived</option>
                      </select>
                      <select
                        className={filterFieldClass}
                        value={taskAnalysisFilter}
                        onChange={(event) =>
                          setTaskAnalysisFilter(event.target.value as "" | ReportAnalysisType)
                        }
                        aria-label="Task motion filter"
                      >
                        {analysisFilterOptions.map((option) => (
                          <option key={option.value || "all"} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <input
                        className={filterFieldClass}
                        value={taskKeywordFilter}
                        onChange={(event) => setTaskKeywordFilter(event.target.value)}
                        placeholder="Search task"
                      />
                      <input
                        className={filterFieldClass}
                        type="datetime-local"
                        value={taskFromFilter}
                        onChange={(event) => setTaskFromFilter(event.target.value)}
                        aria-label="Task from due date"
                      />
                      <input
                        className={filterFieldClass}
                        type="datetime-local"
                        value={taskToFilter}
                        onChange={(event) => setTaskToFilter(event.target.value)}
                        aria-label="Task to due date"
                      />
                      <button
                        type="submit"
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/24 bg-[#65f7ff]/10 px-3 text-xs font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/16"
                      >
                        <Filter className="h-4 w-4" />
                        Filter
                      </button>
                    </div>
                    {selectedTaskIds.length > 0 ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3 text-sm text-white/58">
                        <span>{selectedTaskIds.length} selected</span>
                        <button
                          type="button"
                          disabled={isBulkUpdating}
                          onClick={() => bulkUpdateTasks("closed")}
                          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#d8ff5d]/24 bg-[#d8ff5d]/10 px-3 text-xs font-semibold text-[#f1ffc1] transition hover:bg-[#d8ff5d]/16 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Archive className="h-4 w-4" />
                          Close selected
                        </button>
                      </div>
                    ) : null}
                  </form>
                  <CoachTaskTable
                    classPublicId={classPublicId}
                    tasks={tasks}
                    updatingTaskId={updatingTaskId}
                    selectedTaskIds={selectedTaskIds}
                    onSelectedTaskIdsChange={setSelectedTaskIds}
                    onStatusChange={handleTaskStatusChange}
                    onPatch={handleTaskPatch}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="announcements"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                >
                  <form
                    className="mb-4 rounded-lg border border-white/10 bg-black/14 p-3"
                    onSubmit={applyAnnouncementFilters}
                  >
                    <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.2fr_1fr_1fr_auto]">
                      <select
                        className={filterFieldClass}
                        value={announcementStatusFilter}
                        onChange={(event) => setAnnouncementStatusFilter(event.target.value)}
                        aria-label="Announcement status filter"
                      >
                        <option value="">All status</option>
                        <option value="draft">draft</option>
                        <option value="published">published</option>
                        <option value="expired">expired</option>
                        <option value="archived">archived</option>
                      </select>
                      <select
                        className={filterFieldClass}
                        value={announcementPinnedFilter}
                        onChange={(event) => setAnnouncementPinnedFilter(event.target.value)}
                        aria-label="Announcement pinned filter"
                      >
                        <option value="">Any pin</option>
                        <option value="pinned">Pinned</option>
                        <option value="unpinned">Unpinned</option>
                      </select>
                      <input
                        className={filterFieldClass}
                        value={announcementKeywordFilter}
                        onChange={(event) => setAnnouncementKeywordFilter(event.target.value)}
                        placeholder="Search notice"
                      />
                      <input
                        className={filterFieldClass}
                        type="datetime-local"
                        value={announcementFromFilter}
                        onChange={(event) => setAnnouncementFromFilter(event.target.value)}
                        aria-label="Announcement from publish date"
                      />
                      <input
                        className={filterFieldClass}
                        type="datetime-local"
                        value={announcementToFilter}
                        onChange={(event) => setAnnouncementToFilter(event.target.value)}
                        aria-label="Announcement to publish date"
                      />
                      <button
                        type="submit"
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/24 bg-[#65f7ff]/10 px-3 text-xs font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/16"
                      >
                        <Filter className="h-4 w-4" />
                        Filter
                      </button>
                    </div>
                    {selectedAnnouncementIds.length > 0 ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3 text-sm text-white/58">
                        <span>{selectedAnnouncementIds.length} selected</span>
                        <button
                          type="button"
                          disabled={isBulkUpdating}
                          onClick={() => bulkUpdateAnnouncements({ status: "archived" })}
                          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 text-xs font-semibold text-white/72 transition hover:border-[#d8ff5d]/24 hover:bg-[#d8ff5d]/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Archive className="h-4 w-4" />
                          Archive
                        </button>
                        <button
                          type="button"
                          disabled={isBulkUpdating}
                          onClick={() => bulkUpdateAnnouncements({ is_pinned: true })}
                          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#d8ff5d]/24 bg-[#d8ff5d]/10 px-3 text-xs font-semibold text-[#f1ffc1] transition hover:bg-[#d8ff5d]/16 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Pin className="h-4 w-4" />
                          Pin
                        </button>
                        <button
                          type="button"
                          disabled={isBulkUpdating}
                          onClick={() => bulkUpdateAnnouncements({ is_pinned: false })}
                          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/24 bg-[#65f7ff]/10 px-3 text-xs font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/16 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <PinOff className="h-4 w-4" />
                          Unpin
                        </button>
                      </div>
                    ) : null}
                  </form>
                  <CoachAnnouncementTable
                    announcements={announcements}
                    updatingAnnouncementId={updatingAnnouncementId}
                    selectedAnnouncementIds={selectedAnnouncementIds}
                    onSelectedAnnouncementIdsChange={setSelectedAnnouncementIds}
                    onPatch={handleAnnouncementPatch}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>

        <aside id="coach-composer" className="min-w-0 space-y-4 scroll-mt-24">
          <div className="rounded-lg border border-white/10 bg-white/[0.045] p-2 backdrop-blur-2xl">
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "task" as const, label: "Task", icon: ClipboardList },
                { id: "announcement" as const, label: "Notice", icon: Megaphone },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeComposer === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveComposer(item.id)}
                    className={cn(
                      "relative flex min-h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold transition",
                      isActive ? "text-white" : "text-white/50 hover:text-white",
                    )}
                  >
                    {isActive ? (
                      <motion.span
                        layoutId="coach-composer-active"
                        className="absolute inset-0 rounded-md border border-[#65f7ff]/20 bg-[#65f7ff]/10"
                        transition={{ type: "spring", stiffness: 360, damping: 32 }}
                      />
                    ) : null}
                    <Icon className="relative h-4 w-4" />
                    <span className="relative">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {activeComposer === "task" ? (
              <motion.div
                key="task"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.22 }}
              >
                <CreateTaskPanel
                  classPublicId={classPublicId}
                  studentCount={students.length}
                  isCompact
                  onCreated={(task) => {
                    setTasks((currentTasks) => [task, ...currentTasks]);
                    setActivityMessage(`Task published to ${task.assignment_count} students.`);
                  }}
                />
              </motion.div>
            ) : (
              <motion.div
                key="announcement"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.22 }}
              >
                <CreateAnnouncementPanel
                  classPublicId={classPublicId}
                  onCreated={(announcement) => {
                    setAnnouncements((currentAnnouncements) => [
                      announcement,
                      ...currentAnnouncements,
                    ]);
                    setActivityMessage(`Announcement published: ${announcement.title}`);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
      </div>
    </CoachShell>
  );
}
