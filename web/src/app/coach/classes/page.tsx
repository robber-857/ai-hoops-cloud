"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";

import { CoachClassList } from "@/components/coach/CoachClassList";
import { CoachShell } from "@/components/coach/CoachShell";
import { coachService, type CoachClassRead } from "@/services/coach";
import { useAuthStore } from "@/store/authStore";

function CoachRouteLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#030712] text-white">
      <div className="rounded-lg border border-white/10 bg-white/[0.055] px-8 py-7 text-center shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
        <Loader2 className="mx-auto h-9 w-9 animate-spin text-[#65f7ff]" />
        <div className="mt-4 text-[0.72rem] uppercase tracking-[0.28em] text-white/48">
          Loading classes
        </div>
      </div>
    </main>
  );
}

export default function CoachClassesPage() {
  const user = useAuthStore((state) => state.user);
  const hasInitialized = useAuthStore((state) => state.hasInitialized);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const [classes, setClasses] = useState<CoachClassRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canAccessCoach = user?.role === "coach" || user?.role === "admin";

  useEffect(() => {
    if (!hasInitialized || !user || !canAccessCoach) {
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);

    void coachService
      .listClasses()
      .then((response) => {
        if (isActive) {
          setClasses(response.items);
        }
      })
      .catch((fetchError) => {
        if (isActive) {
          setError(fetchError instanceof Error ? fetchError.message : "Unable to load classes.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [canAccessCoach, hasInitialized, user]);

  if (!hasInitialized || isInitializing || !user) {
    return <CoachRouteLoading />;
  }

  if (!canAccessCoach) {
    return (
      <CoachShell user={user} title="Coach access required" breadcrumb={["Access"]}>
        <section className="rounded-lg border border-red-400/20 bg-red-500/10 p-8 text-center backdrop-blur-2xl">
          <ShieldAlert className="mx-auto h-10 w-10 text-red-200" />
          <h2 className="mt-5 font-[var(--font-display)] text-2xl font-bold text-white">
            This workspace is available to coaches only.
          </h2>
        </section>
      </CoachShell>
    );
  }

  return (
    <CoachShell user={user} title="Assigned Classes" breadcrumb={["Classes"]}>
      <section className="rounded-lg border border-white/10 bg-white/[0.055] p-5 backdrop-blur-2xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[0.68rem] uppercase tracking-[0.22em] text-white/42">
              Class registry
            </div>
            <h1 className="mt-2 font-[var(--font-display)] text-2xl font-bold text-white">
              Assigned classes
            </h1>
          </div>
          {isLoading ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/18 px-3 py-2 text-sm text-white/58">
              <Loader2 className="h-4 w-4 animate-spin text-[#65f7ff]" />
              Loading
            </span>
          ) : null}
        </div>
        {error ? (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
        <div className="mt-5">
          <CoachClassList classes={classes} />
        </div>
      </section>
    </CoachShell>
  );
}
