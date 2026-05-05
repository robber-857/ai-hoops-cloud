"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Megaphone,
  Pin,
  ShieldAlert,
} from "lucide-react";

import { CoachShell } from "@/components/coach/CoachShell";
import { formatDateTime } from "@/components/coach/coachUtils";
import { cn } from "@/lib/utils";
import {
  meService,
  type AnnouncementSummaryRead,
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
          Loading announcements
        </div>
      </div>
    </main>
  );
}

function scopeLabel(item: AnnouncementSummaryRead) {
  if (item.scope_type === "class") {
    return item.class_name ?? "Class";
  }
  if (item.scope_type === "camp") {
    return item.camp_name ?? "Camp";
  }
  if (item.scope_type === "role") {
    return item.target_role ? `${item.target_role} role` : "Role";
  }
  return "Global";
}

function scopeTone(scopeType: string) {
  if (scopeType === "class") {
    return "border-[#d8ff5d]/24 bg-[#d8ff5d]/10 text-[#e8ff9a]";
  }
  if (scopeType === "camp") {
    return "border-[#65f7ff]/24 bg-[#65f7ff]/10 text-[#dffbff]";
  }
  if (scopeType === "role") {
    return "border-[#a78bfa]/28 bg-[#8b5cf6]/12 text-[#ddd6fe]";
  }
  return "border-white/10 bg-white/[0.04] text-white/58";
}

export default function CoachAnnouncementsPage() {
  const user = useAuthStore((state) => state.user);
  const hasInitialized = useAuthStore((state) => state.hasInitialized);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const [announcements, setAnnouncements] = useState<AnnouncementSummaryRead[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState("");
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
      .getAnnouncements(100)
      .then((response) => {
        if (isActive) {
          setAnnouncements(response.items);
        }
      })
      .catch((fetchError) => {
        if (isActive) {
          setError(fetchError instanceof Error ? fetchError.message : "Unable to load announcements.");
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

  const filteredAnnouncements = useMemo(
    () =>
      announcements.filter((item) => {
        if (scopeFilter && item.scope_type !== scopeFilter) {
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
    [announcements, readFilter, scopeFilter],
  );

  const unreadCount = announcements.filter((item) => !item.is_read).length;

  const toggleAnnouncement = async (item: AnnouncementSummaryRead) => {
    setExpandedId((current) => (current === item.public_id ? null : item.public_id));

    if (item.is_read) {
      return;
    }

    setAnnouncements((current) =>
      current.map((announcement) =>
        announcement.public_id === item.public_id
          ? { ...announcement, is_read: true }
          : announcement,
      ),
    );

    try {
      await meService.markAnnouncementRead(item.public_id);
    } catch (readError) {
      setError(readError instanceof Error ? readError.message : "Unable to mark announcement read.");
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
    <CoachShell user={user} title="Announcements" breadcrumb={["Announcements"]}>
      <section className="rounded-lg border border-white/10 bg-white/[0.055] p-5 backdrop-blur-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[0.68rem] uppercase tracking-[0.22em] text-white/42">
              Broadcast inbox
            </div>
            <h1 className="mt-2 font-[var(--font-display)] text-2xl font-bold text-white">
              Admin and class announcements
            </h1>
            <p className="mt-2 text-sm text-white/52">
              {unreadCount} unread / {announcements.length} total
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              className={fieldClass}
              value={scopeFilter}
              onChange={(event) => setScopeFilter(event.target.value)}
            >
              <option value="">All scopes</option>
              <option value="global">global</option>
              <option value="camp">camp</option>
              <option value="class">class</option>
              <option value="role">role</option>
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

        {error ? (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="mt-5 divide-y divide-white/8 overflow-hidden rounded-lg border border-white/10 bg-black/18">
          {filteredAnnouncements.map((item) => {
            const isExpanded = expandedId === item.public_id;

            return (
              <article key={item.public_id} className="transition hover:bg-[#65f7ff]/[0.045]">
                <button
                  type="button"
                  onClick={() => toggleAnnouncement(item)}
                  className="w-full px-4 py-4 text-left"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.is_pinned ? <Pin className="h-4 w-4 text-[#d8ff5d]" /> : null}
                        <Megaphone className="h-4 w-4 text-[#65f7ff]" />
                        <span className="font-semibold text-white">{item.title}</span>
                        {!item.is_read ? (
                          <span className="h-2 w-2 rounded-full bg-[#d8ff5d]" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-white/32" />
                        )}
                      </div>
                      <div className="mt-2 text-xs uppercase tracking-[0.16em] text-white/38">
                        {scopeLabel(item)} / {formatDateTime(item.publish_at ?? item.created_at)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em]", scopeTone(item.scope_type))}>
                        {item.scope_type}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-white/42 transition-transform",
                          isExpanded ? "rotate-180" : "",
                        )}
                      />
                    </div>
                  </div>
                  {isExpanded ? (
                    <p className="mt-4 max-w-4xl text-sm leading-6 text-white/62">
                      {item.content}
                    </p>
                  ) : null}
                </button>
              </article>
            );
          })}

          {filteredAnnouncements.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-white/48">
              {isLoading ? "Loading announcements." : "No announcements match the current filters."}
            </div>
          ) : null}
        </div>
      </section>
    </CoachShell>
  );
}
