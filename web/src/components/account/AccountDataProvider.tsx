"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { getTemplateById } from "@/config/templates";
import type {
  AccountAnalysisType,
  AccountAnnouncement,
  AccountReport,
  ReportSource,
  StatOverviewItem,
  TaskSubmissionHistoryItem,
  TaskReportOption,
  TrendPoint,
  TrendPointsByType,
  WeeklyTask,
  WeeklyTaskDetail,
} from "@/components/account/types";
import { routes } from "@/lib/routes";
import {
  meService,
  type AnnouncementSummaryRead,
  type DashboardStatsRead,
  type TaskDetailRead,
  type TaskSummaryRead,
  type TaskSubmissionReportRead,
  type TrendPointRead,
} from "@/services/me";
import type { ReportListItem } from "@/services/reports";
import { useAuthStore } from "@/store/authStore";
import type { PlayerMeasurementDraft } from "@/services/playerProfile";

const ACCOUNT_ANALYSIS_TYPES: AccountAnalysisType[] = [
  "shooting",
  "dribbling",
  "training",
];

function emptyTrendPointsByType(): TrendPointsByType {
  return {
    shooting: [],
    dribbling: [],
    training: [],
  };
}

function localDateKey(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatTrendLabel(dateKey: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    month: "short",
    day: "numeric",
  }).format(parseDateKey(dateKey));
}

function formatTrendFullLabel(dateKey: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parseDateKey(dateKey));
}

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
  templateId?: string | null,
): AccountAnalysisType {
  if (value === "shooting" || value === "dribbling" || value === "training") {
    return value;
  }

  const template = templateId ? getTemplateById(templateId) : null;
  return template?.mode ?? "shooting";
}

function normalizeReport(row: ReportListItem): AccountReport | null {
  const analysisType = normalizeAnalysisType(
    row.analysis_type,
    row.template_code,
  );
  const template = row.template_code
    ? getTemplateById(row.template_code)
    : null;
  const score = Number(row.overall_score ?? 0);
  const createdAt = row.created_at ?? new Date().toISOString();

  if (Number.isNaN(score)) {
    return null;
  }

  return {
    id: row.public_id,
    analysisType,
    templateCode: row.template_code ?? null,
    templateName: template?.displayName ?? row.template_code ?? "Motion review",
    score,
    grade: row.grade ?? getGrade(score),
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

function formatRefreshTime(input: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    hour: "2-digit",
    minute: "2-digit",
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
        .sort(),
    ),
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

function buildTrendPointsByTypeFromReports(
  reports: AccountReport[],
): TrendPointsByType {
  const grouped = emptyTrendPointsByType();
  const buckets: Record<
    AccountAnalysisType,
    Record<string, AccountReport[]>
  > = {
    shooting: {},
    dribbling: {},
    training: {},
  };

  for (const report of reports) {
    const dateKey = localDateKey(report.createdAt);
    const typeBuckets = buckets[report.analysisType];
    typeBuckets[dateKey] = [...(typeBuckets[dateKey] ?? []), report];
  }

  for (const type of ACCOUNT_ANALYSIS_TYPES) {
    grouped[type] = Object.entries(buckets[type])
      .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate))
      .map(([dateKey, dayReports]) => {
        const scores = dayReports.map((report) => report.score);
        const bestReport = dayReports.reduce((best, report) =>
          report.score > best.score ? report : best,
        );

        return {
          analysisType: type,
          dateKey,
          label: formatTrendLabel(dateKey),
          fullLabel: formatTrendFullLabel(dateKey),
          score: Math.round(average(scores)),
          metaLabel:
            dayReports.length === 1
              ? bestReport.templateName
              : `${dayReports.length} reports, best ${Math.round(bestReport.score)}`,
          sessionCount: dayReports.length,
        };
      });
  }

  return grouped;
}

