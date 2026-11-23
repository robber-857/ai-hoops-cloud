"use client";
import { usePlayerCopy } from "@/components/account/playerCopy";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Bell, MessageCircle } from "lucide-react";
import { routes } from "@/lib/routes";
import { meService, type NotificationSummaryRead } from "@/services/me";

function displayNotification(item: NotificationSummaryRead, chinese: boolean, t: (key: string) => string) {
  if (!chinese) return item;
  const { title, content } = item;
  switch (item.business_type) {
    case "training_task":
      return { title: title.replace(/^New training task: /, "新的训练任务："), content };
    case "report_feedback":
      return { title: t(title), content };
    case "class_report":
      return { title: t(title), content: content?.replace(/ · saved lesson v(\d+)\. View Class reports in your personal center\.$/, " · 已保存课程版本 $1。请在个人中心查看课堂报告。") };
    case "student_achievement":
      return { title: t(title), content: content?.replace(/^You unlocked (.+)\.$/, "你解锁了「$1」。") };
    case "class_join_request":
      return { title: t(title), content: content
        ?.replace(/^Your request to join (.+) was approved\.$/, "你加入「$1」的申请已通过。")
        .replace(/^Your request to join (.+) was rejected\.$/, "你加入「$1」的申请未通过。") };
    default:
      return item;
  }
}

export function NotificationInboxSection() {
  const { t, locale, isChinese } = usePlayerCopy();
  const [items, setItems] = useState<NotificationSummaryRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const inFlight = useRef(new Set<string>());
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    meService
      .getNotifications(100)
      .then((response) => {
        if (active) setItems(response.items);
      })
      .catch(() => {
        if (active) setError("Could not load notifications. Please retry.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [version]);

  const toggle = async (item: NotificationSummaryRead) => {
    setExpanded((current) =>
      current === item.public_id ? null : item.public_id,
    );
    if (item.is_read || inFlight.current.has(item.public_id)) return;
    inFlight.current.add(item.public_id);
    try {
      const updated = await meService.markNotificationRead(item.public_id);
      setItems((current) =>
        current.map((row) =>
          row.public_id === item.public_id ? updated : row,
        ),
      );
      setError(null);
    } catch {
      setError("Could not mark notification as read. Open it again to retry.");
    } finally {
      inFlight.current.delete(item.public_id);
    }
  };

  return (
    <section className="ui-panel min-w-0 p-4 sm:p-6">
      <h2 className="text-xl font-semibold">{t("Inbox")}</h2>
      {loading && (
        <p role="status" className="mt-4">
          {t("Loading notifications…")}
        </p>
      )}
      {error && (
        <div role="alert" className="mt-4 text-sm text-red-200">
          {t(error)}
          <button
            onClick={() => setVersion((value) => value + 1)}
            className="ml-3 min-h-11 underline"
          >
            {t("Reload notifications")}
          </button>
        </div>
      )}
      {!loading && !error && !items.length && (
        <p className="mt-4 text-white/65">{t("No notifications yet.")}</p>
      )}
      <div className="mt-4 divide-y divide-white/10">
        {items.map((item) => {
          const copy = displayNotification(item, isChinese, t);
          return <article key={item.public_id}>
            <button
              aria-expanded={expanded === item.public_id}
              onClick={() => void toggle(item)}
              className="flex w-full min-w-0 items-start gap-3 rounded-xl px-2 py-4 text-left hover:bg-[var(--ui-subtle)]"
            >
              <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--ui-accent-soft)] text-[var(--ui-accent)]">
                {item.report_public_id ? <MessageCircle size={17} /> : <Bell size={17} />}
              </span>
              <span className="min-w-0">
                <span className="block break-words font-semibold">
                  {copy.title}
                  {!item.is_read && <span className="ml-2 text-xs text-[var(--ui-accent)]">{t("Unread")}</span>}
                </span>
                <time dateTime={item.created_at} className="mt-1 block text-sm text-[var(--ui-muted)]">
                  {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(item.created_at))}
                </time>
              </span>
            </button>
            {expanded === item.public_id && (
              <div className="space-y-2 pb-4 pl-[3.25rem] text-sm leading-6">
                <p className="whitespace-pre-wrap break-words">{copy.content || t("No additional details.")}</p>
                {item.report_public_id && <Link
                  href={`${routes.pose2d.report}?id=${encodeURIComponent(item.report_public_id)}&returnTo=${encodeURIComponent(routes.user.messages)}#coach-feedback`}
                  className="ui-link inline-flex min-h-10 items-center gap-1.5"
                >
                  {t("Open report feedback")} <ArrowUpRight size={15} />
                </Link>}
              </div>
            )}
          </article>;
        })}
      </div>
    </section>
  );
}
