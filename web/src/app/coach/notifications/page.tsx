"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Eye,
  Loader2,
  ShieldAlert,
} from "lucide-react";

import { CoachShell } from "@/components/coach/CoachShell";
import { formatDateTime } from "@/components/coach/coachUtils";
import { cn } from "@/lib/utils";
import {
  meService,
  type NotificationSummaryRead,
} from "@/services/me";
import { useAuthStore } from "@/store/authStore";

const fieldClass =
  "min-h-11 rounded-lg border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition focus:border-[#65f7ff]/46 focus:ring-2 focus:ring-[#65f7ff]/12";

function CoachRouteLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#030712] text-white">
      <div className="rounded-lg border border-white/10 bg-white/[0.055] px-8 py-7 text-center shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
        <Loader2 className="mx-auto h-9 w-9 animate-spin text-[#65f7ff]" />
        <div className="mt-4 text-[0.72rem] uppercase tracking-[0.28em] text-white/48">
          Loading notifications
        </div>
      </div>
    </main>
  );
}

function readTone(isRead: boolean) {
  if (isRead) {
    return "border-white/10 bg-white/[0.04] text-white/48";
  }
  return "border-[#d8ff5d]/24 bg-[#d8ff5d]/10 text-[#e8ff9a]";
}

function typeTone(type: string) {
  if (type === "announcement") {
    return "border-[#65f7ff]/24 bg-[#65f7ff]/10 text-[#dffbff]";
  }
  if (type === "task") {
    return "border-[#d8ff5d]/24 bg-[#d8ff5d]/10 text-[#e8ff9a]";
  }
  if (type === "report") {
    return "border-[#a78bfa]/28 bg-[#8b5cf6]/12 text-[#ddd6fe]";
  }
  return "border-white/10 bg-white/[0.04] text-white/58";
}

