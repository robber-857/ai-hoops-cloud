"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CircleUserRound,
  Loader2,
  ShieldAlert,
  Trophy,
} from "lucide-react";

import { CoachReportTable } from "@/components/coach/CoachReportTable";
import { CoachShell } from "@/components/coach/CoachShell";
import {
  formatDateTime,
  formatScore,
  getStudentDisplayName,
} from "@/components/coach/coachUtils";
import {
  coachService,
  type CoachClassReportRead,
  type CoachStudentProfileRead,
} from "@/services/coach";
import { useAuthStore } from "@/store/authStore";

function StudentProfileLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#030712] text-white">
      <div className="rounded-lg border border-white/10 bg-white/[0.055] px-8 py-7 text-center shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
        <Loader2 className="mx-auto h-9 w-9 animate-spin text-[#65f7ff]" />
        <div className="mt-4 text-[0.72rem] uppercase tracking-[0.28em] text-white/48">
          Loading student file
        </div>
      </div>
    </main>
  );
}

function ProfileMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/18 p-4">
      <div className="text-[0.68rem] uppercase tracking-[0.18em] text-white/42">{label}</div>
      <div className="mt-3 font-[var(--font-display)] text-3xl font-bold text-[#d8ff5d]">
        {value}
      </div>
      <div className="mt-2 text-xs leading-5 text-white/48">{helper}</div>
    </div>
  );
}

export default function CoachStudentProfilePage() {
  const params = useParams<{ studentPublicId: string }>();
  const studentPublicId = params.studentPublicId;
  const user = useAuthStore((state) => state.user);
  const hasInitialized = useAuthStore((state) => state.hasInitialized);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const [profile, setProfile] = useState<CoachStudentProfileRead | null>(null);
  const [reports, setReports] = useState<CoachClassReportRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canAccessCoach = user?.role === "coach" || user?.role === "admin";

  useEffect(() => {
    if (!hasInitialized || !user || !canAccessCoach || !studentPublicId) {
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      coachService.getStudentProfile(studentPublicId),
      coachService.listStudentReports(studentPublicId, 50),
    ])
      .then(([profileResponse, reportsResponse]) => {
        if (!isActive) {
          return;
        }
        setProfile(profileResponse);
        setReports(reportsResponse.items);
      })
      .catch((fetchError) => {
        if (!isActive) {
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load student.");
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [canAccessCoach, hasInitialized, studentPublicId, user]);

  const displayName = useMemo(() => {
    if (!profile) {
      return "Student Profile";
    }
    return getStudentDisplayName(profile.username, profile.nickname);
  }, [profile]);

  if (!hasInitialized || isInitializing || !user) {
    return <StudentProfileLoading />;
  }

  if (!canAccessCoach) {
    return (
      <CoachShell user={user} title="Coach access required" breadcrumb={["Access"]}>
        <section className="rounded-lg border border-red-400/20 bg-red-500/10 p-8 text-center backdrop-blur-2xl">
          <ShieldAlert className="mx-auto h-10 w-10 text-red-200" />
          <h2 className="mt-5 font-[var(--font-display)] text-2xl font-bold text-white">
            This workspace is available to coaches only.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/58">
            Current role: {user.role}. Ask an administrator to assign coach or admin access.
          </p>
        </section>
      </CoachShell>
    );
  }

  return (
    <CoachShell user={user} title={displayName} breadcrumb={["Students", displayName]}>
      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="rounded-lg border border-white/10 bg-white/[0.055] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-2xl">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-[#65f7ff]/20 bg-[#65f7ff]/10 text-[#65f7ff]">
              <CircleUserRound className="h-7 w-7" />
            </span>
            <div className="min-w-0">
              <div className="text-[0.68rem] uppercase tracking-[0.24em] text-[#65f7ff]/75">
                Student training file
              </div>
              <h1 className="mt-3 font-[var(--font-display)] text-4xl font-bold tracking-[0.01em] text-white sm:text-5xl">
                {displayName}
              </h1>
              <p className="mt-3 text-sm text-white/52">
                @{profile?.username ?? "loading"} / {profile?.email || profile?.phone_number || "--"}
              </p>
            </div>
          </div>

          {isLoading ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/18 px-3 py-2 text-sm text-white/58">
              <Loader2 className="h-4 w-4 animate-spin text-[#65f7ff]" />
              Loading
            </span>
          ) : null}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ProfileMetric
            label="Reports"
            value={String(profile?.report_count ?? 0)}
            helper="Accessible class reports"
          />
          <ProfileMetric
            label="Best score"
            value={formatScore(profile?.best_score ?? null)}
            helper={`Last report ${formatDateTime(profile?.last_report_at ?? null)}`}
          />
          <ProfileMetric
            label="Tasks"
            value={String(profile?.task_summary.assigned_count ?? 0)}
            helper={`${profile?.task_summary.completed_count ?? 0} completed`}
          />
          <ProfileMetric
            label="Pending"
            value={String(profile?.task_summary.pending_count ?? 0)}
            helper={`Latest ${formatDateTime(profile?.task_summary.latest_submission_at ?? null)}`}
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-white/10 bg-white/[0.055] p-5 backdrop-blur-2xl"
        >
          <div className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-[#d8ff5d]" />
            <h2 className="font-[var(--font-display)] text-xl font-bold text-white">
              Class memberships
            </h2>
          </div>
          <div className="mt-5 space-y-3">
            {(profile?.memberships ?? []).map((membership) => (
              <div
                key={membership.member_public_id}
                className="rounded-lg border border-white/10 bg-black/18 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{membership.class_name}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/38">
                      {membership.class_code}
                    </div>
                  </div>
                  <span className="rounded-full border border-[#d8ff5d]/24 bg-[#d8ff5d]/10 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#e8ff9a]">
                    {membership.status}
                  </span>
                </div>
                <div className="mt-3 text-xs text-white/44">
                  Joined {formatDateTime(membership.joined_at)}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="min-w-0 rounded-lg border border-white/10 bg-white/[0.055] p-5 backdrop-blur-2xl"
        >
          <div className="mb-5">
            <div className="text-[0.68rem] uppercase tracking-[0.22em] text-white/42">
              Report history
            </div>
            <h2 className="mt-2 font-[var(--font-display)] text-2xl font-bold text-white">
              Recent reports
            </h2>
          </div>
          <CoachReportTable reports={reports} />
        </motion.section>
      </div>
    </CoachShell>
  );
}
