"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getTemplateById } from "@/config/templates";
import { AccountCenterShell } from "@/components/account/AccountCenterShell";
import { GrowthTrendsSection } from "@/components/account/GrowthTrendsSection";
import { ProfileSummaryCard } from "@/components/account/ProfileSummaryCard";
import { RecentReportsSection } from "@/components/account/RecentReportsSection";
import { StatOverviewRow } from "@/components/account/StatOverviewRow";
import { WeeklyTasksSection } from "@/components/account/WeeklyTasksSection";
import type {
  AccountAnalysisType,
  AccountReport,
  GrowthSummary,
  ReportSource,
  StatOverviewItem,
  TrendPoint,
  WeeklyTask,
} from "@/components/account/types";
import { routes } from "@/lib/routes";
import { supabase } from "@/lib/supabaseClient";
import { useAuthStore } from "@/store/authStore";

type SupabaseReportRow = {
  id: number | string;
  user_id?: number | null;
  analysis_type?: string | null;
  template_id?: string | null;
  overall_score?: number | null;
  grade?: string | null;
  score_data?: {
    overall?: number | null;
    grade?: string | null;
  } | null;
  created_at?: string | null;
};

const PREVIEW_REPORTS: AccountReport[] = [
  {
    id: "preview-shooting-1",
    analysisType: "shooting",
    templateName: "Front Form Check",
    score: 92,
    grade: "S",
    createdAt: "2026-04-24T08:30:00.000Z",
    linkable: false,
  },
  {
    id: "preview-dribbling-1",
    analysisType: "dribbling",
    templateName: "Narrow Crossover",
    score: 81,
    grade: "A",
    createdAt: "2026-04-22T09:15:00.000Z",
    linkable: false,
  },
  {
    id: "preview-training-1",
    analysisType: "training",
    templateName: "High Knees Side",
    score: 76,
    grade: "B",
    createdAt: "2026-04-19T11:45:00.000Z",
    linkable: false,
  },
  {
    id: "preview-shooting-2",
    analysisType: "shooting",
    templateName: "Side Form Review",
    score: 88,
    grade: "A",
    createdAt: "2026-04-16T10:10:00.000Z",
    linkable: false,
  },
  {
    id: "preview-dribbling-2",
    analysisType: "dribbling",
    templateName: "One Hand One Side",
    score: 72,
    grade: "B",
    createdAt: "2026-04-13T07:40:00.000Z",
    linkable: false,
  },
  {
    id: "preview-training-2",
    analysisType: "training",
    templateName: "Wall Sit Hold",
    score: 84,
    grade: "A",
    createdAt: "2026-04-10T12:00:00.000Z",
    linkable: false,
  },
];