function getTaskActionHref(
  task: TaskSummaryRead,
  analysisType: AccountAnalysisType,
): string {
  const baseHref =
    analysisType === "dribbling"
      ? routes.pose2d.dribbling
      : analysisType === "training"
        ? routes.pose2d.training
        : routes.pose2d.shooting;
  const searchParams = new URLSearchParams({
    taskAssignmentId: task.public_id,
    classId: task.class_public_id,
  });

  if (task.template_code) {
    searchParams.set("templateCode", task.template_code);
  }

  return `${baseHref}?${searchParams.toString()}`;
}

type TaskTargetMetrics = {
  targetSessions: number;
  targetScore: number;
};

function getTaskTargetMetrics(task: TaskSummaryRead): TaskTargetMetrics {
  const targetConfig = task.target_config ?? {};
  const rawTargetSessions = Number(targetConfig.target_sessions ?? 0);
  const targetScore = Number(targetConfig.target_score ?? 0);
  return {
    targetSessions: rawTargetSessions > 0 ? rawTargetSessions : 1,
    targetScore: targetScore > 0 ? targetScore : 0,
  };
}

function getTargetLabel({
  targetSessions,
  targetScore,
}: TaskTargetMetrics): string {
  if (targetScore > 0) {
    return `${targetSessions} sessions / ${Math.round(targetScore)} pts`;
  }
  return `${targetSessions} sessions`;
}

function getProgressDetailLabel(
  task: TaskSummaryRead,
  targets: TaskTargetMetrics,
): string {
  return `${task.completed_sessions}/${targets.targetSessions} sessions`;
}

function getScoreGateLabel(
  task: TaskSummaryRead,
  targets: TaskTargetMetrics,
): string | null {
  if (targets.targetScore <= 0) {
    return null;
  }

  const bestScore = task.best_score !== null ? Math.round(task.best_score) : 0;
  return `Score gate ${bestScore}/${Math.round(targets.targetScore)} pts`;
}

function findCandidateReports(
  task: TaskSummaryRead,
  reports: AccountReport[],
): AccountReport[] {
  const analysisType = normalizeAnalysisType(
    task.analysis_type,
    task.template_code,
  );
  return reports
    .filter((report) => report.linkable)
    .filter((report) => report.analysisType === analysisType)
    .filter(
      (report) =>
        !task.template_code || report.templateCode === task.template_code,
    )
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    );
}

function buildReportOptions(reports: AccountReport[]): TaskReportOption[] {
  return reports.map((report) => ({
    id: report.id,
    label: report.templateName,
    scoreLabel: `${Math.round(report.score)} pts`,
    dateLabel: new Intl.DateTimeFormat("en-AU", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(report.createdAt)),
  }));
}

function normalizeTaskSubmission(
  row: TaskSubmissionReportRead,
): TaskSubmissionHistoryItem {
  const analysisType = normalizeAnalysisType(
    row.analysis_type,
    row.template_code,
  );
  const templateName = getTemplateName(row.template_code, analysisType);
  return {
    id: row.report_public_id,
    title: templateName,
    scoreLabel:
      row.overall_score !== null
        ? `${Math.round(row.overall_score)} pts`
        : "No score",
    gradeLabel: row.grade ? `Grade ${row.grade}` : "No grade",
    dateLabel: new Intl.DateTimeFormat("en-AU", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(row.submitted_at)),
  };
}

function normalizeTaskDetail(task: TaskDetailRead): WeeklyTaskDetail {
  return {
    submissionHistory: task.submission_reports.map(normalizeTaskSubmission),
  };
}

function getTemplateName(
  templateCode: string | null,
  analysisType: AccountAnalysisType,
): string {
  const template = templateCode ? getTemplateById(templateCode) : null;
  return template?.displayName ?? templateCode ?? `${analysisType} practice`;
}

