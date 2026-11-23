"use client";
import { usePlayerCopy } from "@/components/account/playerCopy";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, UsersRound } from "lucide-react";

import { classInviteUrl, getClassInvitePath, withClassInvite } from "@/lib/classInvite";
import { routes } from "@/lib/routes";
import { classCollaboration, type ClassJoinResult } from "@/services/classCollaboration";
import { useAuthStore } from "@/store/authStore";

const outcomeCopy = {
  pending: "Your request is with the coach. Check Notifications for the decision.",
  approved: "You have access to this class.",
  declined: "The coach declined this request. Contact your coach if you need help.",
};

export function ClassInviteLanding({ token }: { token: string }) {
  const { t } = usePlayerCopy();
  const user = useAuthStore((state) => state.user);
  const hasInitialized = useAuthStore((state) => state.hasInitialized);
  const [invitation, setInvitation] = useState<{ class_name: string; course_name: string }>();
  const [result, setResult] = useState<ClassJoinResult>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const path = classInviteUrl(token);
  const validInvite = Boolean(getClassInvitePath(path));

  useEffect(() => {
    if (!validInvite) return;
    let active = true;
    classCollaboration.preview(token)
      .then((preview) => { if (active) setInvitation(preview); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "This invitation could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, validInvite]);

  async function apply() {
    setError("");
    setSubmitting(true);
    try {
      setResult(await classCollaboration.apply(token));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send your request.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!validInvite) {
    return (
      <main className="grid min-h-[100svh] place-items-center bg-[var(--ui-bg)] p-6 text-[var(--ui-text)]">
        <p>{t("This invitation is invalid. Ask your coach for another link.")}</p>
      </main>
    );
  }

  return (
    <main className="grid min-h-[100svh] place-items-center bg-[var(--ui-bg)] p-6 text-[var(--ui-text)]">
      <section className="w-full max-w-md space-y-5 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-6 sm:p-8">
        <Link href={routes.home} className="text-sm font-semibold">AI Hoops</Link>
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--ui-accent-soft)]"><UsersRound className="size-5" /></span>
          <h1 className="text-2xl font-semibold tracking-tight">{invitation?.class_name ?? t("Class invitation")}</h1>
        </div>
        {invitation && <p className="text-sm text-[var(--ui-muted)]">{invitation.course_name}</p>}
        {(loading || !hasInitialized) && !error && <p role="status" className="text-sm text-[var(--ui-muted)]">{t("Checking invitation…")}</p>}
        {error && <p role="alert" className="text-sm text-[var(--ui-danger)]">{t(error)}</p>}
        {result ? (
          <div className="space-y-3">
            <p role="status">{t(outcomeCopy[result.status])}</p>
            <Link className="inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline"
              href={result.status === "approved" ? routes.user.classVideos : routes.user.messages}>
              {result.status === "approved" ? t("Go to class videos") : t("Go to Notifications")} <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : invitation && hasInitialized ? (
          <>
            <p className="text-sm leading-relaxed text-[var(--ui-muted)]">{t("Your coach will review your request before you join the class.")}</p>
            {user?.role === "student" ? (
              <button type="button" onClick={() => void apply()} disabled={submitting}
                className="min-h-11 w-full rounded-xl bg-[var(--ui-action)] px-4 text-sm font-semibold text-[var(--ui-action-text)] disabled:opacity-60">
                {submitting ? t("Sending request…") : t("Request to join")}
              </button>
            ) : (
              <div className="grid gap-2">
                {!user && <Link className="rounded-xl bg-[var(--ui-action)] p-3 text-center text-sm font-semibold text-[var(--ui-action-text)]" href={withClassInvite(routes.auth.register, path)}>{t("Create student account")}</Link>}
                <Link className="rounded-xl border border-[var(--ui-border)] p-3 text-center text-sm font-semibold" href={withClassInvite(routes.auth.login, path)}>
                  {user ? t("Sign in with a student account") : t("Sign in to apply")}
                </Link>
              </div>
            )}
          </>
        ) : null}
      </section>
    </main>
  );
}
