import { ClassVideoLibrary } from "@/components/account/ClassVideoLibrary";

export default function ClassVideosPage() {
  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Class videos</h1>
        <p className="text-sm text-[var(--ui-muted)]">Watch the videos your coaches have shared with your classes.</p>
      </header>
      <ClassVideoLibrary />
    </section>
  );
}
