"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ClipboardList,
  Loader2,
  Megaphone,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import { CoachReportTable } from "@/components/coach/CoachReportTable";
import { CoachShell } from "@/components/coach/CoachShell";
import { CoachStudentTable } from "@/components/coach/CoachStudentTable";
import { CreateAnnouncementPanel } from "@/components/coach/CreateAnnouncementPanel";
import { CreateTaskPanel } from "@/components/coach/CreateTaskPanel";
import { formatDate, formatScore, getClassStatusTone } from "@/components/coach/coachUtils";
import { cn } from "@/lib/utils";
import {
  coachService,
  type CoachClassRead,
  type CoachClassReportRead,
  type CoachStudentRead,
} from "@/services/coach";
import { useAuthStore } from "@/store/authStore";

type TabId = "students" | "reports";
type ComposerId = "task" | "announcement";

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
  const [activeTab, setActiveTab] = useState<TabId>("students");
  const [activeComposer, setActiveComposer] = useState<ComposerId>("task");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activityMessage, setActivityMessage] = useState<string | null>(null);

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
    ])
      .then(([classesResponse, studentsResponse, reportsResponse]) => {
        if (!isActive) {
          return;
        }

        const currentClass =
          classesResponse.items.find((item) => item.public_id === classPublicId) ?? null;

        setClassItem(currentClass);
        setStudents(studentsResponse.items);
        setReports(reportsResponse.items);
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
    };
  }, [reports]);

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
                Students and reports
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
              ) : (
                <motion.div
                  key="reports"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                >
                  <CoachReportTable reports={reports} />
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
                  onCreated={(task) =>
                    setActivityMessage(`Task published to ${task.assignment_count} students.`)
                  }
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
                  onCreated={(announcement) =>
                    setActivityMessage(`Announcement published: ${announcement.title}`)
                  }
                />
              </motion.div>
            )}
          </AnimatePresence>
        </aside>
      </div>
    </CoachShell>
  );
}
