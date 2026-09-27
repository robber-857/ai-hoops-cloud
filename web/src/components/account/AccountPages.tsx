"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccountCenter } from "./AccountDataProvider";
import { StatOverviewRow } from "./StatOverviewRow";
import { WeeklyTasksSection } from "./WeeklyTasksSection";
import { GrowthTrendsSection } from "./GrowthTrendsSection";
import { RecentReportsSection } from "./RecentReportsSection";
import { AnnouncementInboxSection } from "./AnnouncementInboxSection";
import { ProfileSummaryCard } from "./ProfileSummaryCard";
import { NotificationInboxSection } from "./NotificationInboxSection";
import { routes } from "@/lib/routes";
import type { AccountAnalysisType } from "./types";

export function AccountPageStatus() {
  const data = useAccountCenter();
  if (data.isReportsLoading)
    return (
      <p role="status" className="text-sm text-white/75">
        Loading your account data…
      </p>
    );
  if (!data.loadError) return null;
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-300/30 bg-red-400/10 p-4 text-sm text-red-100"
    >
      <p>{data.loadError}</p>
      <button
        onClick={data.reload}
        className="mt-2 min-h-11 rounded-lg border border-red-200/30 px-4"
      >
        Retry loading
      </button>
    </div>
  );
}

export function AccountOverviewPage() {
  const { dashboard, displayName, isReportsLoading, loadError } =
    useAccountCenter();
  return (
    <>
      <h1 className="text-2xl font-semibold sm:text-3xl">
        Welcome back, {displayName}
      </h1>
      <AccountPageStatus />
      {!isReportsLoading && !loadError && (
        <>
          <StatOverviewRow items={dashboard.stats} />
          <section className="border-t border-white/15 py-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Training tasks</h2>
              <Link
                href={routes.user.tasks}
                className="flex min-h-11 items-center text-[#d8ff5d]"
              >
                View all tasks
              </Link>
            </div>
            <ul className="mt-3 divide-y divide-white/10">
              {dashboard.tasks
                .filter((task) => task.status !== "done")
                .slice(0, 3)
                .map((task) => (
                  <li key={task.id} className="py-4">
                    <Link
                      href={routes.user.tasks}
                      className="break-words font-medium hover:underline"
                    >
                      {task.title}
                    </Link>
                    <p className="mt-1 text-sm text-white/65">
                      {task.className} · {task.dueLabel}
                    </p>
                  </li>
                ))}
            </ul>
            {!dashboard.tasks.some((task) => task.status !== "done") && (
              <p className="mt-4 text-white/65">No pending tasks.</p>
            )}
          </section>
          <section className="border-t border-white/15 py-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Latest analysis</h2>
              <Link
                href={routes.user.reports}
                className="flex min-h-11 items-center text-[#d8ff5d]"
              >
                View reports
              </Link>
            </div>
            {dashboard.latestReport ? (
              <Link
                href={`${routes.pose2d.report}?id=${dashboard.latestReport.id}`}
                className="mt-4 block break-words text-white/80 hover:underline"
              >
                {dashboard.latestReport.templateName} ·{" "}
                {Math.round(dashboard.latestReport.score)} pts
              </Link>
            ) : (
              <p className="mt-4 text-white/65">
                Your saved analysis reports will appear here.
              </p>
            )}
          </section>
        </>
      )}
    </>
  );
}

export function AccountTasksPage() {
  const d = useAccountCenter();
  return (
    <>
      <h1 className="text-2xl font-semibold sm:text-3xl">Training tasks</h1>
      <p className="text-sm text-white/65">
        Your latest 100 assignments. Select a saved report to submit to a
        matching task.
      </p>
      <AccountPageStatus />
      {!d.isReportsLoading && !d.loadError && (
        <WeeklyTasksSection
          selectedReports={d.selectedTaskReports}
          onSelectedReportsChange={d.setSelectedTaskReports}
          tasks={d.dashboard.tasks}
          taskDetailsById={d.taskDetailViews}
          loadingTaskDetailId={d.loadingTaskDetailId}
          taskDetailErrors={d.taskDetailErrors}
          taskSubmitErrors={d.taskSubmitErrors}
          submittingTaskId={d.submittingTaskId}
          isRefreshing={d.isTaskRefreshing}
          refreshLabel={d.taskRefreshLabel}
          refreshError={d.taskRefreshError}
          onRequestTaskDetail={d.handleRequestTaskDetail}
          onSubmitReport={d.handleSubmitTaskReport}
          onRefresh={() => void d.refreshTaskData()}
        />
      )}
    </>
  );
}

