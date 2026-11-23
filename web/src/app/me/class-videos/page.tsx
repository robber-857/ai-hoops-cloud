"use client";
import { usePlayerCopy } from "@/components/account/playerCopy";
import { ClassVideoLibrary } from "@/components/account/ClassVideoLibrary";

export default function ClassVideosPage() {
  const { t } = usePlayerCopy();
  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t("Class videos")}</h1>
        <p className="text-sm text-[var(--ui-muted)]">{t("Watch the videos your coaches have shared with your classes.")}</p>
      </header>
      <ClassVideoLibrary />
    </section>
  );
}
