"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, CalendarDays, SignalHigh, UsersRound } from "lucide-react";

import { getClassStatusTone, formatDate } from "@/components/coach/coachUtils";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { CoachClassRead } from "@/services/coach";

type CoachClassSummaryProps = {
  classItem: CoachClassRead;
  index: number;
};

export function CoachClassSummary({ classItem, index }: CoachClassSummaryProps) {
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });
  const capacity =
    classItem.max_students && classItem.max_students > 0
      ? Math.min(100, Math.round((classItem.student_count / classItem.max_students) * 100))
      : null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.42, ease: "easeOut" }}
      style={{
        transformPerspective: 900,
        rotateX: tilt.rotateX,
        rotateY: tilt.rotateY,
      }}
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        setTilt({ rotateX: y * -6, rotateY: x * 7 });
      }}
      onMouseLeave={() => setTilt({ rotateX: 0, rotateY: 0 })}
      className="coach-card-flow group relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.055] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.26)] backdrop-blur-2xl transition-colors duration-300 hover:border-[#65f7ff]/38"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(101,247,255,0.12),transparent_28%),radial-gradient(circle_at_92%_18%,rgba(216,255,93,0.08),transparent_25%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em]",
                getClassStatusTone(classItem.status),
              )}
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
              {classItem.status}
            </span>
          </div>
          <h2 className="mt-4 line-clamp-2 font-[var(--font-display)] text-2xl font-bold tracking-[0.01em] text-white">
            {classItem.name}
          </h2>
          <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-white/55">
            {classItem.description || "Class telemetry is ready for coach review."}
          </p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#65f7ff]/20 bg-[#65f7ff]/10 text-[#65f7ff] shadow-[0_0_24px_rgba(101,247,255,0.12)]">
          <SignalHigh className="h-5 w-5" />
        </span>
      </div>

      <div className="relative mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-white/10 bg-black/18 p-3">
          <div className="flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.18em] text-white/42">
            <UsersRound className="h-3.5 w-3.5 text-[#d8ff5d]" />
            Students
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{classItem.student_count}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/18 p-3">
          <div className="flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.18em] text-white/42">
            <CalendarDays className="h-3.5 w-3.5 text-[#65f7ff]" />
            Window
          </div>
          <div className="mt-2 text-sm font-semibold text-white">
            {formatDate(classItem.start_date)}
          </div>
        </div>
      </div>

      <div className="relative mt-5">
        <div className="mb-2 flex items-center justify-between text-[0.68rem] uppercase tracking-[0.18em] text-white/42">
          <span>{classItem.code}</span>
          <span>{capacity !== null ? `${capacity}%` : classItem.age_group || "Open"}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#65f7ff] via-[#d8ff5d] to-[#a78bfa] shadow-[0_0_18px_rgba(101,247,255,0.45)]"
            style={{ width: `${capacity ?? 62}%` }}
          />
        </div>
      </div>

      <Link
        href={routes.coach.classDetail(classItem.public_id)}
        className="relative mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/28 bg-[#65f7ff]/10 px-4 text-sm font-semibold text-[#dffbff] transition hover:border-[#d8ff5d]/35 hover:bg-[#d8ff5d]/10 hover:text-[#f1ffc1]"
      >
        Open class
        <ArrowUpRight className="h-4 w-4" />
      </Link>
    </motion.article>
  );
}
