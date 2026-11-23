"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ClipboardList, FileChartColumn, LineChart, Sparkles } from "lucide-react";
import { useAccountCenter } from "./AccountDataProvider";
import { StatOverviewRow } from "./StatOverviewRow";
import { WeeklyTasksSection } from "./WeeklyTasksSection";
import { GrowthTrendsSection } from "./GrowthTrendsSection";
import { MeasurementTrendsSection } from "./MeasurementTrendsSection";
import { AnnouncementInboxSection } from "./AnnouncementInboxSection";
import { ProfileSummaryCard } from "./ProfileSummaryCard";
import { NotificationInboxSection } from "./NotificationInboxSection";
import { PlayerMeasurementsSection } from "./PlayerMeasurementsSection";
import { ProfileBasicsSection } from "./ProfileBasicsSection";
import { TrainingNutritionOverview } from "./TrainingNutritionOverview";
import { routes } from "@/lib/routes";
import { useAuthStore } from "@/store/authStore";
import { PaginatedAnalysisReports } from "./PaginatedAnalysisReports";
import { sydneyDateKey } from "@/lib/profile";

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
  const { dashboard, displayName, isReportsLoading, loadError, user } =
    useAccountCenter();
  const pendingTasks = dashboard.tasks.filter((task) => task.status !== "done").slice(0, 3);
  const latestReport = dashboard.latestReport;
  return (
    <>
      <section className="relative isolate flex min-h-56 items-center overflow-hidden rounded-2xl bg-[#202721] text-[#f7faf0] sm:min-h-[16rem]">
        <div aria-hidden="true" className="absolute inset-y-0 right-0 -z-10 w-[70%] sm:w-[54%]">
          <Image
            src="/academy/basketball-court.jpg"
            alt=""
            fill
            priority
            sizes="(max-width: 640px) 70vw, 48vw"
            className="object-cover object-[60%_58%] opacity-68"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#202721_0%,rgba(32,39,33,0.44)_55%,rgba(32,39,33,0.1)_100%)]" />
        </div>
        <div className="max-w-xl px-5 py-7 sm:px-8 sm:py-10">
          <h1 className="text-balance text-3xl font-bold tracking-[-0.045em] sm:text-5xl">
            Welcome back, {displayName}
          </h1>
          <p className="mt-3 max-w-[26rem] text-pretty text-sm leading-6 text-[#dde5d8] sm:text-base">
            See what your coach has assigned and pick your next practice.
          </p>
          <Link href={routes.user.tasks} className="ui-button ui-primary mt-5">
            Training tasks <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
      <AccountPageStatus />
      {!isReportsLoading && !loadError && (
        <>
          <StatOverviewRow items={dashboard.stats} />
          <div className="grid min-w-0 gap-4 xl:grid-cols-[1.15fr_1fr]">
            <section className="ui-panel p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-x-3">
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <ClipboardList size={19} className="text-[var(--ui-chart-violet)]" aria-hidden="true" /> Up next
                </h2>
                <Link href={routes.user.tasks} className="ui-link">View all tasks <ArrowRight size={14} aria-hidden="true" /></Link>
              </div>
              {pendingTasks.length ? (
                <ul className="mt-1 divide-y divide-[var(--ui-border)]">
                  {pendingTasks.map((task) => (
                    <li key={task.id}>
                      <Link href={routes.user.tasks} className="flex min-h-14 items-center justify-between gap-3 py-2.5 hover:underline">
                        <span className="min-w-0">
                          <span className="block font-semibold">{task.title}</span>
                          <span className="mt-0.5 block text-sm text-[var(--ui-muted)]">
                            {task.className} · {task.dueLabel}
                          </span>
                        </span>
                        <ArrowRight size={16} className="shrink-0 text-[var(--ui-muted)]" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 rounded-xl bg-[var(--ui-subtle)] px-3 py-4 text-sm text-[var(--ui-muted)]">
                  No pending tasks. You can still start a video analysis anytime.
                </p>
              )}
            </section>
            <section className="ui-panel p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-x-3">
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <FileChartColumn size={19} className="text-[var(--ui-chart-teal)]" aria-hidden="true" /> Latest analysis
                </h2>
                <Link href={routes.user.reports} className="ui-link">View reports <ArrowRight size={14} aria-hidden="true" /></Link>
              </div>
              {latestReport ? (
                <Link
                  href={`${routes.pose2d.report}?id=${encodeURIComponent(latestReport.id)}`}
                  className="mt-2 flex min-h-16 items-center gap-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-subtle)] p-3 hover:underline"
                >
                  <span className="shrink-0 rounded-lg bg-[var(--ui-accent-soft)] px-3 py-2 text-lg font-bold tabular-nums text-[var(--ui-accent)]">
                    {Math.round(latestReport.score)} <span className="text-xs">pts</span>
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold">{latestReport.templateName}</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ) : (
                <p className="mt-2 rounded-xl bg-[var(--ui-subtle)] px-3 py-4 text-sm text-[var(--ui-muted)]">
                  Your saved analysis reports will appear here.
                </p>
              )}
            </section>
          </div>
        </>
      )}
      <TrainingNutritionOverview userPublicId={user?.public_id ?? null} />
      <section aria-label="Explore your training" className="grid gap-4 sm:grid-cols-2">
        {[
          { href: routes.user.trends, title: "Growth trends", detail: "See your scores and measurements over time.", icon: LineChart },
          { href: routes.user.assistant, title: "AI Coach", detail: "Get ideas for what to practice next.", icon: Sparkles },
        ].map(({ href, title, detail, icon: Icon }) => (
          <Link key={href} href={href} className="ui-panel flex items-center gap-3 p-4 hover:bg-[var(--ui-subtle)]">
            <span className="rounded-lg bg-[var(--ui-accent-soft)] p-2.5 text-[var(--ui-accent)]">
              <Icon size={20} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{title}</span>
              <span className="mt-1 block text-sm text-[var(--ui-muted)]">{detail}</span>
            </span>
            <ArrowRight size={17} className="shrink-0 text-[var(--ui-muted)]" aria-hidden="true" />
          </Link>
        ))}
      </section>
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
  return <PaginatedAnalysisReports />;
}

export function AccountTrendsPage() {
  const d = useAccountCenter();
  return (
    <>
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Growth trends</h1>
        <p className="mt-2 text-sm text-[var(--ui-muted)]">Follow your training scores and body measurements over time.</p>
      </div>
      <AccountPageStatus />
      {!d.isReportsLoading && !d.loadError && (
        <GrowthTrendsSection pointsByType={d.dashboard.trendPointsByType} />
      )}
      <MeasurementTrendsSection />
    </>
  );
}

export function AccountMessagesPage() {
  const d = useAccountCenter();
  return (
    <>
      <h1 className="text-2xl font-semibold sm:text-3xl">Notifications</h1>
      <p className="text-sm text-[var(--ui-muted)]">
        Find coach feedback, class updates and announcements.
      </p>
      <NotificationInboxSection />
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
    </>
  );
}

export function AccountProfilePage() {
  const d = useAccountCenter();
  if (!d.user) return null;
  const joinedLabel = `Joined ${sydneyDateKey(new Date(d.user.created_at)).replaceAll("-", "/")}`;
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
      <ProfileBasicsSection onSaved={(profile) => {
        const current = useAuthStore.getState().user;
        if (current && current.public_id === d.user?.public_id) {
          useAuthStore.getState().setUser({ ...current, nickname: profile.nickname, updated_at: profile.updated_at });
        }
      }} />
      <PlayerMeasurementsSection />
    </>
  );
}