export function AccountReportsPage() {
  const d = useAccountCenter();
  const [type, setType] = useState<AccountAnalysisType | "all">("all");
  const [visible, setVisible] = useState(20);
  const reports = d.dashboard.recentReports.filter(
    (report) => type === "all" || report.analysisType === type,
  );
  return (
    <>
      <h1 className="text-2xl font-semibold sm:text-3xl">Analysis reports</h1>
      <p className="text-sm text-white/65">
        Latest 60 saved reports across all analysis types. Filters apply to this
        recent history.
      </p>
      <label className="flex flex-wrap items-center gap-3 text-sm">
        Analysis type
        <select
          value={type}
          onChange={(event) => {
            setType(event.target.value as typeof type);
            setVisible(20);
          }}
          className="min-h-11 rounded-lg border border-white/20 bg-[#10141b] px-3"
        >
          <option value="all">All types</option>
          <option value="shooting">Shooting</option>
          <option value="dribbling">Dribbling</option>
          <option value="training">Training</option>
        </select>
      </label>
      <AccountPageStatus />
      {!d.isReportsLoading && !d.loadError && (
        <>
          {reports.length ? (
            <RecentReportsSection
              reports={reports.slice(0, visible)}
              source={d.reportSource}
            />
          ) : (
            <p className="py-8 text-white/70">
              No saved reports match this filter.
            </p>
          )}
          {visible < reports.length && (
            <button
              className="min-h-11 self-start rounded-lg border border-white/20 px-5"
              onClick={() => setVisible((count) => count + 20)}
            >
              Show more reports
            </button>
          )}
          <p className="text-sm text-white/60">
            Showing {Math.min(visible, reports.length)} of {reports.length}{" "}
            loaded reports.
          </p>
        </>
      )}
    </>
  );
}

export function AccountTrendsPage() {
  const d = useAccountCenter();
  return (
    <>
      <h1 className="text-2xl font-semibold sm:text-3xl">Growth trends</h1>
      <p className="text-sm text-white/65">
        Scores from saved motion analysis reports. Choose an analysis type and
        date range below.
      </p>
      <AccountPageStatus />
      {!d.isReportsLoading && !d.loadError && (
        <GrowthTrendsSection
          pointsByType={d.dashboard.trendPointsByType}
          source={d.reportSource}
        />
      )}
    </>
  );
}

export function AccountMessagesPage() {
  const d = useAccountCenter();
  return (
    <>
      <h1 className="text-2xl font-semibold sm:text-3xl">Messages</h1>
      <p className="text-sm text-white/65">
        Latest 100 announcements from your coaches and admins.
      </p>
      <AccountPageStatus />
      {d.announcementError && (
        <p role="alert" className="text-sm text-red-200">
          {d.announcementError}
        </p>
      )}
      {!d.isReportsLoading && !d.loadError && (
        <AnnouncementInboxSection
          announcements={d.announcements}
          unreadCount={d.unreadAnnouncementCount}
          expandedId={d.expandedAnnouncementId}
          onToggle={d.handleAnnouncementToggle}
        />
      )}
      <NotificationInboxSection />
    </>
  );
}

export function AccountProfilePage() {
  const d = useAccountCenter();
  if (!d.user) return null;
  const joinedLabel = `Joined ${new Intl.DateTimeFormat("en-AU", { month: "short", year: "numeric" }).format(new Date(d.user.created_at))}`;
  return (
    <>
      <h1 className="text-2xl font-semibold sm:text-3xl">Personal profile</h1>
      <AccountPageStatus />
      <ProfileSummaryCard
        user={d.user}
        latestReport={d.dashboard.latestReport}
        reportSource={d.reportSource}
        displayName={d.displayName}
        joinedLabel={joinedLabel}
      />
    </>
  );
}
