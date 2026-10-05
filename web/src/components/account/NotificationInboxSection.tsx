"use client";

import { useEffect, useRef, useState } from "react";
import { meService, type NotificationSummaryRead } from "@/services/me";

export function NotificationInboxSection() {
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
    <section className="min-w-0 border-t border-white/15 py-6">
      <h2 className="text-xl font-semibold">Notifications</h2>
      <p className="mt-2 text-sm text-white/65">
        Latest 100 account notifications.
      </p>
      {loading && (
        <p role="status" className="mt-4">
          Loading notifications…
        </p>
      )}
      {error && (
        <div role="alert" className="mt-4 text-sm text-red-200">
          {error}
          <button
            onClick={() => setVersion((value) => value + 1)}
            className="ml-3 min-h-11 underline"
          >
            Reload notifications
          </button>
        </div>
      )}
      {!loading && !error && !items.length && (
        <p className="mt-4 text-white/65">No notifications yet.</p>
      )}
      <div className="mt-4 divide-y divide-white/10">
        {items.map((item) => (
          <button
            key={item.public_id}
            aria-expanded={expanded === item.public_id}
            onClick={() => void toggle(item)}
            className="block w-full min-w-0 py-4 text-left hover:bg-white/5"
          >
            <span className="block break-words font-medium">
              {item.title}
              {!item.is_read && (
                <span className="ml-2 text-xs text-[#d8ff5d]">Unread</span>
              )}
            </span>
            <span className="mt-1 block text-sm text-white/65">
              {new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(
                new Date(item.created_at),
              )}
            </span>
            {expanded === item.public_id && (
              <span className="mt-3 block whitespace-pre-wrap break-words text-sm leading-6 text-white/80">
                {item.content || "No additional details."}
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