export default function CoachNotificationsPage() {
  const user = useAuthStore((state) => state.user);
  const hasInitialized = useAuthStore((state) => state.hasInitialized);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const [notifications, setNotifications] = useState<NotificationSummaryRead[]>([]);
  const [selectedNotification, setSelectedNotification] =
    useState<NotificationSummaryRead | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [readFilter, setReadFilter] = useState("");
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

    void meService
      .getNotifications(100)
      .then((response) => {
        if (isActive) {
          setNotifications(response.items);
        }
      })
      .catch((fetchError) => {
        if (isActive) {
          setError(fetchError instanceof Error ? fetchError.message : "Unable to load notifications.");
        }
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

  const filteredNotifications = useMemo(
    () =>
      notifications.filter((item) => {
        if (typeFilter && item.type !== typeFilter) {
          return false;
        }
        if (readFilter === "unread" && item.is_read) {
          return false;
        }
        if (readFilter === "read" && !item.is_read) {
          return false;
        }
        return true;
      }),
    [notifications, readFilter, typeFilter],
  );

  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const notificationTypes = Array.from(new Set(notifications.map((item) => item.type))).sort();

  const openNotification = async (item: NotificationSummaryRead) => {
    setSelectedNotification(item);

    if (item.is_read) {
      return;
    }

    setNotifications((current) =>
      current.map((notification) =>
        notification.public_id === item.public_id
          ? { ...notification, is_read: true, read_at: new Date().toISOString() }
          : notification,
      ),
    );

    try {
      const updated = await meService.markNotificationRead(item.public_id);
      setSelectedNotification(updated);
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "Unable to mark notification read.");
    }
  };

  if (!hasInitialized || isInitializing || !user) {
    return <CoachRouteLoading />;
  }

  if (!canAccessCoach) {
    return (
      <CoachShell user={user} title="Coach access required" breadcrumb={["Access"]}>
        <section className="rounded-lg border border-red-400/20 bg-red-500/10 p-8 text-center backdrop-blur-2xl">
          <ShieldAlert className="mx-auto h-10 w-10 text-red-200" />
          <h2 className="mt-5 font-[var(--font-display)] text-2xl font-bold text-white">
            This workspace is available to coaches only.
          </h2>
        </section>
      </CoachShell>
    );
  }

  return (
    <CoachShell user={user} title="Notifications" breadcrumb={["Notifications"]}>
      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <section className="min-w-0 rounded-lg border border-white/10 bg-white/[0.055] p-5 backdrop-blur-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[0.68rem] uppercase tracking-[0.22em] text-white/42">
                Event inbox
              </div>
              <h1 className="mt-2 font-[var(--font-display)] text-2xl font-bold text-white">
                Your notification stream
              </h1>
              <p className="mt-2 text-sm text-white/52">
                {unreadCount} unread / {notifications.length} total
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                className={fieldClass}
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
              >
                <option value="">All types</option>
                {notificationTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <select
                className={fieldClass}
                value={readFilter}
                onChange={(event) => setReadFilter(event.target.value)}
              >
                <option value="">All read states</option>
                <option value="unread">unread</option>
                <option value="read">read</option>
              </select>
              {isLoading ? (
                <span className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-black/18 px-3 text-sm text-white/58">
                  <Loader2 className="h-4 w-4 animate-spin text-[#65f7ff]" />
                  Loading
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-white/10 bg-black/18">
            <div className="overflow-x-auto">
              <table className="min-w-[860px] w-full border-collapse text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.035] text-[0.68rem] uppercase tracking-[0.18em] text-white/42">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Notification</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Business</th>
                    <th className="px-4 py-3 font-semibold">Created</th>
                    <th className="px-4 py-3 font-semibold">Read</th>
                    <th className="px-4 py-3 text-right font-semibold">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {filteredNotifications.map((item) => (
                    <tr key={item.public_id} className="transition hover:bg-[#65f7ff]/[0.055]">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 font-semibold text-white">
                          <Bell className="h-4 w-4 text-[#65f7ff]" />
                          {item.title}
                        </div>
                        <div className="mt-1 max-w-[24rem] truncate text-xs text-white/42">
                          {item.content || "No content"}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn("rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em]", typeTone(item.type))}>
                          {item.type}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-white/58">
                        <div>{item.business_type || "--"}</div>
                        <div className="mt-1 font-mono text-xs text-white/34">
                          {item.business_id ?? "--"}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-white/62">{formatDateTime(item.created_at)}</td>
                      <td className="px-4 py-4">
                        <span className={cn("rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em]", readTone(item.is_read))}>
                          {item.is_read ? "read" : "unread"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => openNotification(item)}
                          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/24 bg-[#65f7ff]/10 px-3 text-xs font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/16"
                        >
                          <Eye className="h-4 w-4" />
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredNotifications.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-white/48">
                        {isLoading ? "Loading notifications." : "No notifications match the current filters."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <aside className="rounded-lg border border-white/10 bg-white/[0.055] p-5 backdrop-blur-2xl">
          <div className="text-[0.68rem] uppercase tracking-[0.22em] text-white/42">
            Notification detail
          </div>
          {selectedNotification ? (
            <div className="mt-4 space-y-4">
              <div>
                <h2 className="font-[var(--font-display)] text-xl font-bold text-white">
                  {selectedNotification.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/54">
                  {selectedNotification.content || "No notification content."}
                </p>
              </div>
              <div className="grid gap-3">
                <div className="rounded-lg border border-white/10 bg-black/18 p-3">
                  <div className="text-[0.68rem] uppercase tracking-[0.18em] text-white/42">
                    Created
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    {formatDateTime(selectedNotification.created_at)}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/18 p-3">
                  <div className="text-[0.68rem] uppercase tracking-[0.18em] text-white/42">
                    Business reference
                  </div>
                  <div className="mt-2 break-all font-mono text-xs text-white/64">
                    {selectedNotification.business_type || "--"} / {selectedNotification.business_id ?? "--"}
                  </div>
                </div>
              </div>
              <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em]", readTone(selectedNotification.is_read))}>
                {selectedNotification.is_read ? "read" : "unread"}
              </span>
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-white/50">
              Select a notification to inspect its content and linked business object.
            </p>
          )}
        </aside>
      </div>
    </CoachShell>
  );
}
