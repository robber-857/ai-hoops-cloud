"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  Loader2,
  RadioTower,
  ShieldAlert,
  UsersRound,
} from "lucide-react";

import { CoachClassList } from "@/components/coach/CoachClassList";
import { CoachShell } from "@/components/coach/CoachShell";
import { formatDate } from "@/components/coach/coachUtils";
import {
  coachService,
  type CoachClassRead,
  type CoachDashboardResponse,
} from "@/services/coach";
import { useAuthStore } from "@/store/authStore";

function MetricTile({
  label,
  value,
  helper,
  accent = "cyan",
}: {
  label: string;
  value: string;
  helper: string;
  accent?: "cyan" | "lime" | "violet";
}) {
  const accentClass =
    accent === "lime"
      ? "text-[#d8ff5d]"
      : accent === "violet"
        ? "text-[#c4b5fd]"
        : "text-[#65f7ff]";

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.05] p-4 backdrop-blur-2xl">
      <div className="text-[0.68rem] uppercase tracking-[0.18em] text-white/42">{label}</div>
      <div className={`mt-3 font-[var(--font-display)] text-3xl font-bold ${accentClass}`}>
        {value}
      </div>
      <div className="mt-2 text-xs leading-5 text-white/48">{helper}</div>
    </div>
  );
}

function CoachLoadingSurface() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#030712] text-white">
      <div className="rounded-lg border border-white/10 bg-white/[0.055] px-8 py-7 text-center shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
        <Loader2 className="mx-auto h-9 w-9 animate-spin text-[#65f7ff]" />
        <div className="mt-4 text-[0.72rem] uppercase tracking-[0.28em] text-white/48">
          Syncing coach data
        </div>
      </div>
    </main>
  );
}

export default function CoachHomePage() {
  const user = useAuthStore((state) => state.user);
  const hasInitialized = useAuthStore((state) => state.hasInitialized);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const [classes, setClasses] = useState<CoachClassRead[]>([]);
  const [dashboard, setDashboard] = useState<CoachDashboardResponse | null>(null);
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

    void Promise.all([coachService.listClasses(), coachService.getDashboard()])
      .then(([classesResponse, dashboardResponse]) => {
        if (!isActive) {
          return;
        }
        setClasses(classesResponse.items);
        setDashboard(dashboardResponse);
      })
      .catch((fetchError) => {
        if (!isActive) {
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load classes.");
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

  const metrics = useMemo(() => {
    const activeClasses =
      dashboard?.active_class_count ??
      classes.filter((classItem) => classItem.status === "active").length;
    const students =
      dashboard?.student_count ??
      classes.reduce((sum, classItem) => sum + classItem.student_count, 0);
    const capacity = classes.reduce((sum, classItem) => sum + (classItem.max_students ?? 0), 0);
    const nextEndingClass = [...classes]
      .filter((classItem) => classItem.end_date)
      .sort(
        (left, right) =>
          new Date(left.end_date ?? 0).getTime() - new Date(right.end_date ?? 0).getTime(),
      )[0];

    return {
      activeClasses,
      students,
      capacity,
      nextEndingClass,
      openTasks: dashboard?.open_task_count ?? 0,
      recentReports: dashboard?.recent_report_count ?? 0,
      announcements: dashboard?.announcement_count ?? 0,
    };
  }, [classes, dashboard]);

  if (!hasInitialized || isInitializing || !user) {
    return <CoachLoadingSurface />;
  }

  const displayName = user.nickname?.trim() || user.username;

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

  return (
    <CoachShell user={user} title="Coach Command Center" breadcrumb={["Command Center"]}>
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.46, ease: "easeOut" }}
        className="grid gap-5 xl:grid-cols-[1.12fr_0.88fr]"
      >
        <div className="rounded-lg border border-white/10 bg-white/[0.055] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
          <div className="text-[0.68rem] uppercase tracking-[0.24em] text-[#65f7ff]/75">
            Training camp operations
          </div>
          <h1 className="coach-typewriter mt-4 max-w-3xl font-[var(--font-display)] text-4xl font-bold tracking-[0.01em] text-white sm:text-5xl">
            Welcome back, {displayName}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/58 sm:text-base">
            Monitor assigned classes, inspect student progress, and publish the next training
            signal from one control surface.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <MetricTile
              label="Active classes"
              value={String(metrics.activeClasses)}
              helper={`${classes.length} total visible classes`}
            />
            <MetricTile
              label="Students"
              value={String(metrics.students)}
              helper={metrics.capacity > 0 ? `${metrics.capacity} configured seats` : "Active class members"}
              accent="lime"
            />
            <MetricTile
              label="Open tasks"
              value={String(metrics.openTasks)}
              helper={`${metrics.recentReports} reports in 7 days`}
              accent="violet"
            />
          </div>
        </div>

        <aside className="rounded-lg border border-white/10 bg-white/[0.045] p-5 backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#d8ff5d]/24 bg-[#d8ff5d]/10 text-[#d8ff5d]">
              <RadioTower className="h-5 w-5" />
            </span>
            <div>
              <div className="text-[0.68rem] uppercase tracking-[0.18em] text-white/42">
                Ops overview
              </div>
              <div className="font-[var(--font-display)] text-lg font-bold text-white">
                Live class grid
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/18 px-4 py-3">
              <span className="flex items-center gap-2 text-sm text-white/64">
                <UsersRound className="h-4 w-4 text-[#65f7ff]" />
                Roster load
              </span>
              <span className="font-semibold text-white">{metrics.students}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/18 px-4 py-3">
              <span className="flex items-center gap-2 text-sm text-white/64">
                <BarChart3 className="h-4 w-4 text-[#d8ff5d]" />
                Notices
              </span>
              <span className="font-semibold text-white">{metrics.announcements}</span>
            </div>
            <div className="rounded-lg border border-[#65f7ff]/20 bg-[#65f7ff]/10 px-4 py-3 text-sm leading-6 text-[#dffbff]">
              Next class end: {formatDate(metrics.nextEndingClass?.end_date)}. Class pages now include
              task and notice maintenance.
            </div>
          </div>
        </aside>
      </motion.section>

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[0.68rem] uppercase tracking-[0.22em] text-white/42">
              Class grid
            </div>
            <h2 className="mt-2 font-[var(--font-display)] text-2xl font-bold text-white">
              Assigned classes
            </h2>
          </div>
          {isLoading ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-sm text-white/58 backdrop-blur-xl">
              <Loader2 className="h-4 w-4 animate-spin text-[#65f7ff]" />
              Loading classes
            </span>
          ) : null}
        </div>

        {error ? (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <CoachClassList classes={classes} />
      </section>
    </CoachShell>
  );
}
