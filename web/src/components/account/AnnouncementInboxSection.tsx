import { Bell, CheckCircle2, ChevronDown, Pin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { AccountAnnouncement } from "./types";

type AnnouncementInboxSectionProps = {
  announcements: AccountAnnouncement[];
  unreadCount: number;
  expandedId: string | null;
  onToggle: (announcement: AccountAnnouncement) => void;
};

function formatAnnouncementDate(input: string) {
  return new Intl.DateTimeFormat("en-AU", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(input));
}

export function AnnouncementInboxSection({
  announcements,
  unreadCount,
  expandedId,
  onToggle,
}: AnnouncementInboxSectionProps) {
  return (
    <section className="analysis-surface rounded-[32px] border border-white/10 p-5 sm:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#65f7ff]/24 bg-[#65f7ff]/10 text-[#bff8ff]">
            <Bell className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="text-[0.72rem] uppercase tracking-[0.28em] text-white/42">
              Announcements
            </div>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Messages from coaches and admins
            </h2>
          </div>
        </div>
        <Badge
          className={cn(
            "w-fit border",
            unreadCount > 0
              ? "border-[#d8ff5d]/24 bg-[#d8ff5d]/12 text-[#e8ff9a]"
              : "border-white/12 bg-white/[0.04] text-white/58",
          )}
        >
          {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        </Badge>
      </div>

      <div className="mt-5 divide-y divide-white/8 overflow-hidden rounded-[24px] border border-white/10 bg-black/18">
        {announcements.map((announcement) => {
          const isExpanded = expandedId === announcement.id;

          return (
            <button
              type="button"
              key={announcement.id}
              onClick={() => onToggle(announcement)}
              className="block w-full px-4 py-4 text-left transition hover:bg-white/[0.04]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {announcement.isPinned ? (
                      <Pin className="h-3.5 w-3.5 text-[#d8ff5d]" />
                    ) : null}
                    <span className="text-base font-semibold text-white">
                      {announcement.title}
                    </span>
                    {!announcement.isRead ? (
                      <span className="h-2 w-2 rounded-full bg-[#d8ff5d]" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-white/34" />
                    )}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/36">
                    {announcement.scopeLabel} / {formatAnnouncementDate(announcement.publishedAt)}
                  </div>
                </div>
                <ChevronDown
                  className={cn(
                    "mt-1 h-4 w-4 shrink-0 text-white/42 transition-transform",
                    isExpanded ? "rotate-180" : "",
                  )}
                />
              </div>
              {isExpanded ? (
                <p className="mt-3 max-w-4xl text-sm leading-6 text-white/62">
                  {announcement.content}
                </p>
              ) : null}
            </button>
          );
        })}

        {announcements.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-white/48">
            No announcements for your account yet.
          </div>
        ) : null}
      </div>
    </section>
  );
}
