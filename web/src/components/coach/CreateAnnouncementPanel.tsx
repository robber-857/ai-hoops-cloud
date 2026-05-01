"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Megaphone } from "lucide-react";

import {
  coachService,
  type CoachAnnouncementRead,
} from "@/services/coach";

type CreateAnnouncementPanelProps = {
  classPublicId: string;
  onCreated?: (announcement: CoachAnnouncementRead) => void;
};

const fieldClass =
  "min-h-11 w-full rounded-lg border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#65f7ff]/46 focus:bg-black/34 focus:ring-2 focus:ring-[#65f7ff]/12";

const labelClass = "text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/46";

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

export function CreateAnnouncementPanel({
  classPublicId,
  onCreated,
}: CreateAnnouncementPanelProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [publishAt, setPublishAt] = useState("");
  const [expireAt, setExpireAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const announcement = await coachService.createClassAnnouncement(classPublicId, {
        title: title.trim(),
        content: content.trim(),
        status: "published",
        is_pinned: isPinned,
        publish_at: toApiDate(publishAt),
        expire_at: toApiDate(expireAt),
      });

      setMessage(isPinned ? "Pinned announcement published." : "Announcement published.");
      setTitle("");
      setContent("");
      setIsPinned(false);
      onCreated?.(announcement);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to publish.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.055] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
      <div>
        <div className={labelClass}>Broadcast channel</div>
        <h2 className="mt-2 font-[var(--font-display)] text-xl font-bold text-white">
          Publish announcement
        </h2>
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className={labelClass}>Title</span>
          <input
            className={fieldClass}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Friday session update"
            maxLength={120}
            required
          />
        </label>

        <label className="block space-y-2">
          <span className={labelClass}>Content</span>
          <textarea
            className={`${fieldClass} min-h-28 resize-none py-3`}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Share timing, expectations, or training notes."
            required
          />
        </label>

        <label className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-white/10 bg-black/20 px-3">
          <span className="text-sm font-semibold text-white/72">Pin to top</span>
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(event) => setIsPinned(event.target.checked)}
            className="h-4 w-4 accent-[#d8ff5d]"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className={labelClass}>Publish</span>
            <input
              className={fieldClass}
              type="datetime-local"
              value={publishAt}
              onChange={(event) => setPublishAt(event.target.value)}
            />
          </label>
          <label className="block space-y-2">
            <span className={labelClass}>Expire</span>
            <input
              className={fieldClass}
              type="datetime-local"
              value={expireAt}
              onChange={(event) => setExpireAt(event.target.value)}
            />
          </label>
        </div>

        {message ? (
          <div className="flex items-center gap-2 rounded-lg border border-[#d8ff5d]/24 bg-[#d8ff5d]/10 px-3 py-2 text-sm font-medium text-[#efffb8]">
            <CheckCircle2 className="h-4 w-4" />
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-red-400/24 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#d8ff5d]/32 bg-[#d8ff5d]/10 px-4 text-sm font-semibold text-[#f1ffc1] transition hover:bg-[#d8ff5d]/16 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Megaphone className="h-4 w-4" />
          )}
          Publish announcement
        </button>
      </form>
    </section>
  );
}
