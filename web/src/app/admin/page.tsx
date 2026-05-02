"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Boxes, BookOpenCheck, Loader2, UsersRound } from "lucide-react";

import {
  AdminForbiddenSurface,
  AdminLoadingSurface,
  AdminShell,
} from "@/components/admin/AdminShell";
import { formatDateTime } from "@/components/coach/coachUtils";
import { routes } from "@/lib/routes";
import {
  adminService,
  type AdminCampRead,
  type AdminClassRead,
  type AdminTrainingTemplateRead,
} from "@/services/admin";
import { useAuthStore } from "@/store/authStore";

function AdminMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.055] p-5 backdrop-blur-2xl">
      <div className="text-[0.68rem] uppercase tracking-[0.18em] text-white/42">{label}</div>
      <div className="mt-3 font-[var(--font-display)] text-3xl font-bold text-[#d8ff5d]">
        {value}
      </div>
      <div className="mt-2 text-xs leading-5 text-white/48">{helper}</div>
    </div>
  );
}

export default function AdminHomePage() {
  const user = useAuthStore((state) => state.user);
  const hasInitialized = useAuthStore((state) => state.hasInitialized);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const [camps, setCamps] = useState<AdminCampRead[]>([]);
  const [classes, setClasses] = useState<AdminClassRead[]>([]);
  const [templates, setTemplates] = useState<AdminTrainingTemplateRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!hasInitialized || !user || !isAdmin) {
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      adminService.listCamps(),
      adminService.listClasses(),
      adminService.listTrainingTemplates(),
    ])
      .then(([campsResponse, classesResponse, templatesResponse]) => {
        if (!isActive) {
          return;
        }
        setCamps(campsResponse.items);
        setClasses(classesResponse.items);
        setTemplates(templatesResponse.items);
      })
      .catch((fetchError) => {
        if (!isActive) {
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load admin data.");
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [hasInitialized, isAdmin, user]);

  const totals = useMemo(
    () => ({
      activeCamps: camps.filter((camp) => camp.status === "active").length,
      students: classes.reduce((sum, classItem) => sum + classItem.student_count, 0),
      coaches: classes.reduce((sum, classItem) => sum + classItem.coach_count, 0),
      activeTemplates: templates.filter((template) => template.status === "active").length,
    }),
    [camps, classes, templates],
  );

  if (!hasInitialized || isInitializing || !user) {
    return <AdminLoadingSurface />;
  }

  if (!isAdmin) {
    return <AdminForbiddenSurface user={user} />;
  }

  return (
    <AdminShell user={user} title="Admin Overview" breadcrumb={["Overview"]}>
      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="rounded-lg border border-white/10 bg-white/[0.055] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[0.68rem] uppercase tracking-[0.24em] text-[#65f7ff]/75">
              Training camp control
            </div>
            <h1 className="mt-4 font-[var(--font-display)] text-4xl font-bold text-white sm:text-5xl">
              Admin operations
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/58">
              Maintain camps, classes, member relationships, and training templates.
            </p>
          </div>
          {isLoading ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/18 px-3 py-2 text-sm text-white/58">
              <Loader2 className="h-4 w-4 animate-spin text-[#65f7ff]" />
              Loading
            </span>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetric label="Camps" value={String(camps.length)} helper={`${totals.activeCamps} active`} />
        <AdminMetric label="Classes" value={String(classes.length)} helper={`${totals.coaches} coaches`} />
        <AdminMetric label="Students" value={String(totals.students)} helper="Active memberships" />
        <AdminMetric
          label="Templates"
          value={String(templates.length)}
          helper={`${totals.activeTemplates} active`}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        {[
          {
            href: routes.admin.camps,
            icon: Boxes,
            title: "Training camps",
            detail: `${camps.length} camps / latest ${formatDateTime(camps[0]?.created_at)}`,
          },
          {
            href: routes.admin.classes,
            icon: UsersRound,
            title: "Classes and members",
            detail: `${classes.length} classes / ${totals.students} students`,
          },
          {
            href: routes.admin.templates,
            icon: BookOpenCheck,
            title: "Training templates",
            detail: `${templates.length} templates / ${totals.activeTemplates} active`,
          },
        ].map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg border border-white/10 bg-white/[0.055] p-5 transition hover:border-[#65f7ff]/34 hover:bg-[#65f7ff]/10"
            >
              <Icon className="h-5 w-5 text-[#65f7ff]" />
              <div className="mt-4 font-[var(--font-display)] text-xl font-bold text-white">
                {item.title}
              </div>
              <div className="mt-2 text-sm text-white/52">{item.detail}</div>
            </Link>
          );
        })}
      </section>
    </AdminShell>
  );
}
