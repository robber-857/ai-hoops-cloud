"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Languages } from "lucide-react";
import { AccountCenterShell } from "@/components/account/AccountCenterShell";
import { useLanguagePreference } from "@/components/account/LanguagePreferenceProvider";
import { AdminShell } from "@/components/admin/AdminShell";
import { CoachShell } from "@/components/coach/CoachShell";
import { isAdminRole } from "@/lib/authRedirect";
import { normalizeLanguage, type AppLanguage } from "@/lib/language";
import { routes } from "@/lib/routes";
import { useAuthStore } from "@/store/authStore";

function LanguageForm({ signedIn }: { signedIn: boolean }) {
  const { language, saveLanguage, loading, error, reload } = useLanguagePreference();
  const zh = language === "zh-CN";
  const [choice, setChoice] = useState<AppLanguage | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const saving = useRef(false);
  return (
    <section className="w-full max-w-xl rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5 text-[var(--ui-text)] sm:p-7">
      <div className="mb-5 flex items-center gap-3">
        <Languages size={22} aria-hidden="true" />
        <h2 className="text-xl font-semibold">{zh ? "显示语言" : "Display language"}</h2>
      </div>
      <form onSubmit={async (event) => {
        event.preventDefault();
        if (!choice || saving.current || loading || error) return;
        saving.current = true;
        setStatus("saving");
        try {
          await saveLanguage(choice);
          setChoice(null);
          setStatus("saved");
        } catch {
          setStatus("failed");
        } finally {
          saving.current = false;
        }
      }}>
        <label className="block text-sm font-semibold" htmlFor="display-language">{zh ? "语言" : "Language"}</label>
        <select id="display-language" aria-describedby="language-hint"
          className="mt-2 min-h-11 w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)] px-3 text-base"
          value={choice ?? language} disabled={loading || status === "saving" || Boolean(error)}
          onChange={event => { setChoice(normalizeLanguage(event.target.value)); setStatus("idle"); }}>
          <option lang="en" value="en">English</option>
          <option lang="zh-CN" value="zh-CN">简体中文</option>
        </select>
        <p id="language-hint" className="mt-2 text-sm text-[var(--ui-muted)]">
          {signedIn
            ? (zh ? "保存在你的账号中，适用于所有工作区。" : "Saved to your account and used across all workspaces.")
            : (zh ? "此浏览器将记住你的语言选择。" : "This browser will remember your language.")}
        </p>
        <button type="submit" disabled={!choice || choice === language || loading || Boolean(error) || status === "saving"}
          className="mt-5 min-h-11 rounded-lg bg-[var(--ui-action)] px-5 font-semibold text-[var(--ui-action-text)] disabled:opacity-50">
          {status === "saving" ? (zh ? "正在保存…" : "Saving…") : (zh ? "保存设置" : "Save settings")}
        </button>
        <span className="ml-3 text-sm" role="status">{status === "saved" && (zh ? "设置已保存。" : "Settings saved.")}</span>
        {(error || status === "failed") && <div className="mt-3 text-sm" role="alert">
          <p>{zh ? "无法读取或保存语言设置，请重试。" : "Could not load or save your language. Please try again."}</p>
          <button type="button" className="min-h-11 underline" onClick={() => { reload(); setStatus("idle"); }}>
            {zh ? "重新加载设置" : "Reload settings"}
          </button>
        </div>}
      </form>
    </section>
  );
}

export default function SettingsPage() {
  const user = useAuthStore(state => state.user);
  const initialized = useAuthStore(state => state.hasInitialized);
  const { language } = useLanguagePreference();
  const title = language === "zh-CN" ? "设置" : "Settings";
  const form = <LanguageForm key={user?.public_id ?? "guest"} signedIn={Boolean(user)} />;
  if (user && isAdminRole(user.role)) return <AdminShell user={user} title={title} breadcrumb={[title]}>{form}</AdminShell>;
  if (user?.role === "coach") return <CoachShell user={user} title={title} breadcrumb={[title]}>{form}</CoachShell>;
  const body = <><h1 className="text-3xl font-semibold">{title}</h1>{form}</>;
  if (user) return <AccountCenterShell username={user.nickname || user.username}>{body}</AccountCenterShell>;
  return (
    <main className="theme-workspace min-h-dvh bg-[var(--ui-bg)] px-5 py-8 text-[var(--ui-text)]">
      <div className="mx-auto grid max-w-xl gap-5">
        <Link className="flex min-h-11 items-center gap-2 text-sm" href={routes.home}>
          <ArrowLeft size={16} />{language === "zh-CN" ? "返回首页" : "Back to home"}
        </Link>
        {initialized ? body : <p role="status">{language === "zh-CN" ? "正在加载…" : "Loading…"}</p>}
      </div>
    </main>
  );
}
