"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Bell, CheckCircle2, Eye, Loader2, Search } from "lucide-react";

import {
  AdminForbiddenSurface,
  AdminLoadingSurface,
  AdminShell,
} from "@/components/admin/AdminShell";
import { formatDateTime } from "@/components/coach/coachUtils";
import { cn } from "@/lib/utils";
import {
  adminService,
  type AdminNotificationRead,
  type AdminUserRole,
} from "@/services/admin";
import { useAuthStore } from "@/store/authStore";

const fieldClass =
  "min-h-11 w-full rounded-lg border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#65f7ff]/46 focus:bg-black/34 focus:ring-2 focus:ring-[#65f7ff]/12";
const labelClass = "text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/46";
const roles: AdminUserRole[] = ["student", "coach", "admin"];
const notificationTypes = ["announcement", "task", "report", "system"];
const businessTypes = ["announcement", "training_task", "report", "class_member"];

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
  return "border-white/10 bg-white/[0.04] text-white/58";
}

export default function AdminNotificationsPage() {
  const user = useAuthStore((state) => state.user);
  const hasInitialized = useAuthStore((state) => state.hasInitialized);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const [notifications, setNotifications] = useState<AdminNotificationRead[]>([]);
  const [selectedNotification, setSelectedNotification] = useState<AdminNotificationRead | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [businessTypeFilter, setBusinessTypeFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<AdminUserRole | "">("");
  const [readFilter, setReadFilter] = useState<"" | "true" | "false">("");
  const [keyword, setKeyword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";

  const loadNotifications = async () => {
    const response = await adminService.listNotifications({
      type: typeFilter,
      business_type: businessTypeFilter,
      user_role: roleFilter,
      is_read: readFilter === "" ? "" : readFilter === "true",
      keyword: keyword.trim(),
      limit: 100,
    });
    setNotifications(response.items);
  };

  useEffect(() => {
    if (!hasInitialized || !user || !isAdmin) {
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);

    void adminService
      .listNotifications({ limit: 100 })
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
  }, [hasInitialized, isAdmin, user]);

  const submitFilters = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await loadNotifications();
      setMessage("Notification filters applied.");
    } catch (filterError) {
      setError(filterError instanceof Error ? filterError.message : "Unable to filter notifications.");
    }
  };

  const openNotification = async (notificationPublicId: string) => {
    setError(null);
    setMessage(null);
    try {
      const detail = await adminService.getNotification(notificationPublicId);
      setSelectedNotification(detail);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "Unable to load notification detail.");
    }
  };

  if (!hasInitialized || isInitializing || !user) {
    return <AdminLoadingSurface />;
  }

  if (!isAdmin) {
    return <AdminForbiddenSurface user={user} />;
  }

  return (
    <AdminShell user={user} title="Notification Monitor" breadcrumb={["Notifications"]}>
      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {message ? (
        <div className="flex items-center gap-2 rounded-lg border border-[#d8ff5d]/24 bg-[#d8ff5d]/10 px-4 py-3 text-sm font-medium text-[#efffb8]">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]">
        <section className="min-w-0 rounded-lg border border-white/10 bg-white/[0.055] p-5 backdrop-blur-2xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className={labelClass}>System event feed</div>
              <h1 className="mt-2 font-[var(--font-display)] text-2xl font-bold text-white">
                Notifications
              </h1>
              <p className="mt-2 text-sm text-white/52">
                {notifications.filter((item) => !item.is_read).length} unread / {notifications.length} total
              </p>
            </div>
            <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-[9rem_9rem_9rem_8rem_auto]" onSubmit={submitFilters}>
              <select className={fieldClass} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="">All types</option>
                {notificationTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <select className={fieldClass} value={businessTypeFilter} onChange={(event) => setBusinessTypeFilter(event.target.value)}>
                <option value="">All business</option>
                {businessTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <select className={fieldClass} value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as AdminUserRole | "")}>
                <option value="">All roles</option>
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <select className={fieldClass} value={readFilter} onChange={(event) => setReadFilter(event.target.value as "" | "true" | "false")}>
                <option value="">Read state</option>
                <option value="false">unread</option>
                <option value="true">read</option>
              </select>
              <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/24 bg-[#65f7ff]/10 px-4 text-sm font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/16">
                <Search className="h-4 w-4" />
                Search
              </button>
            </form>
          </div>

          <div className="mt-4">
            <input
              className={fieldClass}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Search notification title or content"
            />
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-white/10 bg-black/18">
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full border-collapse text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.035] text-[0.68rem] uppercase tracking-[0.18em] text-white/42">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Notification</th>
                    <th className="px-4 py-3 font-semibold">Recipient</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Business</th>
                    <th className="px-4 py-3 font-semibold">Created</th>
                    <th className="px-4 py-3 font-semibold">Read</th>
                    <th className="px-4 py-3 text-right font-semibold">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {notifications.map((item) => (
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
                      <td className="px-4 py-4 text-white/62">
                        <div className="font-semibold text-white">{item.user_name}</div>
                        <div className="mt-1 text-xs text-white/38">{item.user_role}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn("rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em]", typeTone(item.type))}>
                          {item.type}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-white/58">
                        <div>{item.business_type || "--"}</div>
                        <div className="mt-1 max-w-[14rem] truncate font-mono text-xs text-white/34">
                          {item.business_public_id || item.business_id || "--"}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-white/62">{formatDateTime(item.created_at)}</td>
                      <td className="px-4 py-4">
                        <span className={cn("rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em]", readTone(item.is_read))}>
                          {item.is_read ? "read" : "unread"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button type="button" onClick={() => openNotification(item.public_id)} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/24 bg-[#65f7ff]/10 px-3 text-xs font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/16">
                          <Eye className="h-4 w-4" />
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))}
                  {notifications.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-white/48">
                        {isLoading ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-[#65f7ff]" />
                            Loading notifications
                          </span>
                        ) : (
                          "No notifications match the current filters."
                        )}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <aside className="rounded-lg border border-white/10 bg-white/[0.055] p-5 backdrop-blur-2xl">
          <div className={labelClass}>Notification detail</div>
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
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-black/18 p-3">
                  <div className={labelClass}>Recipient</div>
                  <div className="mt-2 text-sm font-semibold text-white">{selectedNotification.user_name}</div>
                  <div className="mt-1 text-xs text-white/42">{selectedNotification.user_role}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/18 p-3">
                  <div className={labelClass}>Created</div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    {formatDateTime(selectedNotification.created_at)}
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/18 p-3">
                <div className={labelClass}>Business reference</div>
                <div className="mt-2 break-all font-mono text-xs text-white/64">
                  {selectedNotification.business_type || "--"} /{" "}
                  {selectedNotification.business_public_id || selectedNotification.business_id || "--"}
                </div>
              </div>
              <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em]", readTone(selectedNotification.is_read))}>
                {selectedNotification.is_read ? "read" : "unread"}
              </span>
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-white/50">
              Select a notification to inspect its recipient and linked business object.
            </p>
          )}
        </aside>
      </div>
    </AdminShell>
  );
}
