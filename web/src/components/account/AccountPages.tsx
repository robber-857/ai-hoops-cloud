"use client";
import { usePlayerCopy } from "@/components/account/playerCopy";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CalendarDays, ClipboardList, FileChartColumn, LineChart, Sparkles } from "lucide-react";
import { useAccountCenter } from "./AccountDataProvider";
import { StatOverviewRow } from "./StatOverviewRow";
import { OverviewActivity } from "./OverviewActivity";
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
  const { t } = usePlayerCopy();
  const data = useAccountCenter();
  if (data.isReportsLoading)
    return (
      <p role="status" className="text-sm text-white/75">
        {t("Loading your account data…")}
      </p>
    );
  if (!data.loadError) return null;
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-300/30 bg-red-400/10 p-4 text-sm text-red-100"
    >
      <p>{t(data.loadError)}</p>
      <button
        onClick={data.reload}
        className="mt-2 min-h-11 rounded-lg border border-red-200/30 px-4"
      >
        {t("Retry loading")}
      </button>
    </div>
  );
}

export function AccountOverviewPage() {
  const { t, locale } = usePlayerCopy();
  const { dashboard, displayName, isReportsLoading, loadError, user } =
    useAccountCenter();
  const pendingTasks = dashboard.tasks.filter((task) => task.status !== "done").slice(0, 3);
  const latestReport = dashboard.latestReport;
  const today = sydneyDateKey();
  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  }).format(new Date(`${today}T00:00:00Z`));

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div>
          <time dateTime={today} className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--ui-muted)]">
            <CalendarDays size={14} className="text-[var(--ui-accent)]" aria-hidden="true" /> {dateLabel}
          </time>
          <h1 className="text-3xl font-bold tracking-[-0.04em] sm:text-4xl">{t("Welcome back,")} {displayName}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={routes.user.tasks} className="ui-button ui-primary">
            {t("Training tasks")} <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href={routes.user.assistant} className="ui-button">
            <Sparkles size={16} aria-hidden="true" /> {t("AI Coach")}
          </Link>
        </div>
      </header>
      <AccountPageStatus />
      {!isReportsLoading && !loadError && (
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(17rem,1fr)] xl:[reading-flow:grid-rows]">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:col-start-2 xl:row-start-1 xl:grid-cols-1">
            <section className="ui-panel overflow-hidden" aria-labelledby="overview-up-next">
              <div className="relative isolate flex min-h-20 items-end bg-[#202721] px-4 py-3 sm:px-5">
                <Image
                  src="/academy/basketball-court.jpg"
                  alt=""
                  fill
                  sizes="(min-width: 1280px) 28vw, (min-width: 640px) 50vw, 100vw"
                  className="-z-20 object-cover object-[65%_54%] opacity-75"
                />
                <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#202721_0%,rgba(32,39,33,0.83)_42%,rgba(32,39,33,0.23)_100%)]" />
                <h2 id="overview-up-next" className="flex items-center gap-2 text-lg font-bold text-[#f7faf0]">
                  <ClipboardList size={19} aria-hidden="true" /> {t("Up next")}
                </h2>
              </div>
              {pendingTasks.length > 0 ? (
                <ul className="divide-y divide-[var(--ui-border)] px-4 sm:px-5">
                  {pendingTasks.map((task) => {
                    const progress = Math.round(task.progress * 100);
                    return (
                      <li key={task.id}>
                        <Link href={routes.user.tasks} className="group flex min-h-14 items-center justify-between gap-3 rounded-md py-3">
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold group-hover:underline">{task.title}</span>
                            <span className="mt-1 block text-xs text-[var(--ui-muted)]">
                              {task.className} · {task.dueLabel}
                            </span>
                            {progress > 0 && (
                              <span className="mt-2 flex items-center gap-2">
                                <span aria-hidden="true" className="h-1.5 max-w-32 flex-1 overflow-hidden rounded-full bg-[var(--ui-subtle)]">
                                  <span className="block h-full rounded-full bg-[var(--ui-chart-green)]" style={{ width: `${progress}%` }} />
                                </span>
                                <span className="text-xs font-semibold text-[var(--ui-muted)]">{progress}{t("% complete")}</span>
                              </span>
                            )}
                          </span>
                          <ArrowRight size={15} className="shrink-0 text-[var(--ui-muted)]" aria-hidden="true" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-4 py-5 text-sm text-[var(--ui-muted)] sm:px-5">
                  {t("No pending tasks.")}
                </p>
              )}
            </section>
            <section className="ui-panel p-4 sm:p-5" aria-labelledby="overview-latest-analysis">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                <h2 id="overview-latest-analysis" className="flex items-center gap-2 text-base font-bold">
                  <FileChartColumn size={17} className="text-[var(--ui-accent)]" aria-hidden="true" /> {t("Latest analysis")}
                </h2>
                <Link href={routes.user.reports} className="ui-link">{t("All reports")} <ArrowRight size={14} aria-hidden="true" /></Link>
              </div>
              {latestReport ? (
                <Link
                  href={`${routes.pose2d.report}?id=${encodeURIComponent(latestReport.id)}`}
                  className="mt-1 flex min-h-14 items-center gap-3 rounded-xl bg-[var(--ui-subtle)] p-3 hover:underline"
                >
                  <span className="min-w-0 flex-1 text-sm font-semibold">{latestReport.templateName}</span>
                  <span className="shrink-0 text-xl font-bold tabular-nums text-[var(--ui-accent)]">
                    {Math.round(latestReport.score)} <span className="text-xs font-semibold">{t("pts")}</span>
                  </span>
                </Link>
              ) : (
                <p className="mt-1 text-sm leading-6 text-[var(--ui-muted)]">
                  {t("No saved analysis reports yet.")}
                </p>
              )}
            </section>
          </div>
          <section className="ui-panel p-4 sm:p-5 xl:col-start-1 xl:row-start-1" aria-labelledby="overview-progress-title">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h2 id="overview-progress-title" className="flex items-center gap-2 text-lg font-bold tracking-tight">
                <LineChart size={19} className="text-[var(--ui-accent)]" aria-hidden="true" /> {t("Training progress")}
              </h2>
              <Link href={routes.user.trends} className="ui-link">
                {t("Growth trends")} <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <StatOverviewRow items={dashboard.stats} />
            <OverviewActivity pointsByType={dashboard.trendPointsByType} today={today} />
          </section>
        </div>
      )}
      <TrainingNutritionOverview userPublicId={user?.public_id ?? null} />
    </>
  );
}

export function AccountTasksPage() {
  const { t } = usePlayerCopy();
  const d = useAccountCenter();
  return (
    <>
      <h1 className="text-2xl font-semibold sm:text-3xl">{t("Training tasks")}</h1>
      <p className="text-sm text-white/65">
        {t("Your latest 100 assignments. Select a saved report to submit to a matching task.")}
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
  const { t } = usePlayerCopy();
  const d = useAccountCenter();
  return (
    <>
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("Growth trends")}</h1>
        <p className="mt-2 text-sm text-[var(--ui-muted)]">{t("Follow your training scores and body measurements over time.")}</p>
      </div>
      <AccountPageStatus />
      {!d.isReportsLoading && !d.loadError && d.user && (
        <GrowthTrendsSection
          key={d.user.public_id}
          initialType={d.dashboard.latestReport?.analysisType}
        />
      )}
      <MeasurementTrendsSection />
    </>
  );
}

export function AccountMessagesPage() {
  const { t } = usePlayerCopy();
  const d = useAccountCenter();
  return (
    <>
      <h1 className="text-2xl font-semibold sm:text-3xl">{t("Notifications")}</h1>
      <p className="text-sm text-[var(--ui-muted)]">
        {t("Find coach feedback, class updates and announcements.")}
      </p>
      <NotificationInboxSection />
      <AccountPageStatus />
      {d.announcementError && (
        <p role="alert" className="text-sm text-red-200">
          {t(d.announcementError)}
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
  const { t, isChinese } = usePlayerCopy();
  const d = useAccountCenter();
  if (!d.user) return null;
  const joinedLabel = `${isChinese ? "加入日期" : "Joined"} ${sydneyDateKey(new Date(d.user.created_at)).replaceAll("-", "/")}`;
  return (
    <>
      <h1 className="text-2xl font-semibold sm:text-3xl">{t("Personal profile")}</h1>
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