function getDisplayName(username: string, nickname: string | null): string {
  if (nickname?.trim()) {
    return nickname.trim();
  }

  return username
    .split(/[_\-.]/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function getGrade(score: number): string {
  if (score >= 90) {
    return "S";
  }
  if (score >= 85) {
    return "A";
  }
  if (score >= 75) {
    return "B";
  }
  if (score >= 60) {
    return "C";
  }
  if (score >= 50) {
    return "D";
  }
  return "F";
}

function normalizeAnalysisType(
  value: string | null | undefined,
  templateId?: string | null
): AccountAnalysisType {
  if (value === "shooting" || value === "dribbling" || value === "training") {
    return value;
  }

  const template = templateId ? getTemplateById(templateId) : null;
  return template?.mode ?? "shooting";
}

function normalizeReport(row: SupabaseReportRow): AccountReport | null {
  const analysisType = normalizeAnalysisType(row.analysis_type, row.template_id);
  const template = row.template_id ? getTemplateById(row.template_id) : null;
  const score = Number(row.overall_score ?? row.score_data?.overall ?? 0);
  const createdAt = row.created_at ?? new Date().toISOString();

  if (Number.isNaN(score)) {
    return null;
  }

  return {
    id: String(row.id),
    analysisType,
    templateName: template?.displayName ?? row.template_id ?? "Motion review",
    score,
    grade: row.grade ?? row.score_data?.grade ?? getGrade(score),
    createdAt,
    linkable: true,
  };
}

function formatRelativeTime(input: string): string {
  const target = new Date(input).getTime();
  const diffMs = target - Date.now();
  const absMinutes = Math.round(Math.abs(diffMs) / 60000);

  if (absMinutes < 60) {
    return `${absMinutes || 1}m ago`;
  }

  const absHours = Math.round(absMinutes / 60);
  if (absHours < 24) {
    return `${absHours}h ago`;
  }

  const absDays = Math.round(absHours / 24);
  if (absDays < 7) {
    return `${absDays}d ago`;
  }

  return new Intl.DateTimeFormat("en-AU", {
    month: "short",
    day: "numeric",
  }).format(new Date(input));
}

function isWithinLastDays(input: string, days: number): boolean {
  const diff = Date.now() - new Date(input).getTime();
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function computeStreakDays(reports: AccountReport[]): number {
  const days = Array.from(
    new Set(
      reports
        .map((report) => new Date(report.createdAt).toISOString().slice(0, 10))
        .sort()
    )
  ).reverse();

  if (days.length === 0) {
    return 0;
  }

  let streak = 1;
  for (let index = 1; index < days.length; index += 1) {
    const current = new Date(`${days[index - 1]}T00:00:00Z`).getTime();
    const next = new Date(`${days[index]}T00:00:00Z`).getTime();
    const diffDays = (current - next) / (24 * 60 * 60 * 1000);

    if (diffDays === 1) {
      streak += 1;
      continue;
    }

    break;
  }

  return streak;
}

function buildTrendPoints(reports: AccountReport[]): TrendPoint[] {
  const points = [...reports]
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
    .slice(-6);

  return points.map((report) => ({
    label: new Intl.DateTimeFormat("en-AU", { month: "short", day: "numeric" }).format(
      new Date(report.createdAt)
    ),
    score: Math.round(report.score),
  }));
}

function buildWeeklyTasks(reports: AccountReport[]): WeeklyTask[] {
  const weeklyReports = reports.filter((report) => isWithinLastDays(report.createdAt, 7));
  const weeklyTypes = new Set(weeklyReports.map((report) => report.analysisType));
  const weeklyBest = Math.max(...weeklyReports.map((report) => report.score), 0);

  const sessionsProgress = Math.min(weeklyReports.length / 3, 1);
  const typeProgress = Math.min(weeklyTypes.size / 2, 1);
  const scoreProgress = Math.min(weeklyBest / 85, 1);

  return [
    {
      title: "Complete 3 analysis sessions",
      description: "Keep at least three uploads moving through the lab this week.",
      progress: sessionsProgress,
      status: sessionsProgress >= 1 ? "done" : sessionsProgress > 0 ? "in_progress" : "pending",
      valueLabel: `${weeklyReports.length}/3`,
      dueLabel: "Due this week",
    },
    {
      title: "Cover 2 motion labs",
      description: "Spread work across shooting, dribbling, or training instead of repeating one lane only.",
      progress: typeProgress,
      status: typeProgress >= 1 ? "done" : typeProgress > 0 ? "in_progress" : "pending",
      valueLabel: `${weeklyTypes.size}/2`,
      dueLabel: "Mix your reps",
    },
    {
      title: "Reach an A-grade session",
      description: "Push one report above the strong-performance threshold.",
      progress: scoreProgress,
      status: scoreProgress >= 1 ? "done" : scoreProgress > 0 ? "in_progress" : "pending",
      valueLabel: weeklyBest > 0 ? `${Math.round(weeklyBest)} pts` : "No score yet",
      dueLabel: "Best of week",
    },
  ];
}

export default function MePage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const hasInitialized = useAuthStore((state) => state.hasInitialized);

  const [reports, setReports] = useState<AccountReport[]>(PREVIEW_REPORTS);
  const [reportSource, setReportSource] = useState<ReportSource>("preview");
  const [isReportsLoading, setIsReportsLoading] = useState(false);

  useEffect(() => {
    if (!hasInitialized || isAuthenticated) {
      return;
    }

    router.replace(`${routes.auth.login}?next=${encodeURIComponent(routes.user.me)}`);
  }, [hasInitialized, isAuthenticated, router]);

  useEffect(() => {
    if (!hasInitialized || !user || !isAuthenticated) {
      return;
    }

    let isActive = true;

    const fetchReports = async () => {
      setIsReportsLoading(true);

      try {
        const { data, error } = await supabase
          .from("analysis_reports")
          .select("id,user_id,analysis_type,template_id,overall_score,grade,score_data,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(6);

        if (error) {
          throw error;
        }

        const normalized = (data ?? [])
          .map((row) => normalizeReport(row as SupabaseReportRow))
          .filter((row): row is AccountReport => Boolean(row));

        if (!isActive) {
          return;
        }

        if (normalized.length > 0) {
          setReports(normalized);
          setReportSource("live");
        } else {
          setReports(PREVIEW_REPORTS);
          setReportSource("preview");
        }
      } catch (error) {
        console.error("Falling back to preview report data.", error);

        if (!isActive) {
          return;
        }

        setReports(PREVIEW_REPORTS);
        setReportSource("preview");
      } finally {
        if (isActive) {
          setIsReportsLoading(false);
        }
      }
    };

    void fetchReports();

    return () => {
      isActive = false;
    };
  }, [hasInitialized, isAuthenticated, user]);

  const dashboard = useMemo(() => {
    const sortedReports = [...reports].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
    const latestReport = sortedReports[0] ?? null;
    const weeklyReports = sortedReports.filter((report) => isWithinLastDays(report.createdAt, 7));
    const scores = sortedReports.map((report) => report.score);
    const bestScore = Math.max(...scores, 0);
    const trendPoints = buildTrendPoints(sortedReports);
    const streak = computeStreakDays(sortedReports);

    const stats: StatOverviewItem[] = [
      {
        label: "Total reports",
        value: String(sortedReports.length),
        helper: reportSource === "live" ? "Pulled from your history" : "Preview dataset loaded",
        accent: true,
      },
      {
        label: "Weekly analysis",
        value: String(weeklyReports.length),
        helper: "Sessions in the last 7 days",
      },
      {
        label: "Best score",
        value: bestScore > 0 ? String(Math.round(bestScore)) : "--",
        helper: "Top result across visible reports",
      },
      {
        label: "Last analysis",
        value: latestReport ? formatRelativeTime(latestReport.createdAt) : "--",
        helper: latestReport ? latestReport.templateName : "No uploads yet",
      },
    ];

    const highlights: GrowthSummary[] = [
      {
        label: "7-day average",
        value:
          weeklyReports.length > 0
            ? `${Math.round(average(weeklyReports.map((report) => report.score)))}`
            : "--",
        helper: "Short-term form",
      },
      {
        label: "30-day average",
        value: `${Math.round(average(sortedReports.slice(0, 6).map((report) => report.score))) || 0}`,
        helper: "Latest report window",
      },
      {
        label: "Streak days",
        value: String(streak),
        helper: "Consecutive active days",
      },
    ];

    return {
      latestReport,
      stats,
      tasks: buildWeeklyTasks(sortedReports),
      trendPoints,
      highlights,
      recentReports: sortedReports,
    };
  }, [reportSource, reports]);

  if (!hasInitialized || isInitializing || !user || !isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07080b] text-white">
        <div className="analysis-surface rounded-[28px] border border-white/10 px-8 py-7 text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#d8ff5d]/60 border-t-transparent" />
          <div className="mt-4 text-[0.72rem] uppercase tracking-[0.28em] text-white/48">
            Loading personal center
          </div>
        </div>
      </main>
    );
  }

  const displayName = getDisplayName(user.username, user.nickname);
  const joinedLabel = `Joined ${new Intl.DateTimeFormat("en-AU", {
    month: "short",
    year: "numeric",
  }).format(new Date(user.created_at))}`;

  return (
    <AccountCenterShell username={user.username}>
      <ProfileSummaryCard
        user={user}
        latestReport={dashboard.latestReport}
        reportSource={reportSource}
        joinedLabel={joinedLabel}
        displayName={displayName}
      />
      <StatOverviewRow items={dashboard.stats} />
      <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <WeeklyTasksSection tasks={dashboard.tasks} />
        <GrowthTrendsSection
          points={dashboard.trendPoints}
          highlights={dashboard.highlights}
          source={reportSource}
        />
      </div>
      <RecentReportsSection
        reports={dashboard.recentReports}
        source={reportSource}
        isLoading={isReportsLoading}
      />
    </AccountCenterShell>
  );
}
