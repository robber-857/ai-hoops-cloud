"use client";

import { Fragment, useState } from "react";
import { Archive, Loader2, Megaphone, Pencil, Pin, PinOff, Save, X } from "lucide-react";

import { formatDateTime } from "@/components/coach/coachUtils";
import { cn } from "@/lib/utils";
import type { CoachAnnouncementRead, CoachUpdateAnnouncementPayload } from "@/services/coach";

type CoachAnnouncementTableProps = {
  announcements: CoachAnnouncementRead[];
  updatingAnnouncementId: string | null;
  selectedAnnouncementIds: string[];
  onSelectedAnnouncementIdsChange: (ids: string[]) => void;
  onPatch: (announcement: CoachAnnouncementRead, patch: CoachUpdateAnnouncementPayload) => void;
};

const fieldClass =
  "min-h-10 w-full rounded-lg border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#65f7ff]/46 focus:bg-black/34 focus:ring-2 focus:ring-[#65f7ff]/12";
const labelClass = "text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/46";

function statusTone(status: string) {
  if (status === "archived" || status === "expired") {
    return "border-white/10 bg-white/[0.04] text-white/48";
  }

  if (status === "published") {
    return "border-[#d8ff5d]/24 bg-[#d8ff5d]/10 text-[#e8ff9a]";
  }

  return "border-[#65f7ff]/24 bg-[#65f7ff]/10 text-[#dffbff]";
}

function toDateTimeLocal(value: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 16);
}

function toApiDate(value: string) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

