"use client";
import { usePlayerCopy } from "@/components/account/playerCopy";

import Link from "next/link";
import { Archive, ArchiveRestore, ArrowUpRight, ClipboardCheck, Dumbbell, History, Plus, Send, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { templateDisplayName } from "@/lib/templateLanguage";
import { routes } from "@/lib/routes";
import { useAuthStore } from "@/store/authStore";
import { assistantService, type ConversationDetail, type SendCoachQuestion } from "@/services/assistant";
import { ApiError } from "@/services/client";
import { mergeCoachMessages, pendingQuestionKey, readPendingQuestion, storePendingQuestion } from "@/lib/coachConversation";

const prompts = [
  "What should I practice next?",
  "Help me understand my latest training score.",
  "Give me a quick ball-handling warm-up.",
];

export function AssistantChat({ conversationId }: { conversationId?: string }) {
  const owner = useAuthStore(state => state.user?.public_id);
  if (!owner) return null;
  return <Chat key={`${owner}/${conversationId ?? "new"}`} id={conversationId} owner={owner} />;
}

function Chat({ id, owner }: { id?: string; owner: string }) {
  const { t, language } = usePlayerCopy();
  const router = useRouter();
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"send" | "archive" | "older" | null>(null);
  const request = useRef<AbortController | null>(null);
  const unconfirmed = useRef<SendCoachQuestion | null>(null);
  const storageKey = pendingQuestionKey(owner, id);
  const latest = useRef<HTMLDivElement>(null);
  const messages = conversation?.messages ?? [];

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (pending) latest.current?.scrollIntoView({ block: "nearest" });
  }, [pending]);
  useEffect(() => {
    const controller = new AbortController();
    const retry = readPendingQuestion(storageKey);
    unconfirmed.current = retry;
    if (retry) setDraft(retry.content);
    if (!id) {
      if (retry) setError("Your last send was not confirmed. Send it again to check for a saved reply.");
      return;
    }
    setLoading(true);
    setLoadError("");
    assistantService.get(id, controller.signal).then(detail => {
      if (controller.signal.aborted) return;
      setConversation(detail);
      requestAnimationFrame(() => {
        if (!controller.signal.aborted) latest.current?.scrollIntoView({ block: "nearest" });
      });
      if (retry) {
        const saved = detail.messages.some(message => message.role === "user" &&
          message.turn === retry.expected_turn_count + 1 && message.content === retry.content);
        if (saved) {
          storePendingQuestion(storageKey, null);
          unconfirmed.current = null;
          setDraft("");
          setError("");
        } else {
          setError("Your last send was not confirmed. Send it again to check for a saved reply.");
        }
      }
    }).catch(reason => {
      if (!controller.signal.aborted) setLoadError(reason instanceof ApiError && reason.status === 404
        ? "This chat is not available for this account." : "Could not load this chat.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, storageKey, reload]);

  async function ask(question: string) {
    const content = question.trim();
    if (!content || request.current || loading || loadError || conversation?.archived || (!id && conversation)) return;
    const controller = new AbortController();
    request.current = controller;
    const attempt = unconfirmed.current?.content === content ? unconfirmed.current : {
      request_id: crypto.randomUUID(), expected_turn_count: conversation?.turn_count ?? 0, content,
    };
    unconfirmed.current = attempt;
    storePendingQuestion(storageKey, attempt);
    setBusy("send");
    setPending(content);
    setDraft("");
    setError("");
    try {
      const detail = await assistantService.send(id, attempt, controller.signal);
      if (controller.signal.aborted) return;
      storePendingQuestion(storageKey, null);
      unconfirmed.current = null;
      setConversation(current => ({
        ...detail,
        messages: mergeCoachMessages(current?.messages ?? [], detail.messages),
        has_more: current ? current.has_more && detail.has_more : detail.has_more,
      }));
      if (!id) router.replace(routes.user.assistantChat(detail.public_id), { scroll: false });
      else requestAnimationFrame(() => latest.current?.scrollIntoView({ block: "nearest" }));
    } catch (reason) {
      if (controller.signal.aborted) return;
      setDraft(content);
      if (reason instanceof ApiError && reason.code === "assistant_reply_in_progress") {
        setError("AI Coach is still preparing a reply. Try sending again in a moment.");
      } else if (reason instanceof ApiError && reason.status === 409) {
        storePendingQuestion(storageKey, null);
        unconfirmed.current = null;
        setError("This chat changed. Review the latest messages before sending again.");
        if (id) setReload(n => n + 1);
      } else {
        setError("AI Coach couldn't respond. Try again.");
      }
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setPending("");
        setBusy(null);
      }
    }
  }

  async function archive() {
    if (!id || !conversation || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy("archive");
    setError("");
    try {
      const summary = await assistantService.archive(id, !conversation.archived, controller.signal);
      if (!controller.signal.aborted) setConversation(current => current ? { ...current, ...summary } : current);
    } catch {
      if (!controller.signal.aborted) setError("Could not update this chat. Please try again.");
    } finally {
      if (!controller.signal.aborted) { request.current = null; setBusy(null); }
    }
  }

  async function loadOlder() {
    if (!id || !conversation?.has_more || !messages.length || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy("older");
    setError("");
    try {
      const earlier = await assistantService.get(id, controller.signal, messages[0].turn);
      if (!controller.signal.aborted) setConversation(current => current ? {
        ...current, messages: mergeCoachMessages(earlier.messages, current.messages), has_more: earlier.has_more,
      } : current);
    } catch {
      if (!controller.signal.aborted) setError("Could not load earlier messages.");
    } finally {
      if (!controller.signal.aborted) { request.current = null; setBusy(null); }
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(draft);
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 sm:block">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--ui-accent-soft)] text-[var(--ui-accent)] sm:mb-3">
            <Sparkles size={21} aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("AI Coach")}</h1>
          <p className="col-span-2 break-words text-sm leading-6 text-[var(--ui-muted)] sm:mt-2">
            {conversation?.title || t("Ask a basketball question or get an idea for your next practice.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={routes.user.assistantHistory + (conversation?.archived ? "?view=archived" : "")} className="ui-button">
            <History size={16} aria-hidden="true" />{t("Chat history")}
          </Link>
          {id && <Link href={routes.user.assistant} className="ui-button"><Plus size={16} aria-hidden="true" />{t("New chat")}</Link>}
          {id && conversation && <button type="button" className="ui-button" disabled={Boolean(busy) || loading} onClick={() => void archive()}>
            {conversation.archived ? <ArchiveRestore size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />}
            {conversation.archived ? t("Restore chat") : t("Archive chat")}
          </button>}
        </div>
      </header>

      {loading && <p role="status" className="ui-panel p-4 text-sm">{t("Loading chat…")}</p>}
      {loadError && <div className="ui-panel flex flex-wrap items-center gap-3 p-4 text-sm">
        <p role="alert">{t(loadError)}</p><button type="button" className="ui-button" onClick={() => setReload(n => n + 1)}>{t("Retry")}</button>
      </div>}
      {!id && !messages.length && !pending && (
        <div className="grid max-sm:rounded-2xl max-sm:border max-sm:border-[var(--ui-border)] max-sm:bg-[var(--ui-surface)] sm:grid-cols-3 sm:gap-2">
          {prompts.map((prompt) => (
            <button key={prompt} type="button" onClick={() => void ask(t(prompt))}
              className="flex min-h-12 min-w-0 items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium hover:bg-[var(--ui-subtle)] focus-visible:z-10 max-sm:border-b max-sm:border-[var(--ui-border)] max-sm:first:rounded-t-2xl max-sm:last:rounded-b-2xl max-sm:last:border-b-0 sm:items-start sm:rounded-2xl sm:border sm:border-[var(--ui-border)] sm:bg-[var(--ui-surface)] sm:p-4">
              {t(prompt)} <ArrowUpRight size={15} className="shrink-0 text-[var(--ui-accent)]" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      {conversation?.archived && <p className="rounded-xl bg-[var(--ui-subtle)] p-3 text-sm">{t("This chat is archived. Restore it to send another question.")}</p>}
      {conversation?.has_more && <button type="button" className="ui-button" disabled={Boolean(busy)} onClick={() => void loadOlder()}>
        {t(busy === "older" ? "Loading earlier messages…" : "Show earlier messages")}
      </button>}
      <div aria-live="polite" className="space-y-4">
        {messages.map(message => (
          <article key={`${message.turn}-${message.role}`} className={message.role === "user" ? "ml-auto w-fit max-w-[90%] rounded-2xl bg-[var(--ui-accent-soft)] px-4 py-3" : "ui-panel p-4 sm:p-5"}>
            {message.role === "assistant" && <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Sparkles size={16} className="text-[var(--ui-accent)]" /> {t("AI Coach")}</h2>}
            <p className="whitespace-pre-wrap break-words text-sm leading-6">
              {message.role === "user" && <span className="sr-only">{t("You.")} </span>}{message.content}
            </p>
            {!!message.recommendations?.length && <ul className="mt-4 grid gap-2">
              {message.recommendations.map((item, itemIndex) => {
                const title = item.kind === "exercise"
                  ? templateDisplayName(new URLSearchParams(item.href.split("?")[1]?.split("#")[0]).get("templateCode"), item.title, language)
                  : item.title;
                return <li key={`${item.href}-${itemIndex}`}>
                  <Link href={item.href} className="ui-button flex w-full justify-start text-left">
                    {item.kind === "task" ? <ClipboardCheck size={17} className="shrink-0" /> : <Dumbbell size={17} className="shrink-0" />}
                    <span className="min-w-0 flex-1 break-words">{title}</span>
                    <ArrowUpRight size={15} className="shrink-0" aria-hidden="true" />
                  </Link>
                </li>;
              })}
            </ul>}
          </article>
        ))}
        {pending && <>
          <p className="ml-auto w-fit max-w-[90%] whitespace-pre-wrap break-words rounded-2xl bg-[var(--ui-accent-soft)] px-4 py-3 text-sm"><span className="sr-only">{t("You.")} </span>{pending}</p>
          <p role="status" className="text-sm text-[var(--ui-muted)]">{t("AI Coach is thinking…")}</p>
        </>}
        <div ref={latest} />
      </div>

      {error && <div className="ui-panel p-4 text-sm">
        <p role="alert">{t(error)}</p>
        {error === "AI Coach couldn't respond. Try again." &&
          <Link href={routes.user.tasks} className="ui-link mt-2 inline-flex">{t("Open training tasks")}</Link>}
      </div>}
      {!loading && !loadError && !conversation?.archived && <form onSubmit={submit} className="ui-panel space-y-3 p-3 sm:p-4">
        <label htmlFor="assistant-question" className="sr-only">{t("Your training question")}</label>
        <textarea id="assistant-question" rows={3} value={draft} maxLength={2400} disabled={Boolean(busy)}
          placeholder={t("Ask about a drill or a training score…")}
          className="block w-full resize-y rounded-xl bg-[var(--ui-subtle)] p-3 text-base sm:text-sm"
          onChange={(event) => setDraft(event.target.value)} />
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:items-center">
          <p className="text-xs leading-5 text-[var(--ui-muted)]">{t("Chats are saved to your account. Keep personal details out of your questions.")}</p>
          <button type="submit" disabled={!draft.trim() || Boolean(busy) || (!id && Boolean(conversation))} className="ui-button ui-primary disabled:opacity-50">
            <Send size={15} aria-hidden="true" /> {t("Send")}
          </button>
        </div>
      </form>}
    </section>
  );
}
