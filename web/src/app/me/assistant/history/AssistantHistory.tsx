"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, ArrowLeft, ChevronLeft, ChevronRight, MessageSquare, Plus } from "lucide-react";
import { usePlayerCopy } from "@/components/account/playerCopy";
import { routes } from "@/lib/routes";
import { assistantService, conversationPageSize, type ConversationSummary } from "@/services/assistant";
import { useAuthStore } from "@/store/authStore";

function historyHref(archived: boolean, page = 1) {
  const query = new URLSearchParams();
  if (archived) query.set("view", "archived");
  if (page > 1) query.set("page", String(page));
  return routes.user.assistantHistory + (query.size ? "?" + query.toString() : "");
}

export function AssistantHistory({ archived, page }: { archived: boolean; page: number }) {
  const owner = useAuthStore(state => state.user?.public_id);
  if (!owner) return null;
  return <HistoryList key={`${owner}/${archived}/${page}`} archived={archived} page={page} />;
}

function HistoryList({ archived, page }: { archived: boolean; page: number }) {
  const { t, isChinese, locale } = usePlayerCopy();
  const router = useRouter();
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [reload, setReload] = useState(0);
  const mutation = useRef<AbortController | null>(null);
  const stamp = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  useEffect(() => () => mutation.current?.abort(), []);
  useEffect(() => {
    const request = new AbortController();
    setLoading(true);
    setError("");
    assistantService.list(archived, page, request.signal).then(list => {
      if (request.signal.aborted) return;
      const last = Math.max(1, Math.ceil(list.total / conversationPageSize));
      if (page > last) { router.replace(historyHref(archived, last)); return; }
      setItems(list.items);
      setTotal(list.total);
    }).catch(() => {
      if (!request.signal.aborted) setError("Could not load chat history.");
    }).finally(() => { if (!request.signal.aborted) setLoading(false); });
    return () => request.abort();
  }, [archived, page, reload, router]);

  async function move(item: ConversationSummary) {
    if (mutation.current) return;
    const request = new AbortController();
    mutation.current = request;
    setBusyId(item.public_id);
    setError("");
    setNotice("");
    try {
      await assistantService.archive(item.public_id, !archived, request.signal);
      if (request.signal.aborted) return;
      setItems(current => current.filter(row => row.public_id !== item.public_id));
      setNotice(archived ? "Chat restored." : "Chat archived.");
      setReload(n => n + 1);
    } catch {
      if (!request.signal.aborted) setError("Could not update this chat. Please try again.");
    } finally {
      if (!request.signal.aborted) { mutation.current = null; setBusyId(""); }
    }
  }

  return <section className="mx-auto w-full max-w-3xl space-y-5">
    <header>
      <Link href={routes.user.assistant} className="ui-link"><ArrowLeft size={16} aria-hidden="true" />{t("AI Coach")}</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("Chat history")}</h1>
        <Link href={routes.user.assistant} className="ui-button ui-primary"><Plus size={16} aria-hidden="true" />{t("New chat")}</Link>
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--ui-muted)]">{t("AI Coach can draw on training topics from active chats. Archive a chat to set its topics aside, or restore it to use them again.")}</p>
    </header>
    <nav aria-label={t("Chat status")} className="inline-flex gap-1 rounded-xl bg-[var(--ui-subtle)] p-1">
      {[false, true].map(filter => <Link key={String(filter)} href={historyHref(filter)}
        aria-current={archived === filter ? "page" : undefined}
        className="flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-[var(--ui-muted)] aria-[current=page]:bg-[var(--ui-surface)] aria-[current=page]:text-[var(--ui-text)] aria-[current=page]:shadow-sm">
        {t(filter ? "Archived chats" : "Active chats")}
      </Link>)}
    </nav>
    {notice && <p role="status" className="text-sm text-[var(--ui-muted)]">{t(notice)}</p>}
    {error && <div className="ui-panel flex flex-wrap items-center gap-3 p-4 text-sm">
      <p role="alert">{t(error)}</p><button type="button" className="ui-button" onClick={() => setReload(n => n + 1)}>{t("Reload history")}</button>
    </div>}
    {loading && <p role="status" className="text-sm text-[var(--ui-muted)]">{t("Loading chat history…")}</p>}
    {!loading && !error && !items.length && <p className="ui-panel p-5 text-sm text-[var(--ui-muted)]">
      {t(archived ? "No archived chats." : "No saved chats yet. Send a question to start one.")}
    </p>}
    {items.length > 0 && <ul className="ui-panel divide-y divide-[var(--ui-border)] px-3 sm:px-5">
      {items.map(item => <li key={item.public_id} className="flex min-w-0 flex-wrap items-center gap-x-2 py-2">
        <Link href={routes.user.assistantChat(item.public_id)} className="flex min-h-14 min-w-[min(100%,10rem)] flex-1 items-center gap-3 rounded-lg py-2">
          <MessageSquare aria-hidden="true" size={18} className="shrink-0 text-[var(--ui-accent)]" />
          <span className="min-w-0">
            <span className="block break-words font-semibold">{item.title}</span>
            <span className="mt-1 block text-xs leading-5 text-[var(--ui-muted)]">
              <time dateTime={item.updated_at}>{stamp.format(new Date(item.updated_at))}</time> · {isChinese
                ? `${item.turn_count} 轮问答` : `${item.turn_count} ${item.turn_count === 1 ? "exchange" : "exchanges"}`}
            </span>
          </span>
        </Link>
        <button type="button" className="ui-icon-button ml-auto" disabled={Boolean(busyId) || loading}
          title={t(archived ? "Restore chat" : "Archive chat")}
          aria-label={`${t(archived ? "Restore chat" : "Archive chat")} · ${item.title}`}
          onClick={() => void move(item)}>
          {archived ? <ArchiveRestore size={17} aria-hidden="true" /> : <Archive size={17} aria-hidden="true" />}
        </button>
      </li>)}
    </ul>}
    {total > conversationPageSize && <nav aria-label={t("History pages")} className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span>{isChinese ? `第 ${page} 页，共 ${Math.ceil(total / conversationPageSize)} 页` : `Page ${page} of ${Math.ceil(total / conversationPageSize)}`}</span>
      <div className="flex gap-2">
        {page > 1 && <Link className="ui-button" href={historyHref(archived, page - 1)}><ChevronLeft size={16} />{t("Previous")}</Link>}
        {page * conversationPageSize < total && <Link className="ui-button" href={historyHref(archived, page + 1)}>{t("Next")}<ChevronRight size={16} /></Link>}
      </div>
    </nav>}
  </section>;
}