function normalizeTask(
  task: TaskSummaryRead,
  reports: AccountReport[],
): WeeklyTask {
  const progress = Math.max(0, Math.min(1, (task.progress_percent ?? 0) / 100));
  const analysisType = normalizeAnalysisType(
    task.analysis_type,
    task.template_code,
  );
  const templateName = getTemplateName(task.template_code, analysisType);
  const candidateReports = findCandidateReports(task, reports);
  const candidateReport = candidateReports[0] ?? null;
  const targets = getTaskTargetMetrics(task);
  const status: WeeklyTask["status"] =
    task.status === "completed"
      ? "done"
      : task.status === "in_progress" || task.status === "overdue"
        ? "in_progress"
        : "pending";
  const dueLabel = task.due_at
    ? new Intl.DateTimeFormat("en-AU", {
        month: "short",
        day: "numeric",
      }).format(new Date(task.due_at))
    : "Assigned task";

  return {
    id: task.public_id,
    title: task.title,
    description:
      task.description?.trim() ||
      `Assigned for ${task.class_name} using ${templateName}.`,
    progress,
    status,
    valueLabel: getProgressDetailLabel(task, targets),
    progressDetailLabel: getProgressDetailLabel(task, targets),
    scoreGateLabel: getScoreGateLabel(task, targets),
    dueLabel,
    actionHref: getTaskActionHref(task, analysisType),
    className: task.class_name,
    analysisType,
    templateCode: task.template_code,
    templateName,
    targetLabel: getTargetLabel(targets),
    completedSessions: task.completed_sessions,
    candidateReportId: candidateReport?.id ?? null,
    candidateReportLabel: candidateReport
      ? `${candidateReport.templateName} - ${Math.round(candidateReport.score)} pts`
      : null,
    reportOptions: buildReportOptions(candidateReports),
    latestReportId: task.latest_report_public_id,
  };
}

function normalizeTrendPoints(
  points: TrendPointRead[],
  analysisType: AccountAnalysisType,
): TrendPoint[] {
  return points
    .map((point) => ({
      analysisType,
      dateKey: point.date,
      label: formatTrendLabel(point.date),
      fullLabel: formatTrendFullLabel(point.date),
      score: Math.round(point.average_score ?? point.best_score ?? 0),
      metaLabel: `${point.session_count} ${point.session_count === 1 ? "session" : "sessions"}`,
      sessionCount: point.session_count,
    }))
    .filter((point) => point.score > 0);
}

function normalizeTrendPointsByType(
  responses: Array<{ points: TrendPointRead[] }>,
): TrendPointsByType {
  const next = emptyTrendPointsByType();
  ACCOUNT_ANALYSIS_TYPES.forEach((analysisType, index) => {
    next[analysisType] = normalizeTrendPoints(
      responses[index]?.points ?? [],
      analysisType,
    );
  });
  return next;
}

function hasTrendData(pointsByType: TrendPointsByType): boolean {
  return ACCOUNT_ANALYSIS_TYPES.some(
    (analysisType) => pointsByType[analysisType].length > 0,
  );
}

function getAnnouncementScopeLabel(
  announcement: AnnouncementSummaryRead,
): string {
  if (announcement.scope_type === "class") {
    return announcement.class_name ?? "Class";
  }
  if (announcement.scope_type === "camp") {
    return announcement.camp_name ?? "Camp";
  }
  if (announcement.scope_type === "role") {
    return announcement.target_role
      ? `${announcement.target_role} role`
      : "Role";
  }
  return "Global";
}

