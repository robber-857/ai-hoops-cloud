"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { LockKeyhole, MessageCircle, Send } from "lucide-react";
import { reportService, type ReportFeedback } from "@/services/reports";

export function ReportFeedbackPanel({ reportId }: { reportId: string }) {
  const [items, setItems] = useState<ReportFeedback[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [sendError, setSendError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState("");
  const request = useRef<{ body: string; id: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    reportService.getFeedback(reportId, controller.signal).then((thread) => {
      setItems(thread.items);
      setCanWrite(thread.can_write);
      setLoadError("");
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setLoadError(error instanceof Error ? error.message : "Could not load feedback.");
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [reportId, attempt]);

  useEffect(() => {
    if (window.location.hash === "#coach-feedback") {
      document.getElementById("coach-feedback")?.scrollIntoView();
    }
  }, []);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending || !canWrite) return;
    if (request.current?.body !== body) request.current = { body, id: crypto.randomUUID() };
    setSending(true);
    setSendError("");
    try {
      const item = await reportService.addFeedback(reportId, body, request.current.id);
      setItems((current) => current.some((row) => row.public_id === item.public_id) ? current : [...current, item]);
      setDraft("");
      request.current = null;
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Could not send feedback.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section id="coach-feedback" aria-labelledby="feedback-heading" className="ui-panel mt-6 scroll-mt-20 rounded-2xl p-4 text-[var(--ui-text)] sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--ui-accent-soft)] text-[var(--ui-accent)]">
          <MessageCircle size={19} />
        </span>
        <div>
          <h2 id="feedback-heading" className="text-lg font-semibold">Coach feedback</h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--ui-muted)]"><LockKeyhole size={13} /> Private to the player and authorized staff</p>
        </div>
      </div>
      {loading && <p role="status" className="mt-4 text-sm text-[var(--ui-muted)]">Loading feedback…</p>}
      {loadError && <div className="mt-4 text-sm" role="alert">
        <p>{loadError}</p>
        <button type="button" className="ui-link mt-2" onClick={() => { setLoading(true); setLoadError(""); setAttempt((value) => value + 1); }}>Retry</button>
      </div>}
      {!loading && !loadError && items.length === 0 && <p className="mt-4 text-sm text-[var(--ui-muted)]">No coach feedback yet.</p>}
      {items.length > 0 && <ol aria-live="polite" className="mt-4 max-h-96 space-y-2 overflow-auto">
        {items.map((item) => (
          <li key={item.public_id} className="rounded-xl bg-[var(--ui-subtle)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
              <span className="font-semibold">{item.author_name}</span>
              <time className="text-xs text-[var(--ui-muted)]" dateTime={item.created_at}>{new Date(item.created_at).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}</time>
            </div>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{item.body}</p>
          </li>
        ))}
      </ol>}
      {canWrite && (
        <form className="mt-5 grid gap-2" onSubmit={send}>
          <label htmlFor="report-feedback-draft" className="text-sm font-semibold">Write feedback for the player</label>
          <textarea id="report-feedback-draft" rows={3} maxLength={2000} value={draft} disabled={sending}
            placeholder="What went well? What should they try next?"
            onChange={(event) => setDraft(event.target.value)}
            className="w-full rounded-xl border border-[var(--ui-border)] bg-[var(--ui-bg)] p-3 text-sm" />
          {sendError && <p role="alert" className="text-sm text-[var(--ui-danger)]">{sendError}</p>}
          <button type="submit" disabled={!draft.trim() || sending} className="ui-button ui-primary justify-self-end disabled:opacity-50">
            <Send size={15} /> {sending ? "Sending…" : "Send feedback"}
          </button>
        </form>
      )}
    </section>
  );
}
