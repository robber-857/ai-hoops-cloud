"use client";
import { usePlayerCopy } from "@/components/account/playerCopy";

import Link from "next/link";
import { ArrowUpRight, ClipboardCheck, Dumbbell, Send, Sparkles } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { templateDisplayName } from "@/lib/templateLanguage";
import { routes } from "@/lib/routes";
import { apiRequest } from "@/services/client";

type Recommendation = {
  title: string;
  kind: "task" | "exercise";
  href: string;
};
type Message = {
  role: "user" | "assistant";
  content: string;
  recommendations?: Recommendation[];
};
type Answer = {
  answer: string;
  recommendations: Recommendation[];
};

const prompts = [
  "What should I practice next?",
  "Help me understand my latest training score.",
  "Give me a quick ball-handling warm-up.",
];

export default function AssistantPage() {
  const { t, language } = usePlayerCopy();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const latest = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (messages.length || pending) latest.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length, pending]);

  async function ask(question: string) {
    const content = question.trim();
    if (!content || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const next: Message[] = [...messages, { role: "user", content }];
    setPending(content);
    setDraft("");
    setError("");
    try {
      const response = await apiRequest<Answer>("/me/assistant", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({
          messages: next.slice(-9).map(({ role, content }) => ({ role, content })),
        }),
      });
      setMessages([...next, {
        role: "assistant", content: response.answer, recommendations: response.recommendations,
      }]);
    } catch (problem) {
      if (!controller.signal.aborted) {
        setDraft(content);
        setError(problem instanceof Error ? problem.message : t("AI Coach couldn't respond. Try again."));
      }
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setPending("");
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(draft);
  }

  return (
    <section className="mx-auto w-full max-w-3xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-[var(--ui-accent-soft)] text-[var(--ui-accent)]">
            <Sparkles size={21} aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("AI Coach")}</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--ui-muted)]">
            {t("Ask a basketball question or get an idea for your next practice.")}
          </p>
        </div>
        {messages.length > 0 && <button
          type="button" className="ui-button disabled:opacity-50" disabled={Boolean(pending)}
          onClick={() => { setMessages([]); setDraft(""); setError(""); input.current?.focus(); }}
        >{t("New chat")}</button>}
      </header>

      {!messages.length && !pending && (
        <div className="grid gap-2 sm:grid-cols-3">
          {prompts.map((prompt) => (
            <button key={prompt} type="button" onClick={() => void ask(t(prompt))}
              className="ui-panel flex min-w-0 items-start justify-between gap-2 p-4 text-left text-sm font-medium hover:bg-[var(--ui-subtle)]">
              {t(prompt)} <ArrowUpRight size={15} className="shrink-0 text-[var(--ui-accent)]" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      <div aria-live="polite" className="space-y-4">
        {messages.map((message, index) => (
          <article key={index} className={message.role === "user" ? "ml-auto w-fit max-w-[90%] rounded-2xl bg-[var(--ui-accent-soft)] px-4 py-3" : "ui-panel p-4 sm:p-5"}>
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
        <Link href={routes.user.tasks} className="ui-link mt-2 inline-flex">{t("Open training tasks")}</Link>
      </div>}
      <form onSubmit={submit} className="ui-panel space-y-3 p-3 sm:p-4">
        <label htmlFor="assistant-question" className="sr-only">{t("Your training question")}</label>
        <textarea ref={input} id="assistant-question" rows={3} value={draft} maxLength={2400} disabled={Boolean(pending)}
          placeholder={t("Ask about a drill or a training score…")}
          className="block w-full resize-y rounded-xl bg-[var(--ui-subtle)] p-3 text-sm"
          onChange={(event) => setDraft(event.target.value)} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs leading-5 text-[var(--ui-muted)]">{t("Uses your assigned tasks and recent scores. Keep personal details out of your question.")}</p>
          <button type="submit" disabled={!draft.trim() || Boolean(pending)} className="ui-button ui-primary disabled:opacity-50">
            <Send size={15} aria-hidden="true" /> {t("Send")}
          </button>
        </div>
      </form>
    </section>
  );
}