function normalizeAnnouncement(
  announcement: AnnouncementSummaryRead,
): AccountAnnouncement {
  return {
    id: announcement.public_id,
    title: announcement.title,
    content: announcement.content,
    scopeLabel: getAnnouncementScopeLabel(announcement),
    publishedAt: announcement.publish_at ?? announcement.created_at,
    isPinned: announcement.is_pinned,
    isRead: announcement.is_read,
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

function useAccountData() {
  const [measurementDraft, setMeasurementDraft] =
    useState<PlayerMeasurementDraft | null>(null);
  const [selectedTaskReports, setSelectedTaskReports] = useState<
    Record<string, string>
  >({});
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasInitialized = useAuthStore((state) => state.hasInitialized);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [announcementError, setAnnouncementError] = useState<string | null>(
    null,
  );
  const [reloadVersion, setReloadVersion] = useState(0);
  const [reports, setReports] = useState<AccountReport[]>([]);
  const [reportSource, setReportSource] = useState<ReportSource>("live");
  const [isReportsLoading, setIsReportsLoading] = useState(true);
  const [backendStats, setBackendStats] = useState<DashboardStatsRead | null>(
    null,
  );
  const [backendTasks, setBackendTasks] = useState<TaskSummaryRead[]>([]);
  const [taskDetailsById, setTaskDetailsById] = useState<
    Record<string, TaskDetailRead>
  >({});
  const [loadingTaskDetailId, setLoadingTaskDetailId] = useState<string | null>(
    null,
  );
  const [taskDetailErrors, setTaskDetailErrors] = useState<
    Record<string, string>
  >({});
  const [taskSubmitErrors, setTaskSubmitErrors] = useState<
    Record<string, string>
  >({});
  const [isTaskRefreshing, setIsTaskRefreshing] = useState(false);
  const [lastTaskRefreshAt, setLastTaskRefreshAt] = useState<string | null>(
    null,
  );
  const [taskRefreshError, setTaskRefreshError] = useState<string | null>(null);
  const [backendTrendPointsByType, setBackendTrendPointsByType] =
    useState<TrendPointsByType | null>(null);
  const [announcements, setAnnouncements] = useState<AccountAnnouncement[]>([]);
  const [unreadAnnouncementCount, setUnreadAnnouncementCount] = useState(0);
  const [expandedAnnouncementId, setExpandedAnnouncementId] = useState<
    string | null
  >(null);
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);
  const taskRefreshInFlightRef = useRef(false);
  const announcementReadsInFlightRef = useRef(new Set<string>());

  useEffect(() => {
    if (!hasInitialized || !user || !isAuthenticated) {
      return;
    }

    let isActive = true;

    const fetchAccountData = async () => {
      setIsReportsLoading(true);
      setLoadError(null);
      setAnnouncementError(null);

      try {
        const [
          dashboardData,
          reportsData,
          tasksData,
          trendResponses,
          announcementsData,
        ] = await Promise.all([
          meService.getDashboard(),
          meService.getReports(60),
          meService.getTasks(100),
          Promise.all(
            ACCOUNT_ANALYSIS_TYPES.map((analysisType) =>
              meService.getTrends({ range: "90d", analysisType }),
            ),
          ),
          meService.getAnnouncements(100),
        ]);

        const normalizedReports = reportsData.items
          .map(normalizeReport)
          .filter((row): row is AccountReport => Boolean(row));
        const dashboardReports = dashboardData.recent_reports
          .map(normalizeReport)
          .filter((row): row is AccountReport => Boolean(row));
        const nextReports =
          normalizedReports.length > 0 ? normalizedReports : dashboardReports;
        const nextTrendPointsByType =
          normalizeTrendPointsByType(trendResponses);
        const nextAnnouncements = announcementsData.items.map(
          normalizeAnnouncement,
        );

        if (!isActive) {
          return;
        }

        setBackendStats(dashboardData.stats);
        setBackendTasks(tasksData.items);
        setTaskDetailsById({});
        setTaskDetailErrors({});
        setTaskSubmitErrors({});
        setTaskRefreshError(null);
        setLastTaskRefreshAt(new Date().toISOString());
        setBackendTrendPointsByType(
          hasTrendData(nextTrendPointsByType) ? nextTrendPointsByType : null,
        );
        setAnnouncements(nextAnnouncements);
        setUnreadAnnouncementCount(announcementsData.unread_count);

        if (nextReports.length > 0) {
          setReports(nextReports);
          setReportSource("live");
        } else {
          setReports([]);
          setReportSource("live");
        }
      } catch (error) {
        console.error("Unable to load account data.", error);

        if (!isActive) {
          return;
        }

        setLoadError(
          getErrorMessage(error, "Could not load your account. Please retry."),
        );
        setBackendStats(null);
        setBackendTasks([]);
        setTaskDetailsById({});
        setTaskDetailErrors({});
        setTaskSubmitErrors({});
        setTaskRefreshError(null);
        setLastTaskRefreshAt(null);
        setBackendTrendPointsByType(null);
        setAnnouncements([]);
        setUnreadAnnouncementCount(0);
        setReports([]);
        setReportSource("live");
      } finally {
        if (isActive) {
          setIsReportsLoading(false);
        }
      }
    };

    void fetchAccountData();

    return () => {
      isActive = false;
    };
  }, [hasInitialized, isAuthenticated, user, reloadVersion]);

  const dashboard = useMemo(() => {
    const sortedReports = [...reports].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    );
    const latestReport = sortedReports[0] ?? null;
    const weeklyReports = sortedReports.filter((report) =>
      isWithinLastDays(report.createdAt, 7),
    );
    const scores = sortedReports.map((report) => report.score);
    const bestScore = Math.max(...scores, 0);
    const reportTrendPointsByType =
      buildTrendPointsByTypeFromReports(sortedReports);
    const trendPointsByType =
      backendTrendPointsByType && hasTrendData(backendTrendPointsByType)
        ? backendTrendPointsByType
        : reportTrendPointsByType;
    const streak = computeStreakDays(sortedReports);
    const liveStats = reportSource === "live" ? backendStats : null;

    const stats: StatOverviewItem[] = liveStats
      ? [
          {
            label: "Total reports",
            value: String(liveStats.total_reports),
            helper: "From backend dashboard",
            accent: true,
          },
          {
            label: "Weekly sessions",
            value: String(liveStats.weekly_sessions),
            helper: "Sessions in the last 7 days",
          },
          {
            label: "Best score",
            value:
              liveStats.best_score !== null
                ? String(Math.round(liveStats.best_score))
                : "--",
            helper: "Top result across all reports",
          },
          {
            label: "Active tasks",
            value: String(liveStats.active_tasks),
            helper:
              liveStats.unread_notifications > 0
                ? `${liveStats.unread_notifications} unread notices`
                : "No unread notices",
          },
        ]
      : [
          {
            label: "Total reports",
            value: String(sortedReports.length),
            helper:
              reportSource === "live"
                ? "Pulled from your history"
                : "No reports yet",
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
            value: latestReport
              ? formatRelativeTime(latestReport.createdAt)
              : "--",
            helper: latestReport ? latestReport.templateName : "No uploads yet",
          },
        ];

    return {
      latestReport,
      stats,
      tasks: backendTasks.map((task) => normalizeTask(task, sortedReports)),
      trendPointsByType,
      streak,
      recentReports: sortedReports,
    };
  }, [
    backendStats,
    backendTasks,
    backendTrendPointsByType,
    reportSource,
    reports,
  ]);

  const taskDetailViews = useMemo<Record<string, WeeklyTaskDetail>>(() => {
    return Object.fromEntries(
      Object.entries(taskDetailsById).map(([taskId, detail]) => [
        taskId,
        normalizeTaskDetail(detail),
      ]),
    );
  }, [taskDetailsById]);

  const taskRefreshLabel = lastTaskRefreshAt
    ? `Updated ${formatRefreshTime(lastTaskRefreshAt)}`
    : reportSource === "live"
      ? "Live data"
      : "Not updated yet";

  const refreshTaskData = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!user || !isAuthenticated || taskRefreshInFlightRef.current) {
        return;
      }

      taskRefreshInFlightRef.current = true;
      if (!silent) {
        setIsTaskRefreshing(true);
      }
      setTaskRefreshError(null);

      try {
        const detailIds = Object.keys(taskDetailsById);
        const [
          dashboardData,
          reportsData,
          tasksData,
          trendResponses,
          detailResults,
        ] = await Promise.all([
          meService.getDashboard(),
          meService.getReports(60),
          meService.getTasks(100),
          Promise.all(
            ACCOUNT_ANALYSIS_TYPES.map((analysisType) =>
              meService.getTrends({ range: "90d", analysisType }),
            ),
          ),
          Promise.allSettled(
            detailIds.map((taskId) => meService.getTask(taskId)),
          ),
        ]);
        const normalizedReports = reportsData.items
          .map(normalizeReport)
          .filter((row): row is AccountReport => Boolean(row));
        const dashboardReports = dashboardData.recent_reports
          .map(normalizeReport)
          .filter((row): row is AccountReport => Boolean(row));
        const nextReports =
          normalizedReports.length > 0 ? normalizedReports : dashboardReports;
        const nextTrendPointsByType =
          normalizeTrendPointsByType(trendResponses);
        const visibleTaskIds = new Set(
          tasksData.items.map((task) => task.public_id),
        );
        const refreshedDetails = detailResults
          .filter(
            (result): result is PromiseFulfilledResult<TaskDetailRead> =>
              result.status === "fulfilled",
          )
          .map((result) => result.value)
          .filter((detail) => visibleTaskIds.has(detail.public_id));

        setBackendStats(dashboardData.stats);
        setBackendTasks(tasksData.items);
        setTaskDetailsById((current) => {
          const next = Object.fromEntries(
            Object.entries(current).filter(([taskId]) =>
              visibleTaskIds.has(taskId),
            ),
          ) as Record<string, TaskDetailRead>;
          for (const detail of refreshedDetails) {
            next[detail.public_id] = detail;
          }
          return next;
        });
        setTaskDetailErrors((current) =>
          Object.fromEntries(
            Object.entries(current).filter(([taskId]) =>
              visibleTaskIds.has(taskId),
            ),
          ),
        );
        setTaskSubmitErrors((current) =>
          Object.fromEntries(
            Object.entries(current).filter(([taskId]) =>
              visibleTaskIds.has(taskId),
            ),
          ),
        );

        setReports(nextReports);
        setReportSource("live");

        setBackendTrendPointsByType(
          hasTrendData(nextTrendPointsByType) ? nextTrendPointsByType : null,
        );

        setLastTaskRefreshAt(new Date().toISOString());
      } catch (error) {
        console.error("Unable to refresh task data.", error);
        if (!silent) {
          setTaskRefreshError(
            getErrorMessage(error, "Could not refresh task data."),
          );
        }
      } finally {
        taskRefreshInFlightRef.current = false;
        if (!silent) {
          setIsTaskRefreshing(false);
        }
      }
    },
    [isAuthenticated, taskDetailsById, user],
  );

  useEffect(() => {
    if (!hasInitialized || !user || !isAuthenticated) {
      return;
    }

    const refreshIntervalId = window.setInterval(() => {
      void refreshTaskData({ silent: true });
    }, 60000);

    return () => {
      window.clearInterval(refreshIntervalId);
    };
  }, [hasInitialized, isAuthenticated, refreshTaskData, user]);

  const handleAnnouncementToggle = async (
    announcement: AccountAnnouncement,
  ) => {
    setExpandedAnnouncementId((current) =>
      current === announcement.id ? null : announcement.id,
    );

    if (
      announcement.isRead ||
      announcementReadsInFlightRef.current.has(announcement.id)
    ) {
      return;
    }

    announcementReadsInFlightRef.current.add(announcement.id);
    try {
      await meService.markAnnouncementRead(announcement.id);
      setAnnouncements((current) =>
        current.map((item) =>
          item.id === announcement.id ? { ...item, isRead: true } : item,
        ),
      );
      setUnreadAnnouncementCount((current) => Math.max(0, current - 1));
      setAnnouncementError(null);
    } catch (error) {
      setAnnouncementError(
        getErrorMessage(
          error,
          "Could not mark message as read. Open it again to retry.",
        ),
      );
    } finally {
      announcementReadsInFlightRef.current.delete(announcement.id);
    }
  };

  const handleSubmitTaskReport = async (
    task: WeeklyTask,
    reportPublicId: string,
  ) => {
    if (!reportPublicId) {
      return;
    }

    setSubmittingTaskId(task.id);
    setTaskSubmitErrors((current) => {
      const next = { ...current };
      delete next[task.id];
      return next;
    });

    try {
      const previousTask = backendTasks.find(
        (item) => item.public_id === task.id,
      );
      const updatedTask = await meService.submitTaskReport(
        task.id,
        reportPublicId,
      );
      setBackendTasks((current) =>
        current.map((item) =>
          item.public_id === updatedTask.public_id ? updatedTask : item,
        ),
      );
      setTaskDetailsById((current) => ({
        ...current,
        [updatedTask.public_id]: updatedTask,
      }));
      setBackendStats((current) =>
        current
          ? {
              ...current,
              active_tasks:
                previousTask?.status !== "completed" &&
                updatedTask.status === "completed"
                  ? Math.max(0, current.active_tasks - 1)
                  : current.active_tasks,
            }
          : current,
      );
      setLastTaskRefreshAt(new Date().toISOString());
    } catch (error) {
      console.error("Unable to submit report for task.", error);
      setTaskSubmitErrors((current) => ({
        ...current,
        [task.id]: getErrorMessage(
          error,
          "Could not submit this report to the task. Please check that it matches the task.",
        ),
      }));
    } finally {
      setSubmittingTaskId(null);
    }
  };

  const handleRequestTaskDetail = async (task: WeeklyTask) => {
    if (taskDetailsById[task.id] || loadingTaskDetailId === task.id) {
      return;
    }

    setLoadingTaskDetailId(task.id);
    setTaskDetailErrors((current) => {
      const next = { ...current };
      delete next[task.id];
      return next;
    });

    try {
      const detail = await meService.getTask(task.id);
      setBackendTasks((current) =>
        current.map((item) =>
          item.public_id === detail.public_id ? detail : item,
        ),
      );
      setTaskDetailsById((current) => ({
        ...current,
        [detail.public_id]: detail,
      }));
    } catch (error) {
      console.error("Unable to load task detail.", error);
      setTaskDetailErrors((current) => ({
        ...current,
        [task.id]: getErrorMessage(error, "Could not load this task detail."),
      }));
    } finally {
      setLoadingTaskDetailId((current) =>
        current === task.id ? null : current,
      );
    }
  };

  return {
    selectedTaskReports,
    measurementDraft,
    setMeasurementDraft,
    setSelectedTaskReports,
    user,
    dashboard,
    reportSource,
    isReportsLoading,
    loadError,
    reload: () => setReloadVersion((value) => value + 1),
    announcements,
    unreadAnnouncementCount,
    expandedAnnouncementId,
    handleAnnouncementToggle,
    announcementError,
    taskDetailViews,
    loadingTaskDetailId,
    taskDetailErrors,
    taskSubmitErrors,
    submittingTaskId,
    isTaskRefreshing,
    taskRefreshLabel,
    taskRefreshError,
    handleRequestTaskDetail,
    handleSubmitTaskReport,
    refreshTaskData,
    displayName: user ? getDisplayName(user.username, user.nickname) : "",
  };
}

const AccountDataContext = createContext<ReturnType<
  typeof useAccountData
> | null>(null);

export function AccountDataProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = useAccountData();
  return (
    <AccountDataContext.Provider value={value}>
      {children}
    </AccountDataContext.Provider>
  );
}

export function useAccountCenter() {
  const value = useContext(AccountDataContext);
  if (!value) throw new Error("Account pages require AccountDataProvider");
  return value;
}