export function CoachAnnouncementTable({
  announcements,
  updatingAnnouncementId,
  selectedAnnouncementIds,
  onSelectedAnnouncementIdsChange,
  onPatch,
}: CoachAnnouncementTableProps) {
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editStatus, setEditStatus] = useState("published");
  const [editPinned, setEditPinned] = useState(false);
  const [editPublishAt, setEditPublishAt] = useState("");
  const [editExpireAt, setEditExpireAt] = useState("");

  const toggleSelected = (announcementPublicId: string, checked: boolean) => {
    if (checked) {
      onSelectedAnnouncementIdsChange([
        ...new Set([...selectedAnnouncementIds, announcementPublicId]),
      ]);
      return;
    }
    onSelectedAnnouncementIdsChange(
      selectedAnnouncementIds.filter((id) => id !== announcementPublicId),
    );
  };

  const beginEdit = (announcement: CoachAnnouncementRead) => {
    setEditingAnnouncementId(announcement.public_id);
    setEditTitle(announcement.title);
    setEditContent(announcement.content);
    setEditStatus(announcement.status);
    setEditPinned(announcement.is_pinned);
    setEditPublishAt(toDateTimeLocal(announcement.publish_at));
    setEditExpireAt(toDateTimeLocal(announcement.expire_at));
  };

  const submitEdit = (
    event: React.FormEvent<HTMLFormElement>,
    announcement: CoachAnnouncementRead,
  ) => {
    event.preventDefault();
    onPatch(announcement, {
      title: editTitle.trim(),
      content: editContent.trim(),
      status: editStatus,
      is_pinned: editPinned,
      publish_at: toApiDate(editPublishAt),
      expire_at: toApiDate(editExpireAt),
    });
    setEditingAnnouncementId(null);
  };

  if (announcements.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/18 p-8 text-center">
        <Megaphone className="mx-auto h-8 w-8 text-[#65f7ff]/70" />
        <div className="mt-4 font-[var(--font-display)] text-lg font-semibold text-white">
          No announcements yet.
        </div>
        <p className="mt-2 text-sm text-white/52">Published notices will appear here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-black/18">
      <div className="overflow-x-auto">
        <table className="min-w-[920px] w-full border-collapse text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.035] text-[0.68rem] uppercase tracking-[0.18em] text-white/42">
            <tr>
              <th className="px-4 py-3 font-semibold">Pick</th>
              <th className="px-4 py-3 font-semibold">Announcement</th>
              <th className="px-4 py-3 font-semibold">Window</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {announcements.map((announcement) => {
              const isUpdating = updatingAnnouncementId === announcement.public_id;

              return (
                <Fragment key={announcement.public_id}>
                <tr
                  className="transition-colors hover:bg-[#65f7ff]/[0.055]"
                >
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedAnnouncementIds.includes(announcement.public_id)}
                      onChange={(event) => toggleSelected(announcement.public_id, event.target.checked)}
                      className="h-4 w-4 accent-[#d8ff5d]"
                      aria-label={`Select ${announcement.title}`}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      {announcement.is_pinned ? (
                        <Pin className="h-4 w-4 text-[#d8ff5d]" />
                      ) : null}
                      <div className="font-semibold text-white">{announcement.title}</div>
                    </div>
                    <div className="mt-1 max-w-[30rem] truncate text-xs text-white/42">
                      {announcement.content}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-white/62">
                    <div>{formatDateTime(announcement.publish_at)}</div>
                    <div className="mt-1 text-xs text-white/38">
                      Expires {formatDateTime(announcement.expire_at)}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em]",
                        statusTone(announcement.status),
                      )}
                    >
                      {announcement.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => beginEdit(announcement)}
                        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/24 bg-[#65f7ff]/10 px-3 text-xs font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/16"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() =>
                          onPatch(announcement, { is_pinned: !announcement.is_pinned })
                        }
                        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/24 bg-[#65f7ff]/10 px-3 text-xs font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/16 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isUpdating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : announcement.is_pinned ? (
                          <PinOff className="h-4 w-4" />
                        ) : (
                          <Pin className="h-4 w-4" />
                        )}
                        {announcement.is_pinned ? "Unpin" : "Pin"}
                      </button>
                      <button
                        type="button"
                        disabled={isUpdating || announcement.status === "archived"}
                        onClick={() => onPatch(announcement, { status: "archived" })}
                        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 text-xs font-semibold text-white/72 transition hover:border-[#d8ff5d]/24 hover:bg-[#d8ff5d]/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Archive className="h-4 w-4" />
                        Archive
                      </button>
                    </div>
                  </td>
                </tr>
                {editingAnnouncementId === announcement.public_id ? (
                  <tr className="bg-[#65f7ff]/[0.035]">
                    <td colSpan={5} className="px-4 py-4">
                      <form className="grid gap-4 lg:grid-cols-2" onSubmit={(event) => submitEdit(event, announcement)}>
                        <label className="block space-y-2">
                          <span className={labelClass}>Title</span>
                          <input className={fieldClass} value={editTitle} onChange={(event) => setEditTitle(event.target.value)} required />
                        </label>
                        <label className="block space-y-2">
                          <span className={labelClass}>Status</span>
                          <select className={fieldClass} value={editStatus} onChange={(event) => setEditStatus(event.target.value)}>
                            <option value="draft">draft</option>
                            <option value="published">published</option>
                            <option value="expired">expired</option>
                            <option value="archived">archived</option>
                          </select>
                        </label>
                        <label className="block space-y-2 lg:col-span-2">
                          <span className={labelClass}>Content</span>
                          <textarea className={`${fieldClass} min-h-24 resize-none py-3`} value={editContent} onChange={(event) => setEditContent(event.target.value)} required />
                        </label>
                        <label className="flex min-h-10 items-center justify-between gap-4 rounded-lg border border-white/10 bg-black/20 px-3">
                          <span className="text-sm font-semibold text-white/72">Pin to top</span>
                          <input
                            type="checkbox"
                            checked={editPinned}
                            onChange={(event) => setEditPinned(event.target.checked)}
                            className="h-4 w-4 accent-[#d8ff5d]"
                          />
                        </label>
                        <label className="block space-y-2">
                          <span className={labelClass}>Publish</span>
                          <input className={fieldClass} type="datetime-local" value={editPublishAt} onChange={(event) => setEditPublishAt(event.target.value)} />
                        </label>
                        <label className="block space-y-2">
                          <span className={labelClass}>Expire</span>
                          <input className={fieldClass} type="datetime-local" value={editExpireAt} onChange={(event) => setEditExpireAt(event.target.value)} />
                        </label>
                        <div className="flex items-end justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingAnnouncementId(null)}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-4 text-sm font-semibold text-white/70 transition hover:bg-white/[0.08]"
                          >
                            <X className="h-4 w-4" />
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#d8ff5d]/24 bg-[#d8ff5d]/10 px-4 text-sm font-semibold text-[#f1ffc1] transition hover:bg-[#d8ff5d]/16"
                          >
                            <Save className="h-4 w-4" />
                            Save notice
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
