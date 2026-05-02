import { CircleUserRound, Search } from "lucide-react";
import Link from "next/link";

import {
  formatDateTime,
  formatScore,
  getStudentDisplayName,
} from "@/components/coach/coachUtils";
import { routes } from "@/lib/routes";
import type { CoachStudentRead } from "@/services/coach";

type CoachStudentTableProps = {
  students: CoachStudentRead[];
};

export function CoachStudentTable({ students }: CoachStudentTableProps) {
  if (students.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/18 p-8 text-center">
        <Search className="mx-auto h-8 w-8 text-[#65f7ff]/70" />
        <div className="mt-4 font-[var(--font-display)] text-lg font-semibold text-white">
          No active students.
        </div>
        <p className="mt-2 text-sm text-white/52">Student memberships will appear here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-black/18">
      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full border-collapse text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.035] text-[0.68rem] uppercase tracking-[0.18em] text-white/42">
            <tr>
              <th className="px-4 py-3 font-semibold">Student</th>
              <th className="px-4 py-3 font-semibold">Contact</th>
              <th className="px-4 py-3 text-right font-semibold">Reports</th>
              <th className="px-4 py-3 text-right font-semibold">Best</th>
              <th className="px-4 py-3 font-semibold">Last training</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {students.map((student) => (
              <tr
                key={student.public_id}
                className="transition-colors hover:bg-[#65f7ff]/[0.055]"
              >
                <td className="px-4 py-4">
                  <Link
                    href={routes.coach.studentProfile(student.public_id)}
                    className="flex items-center gap-3 transition hover:text-[#65f7ff]"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#65f7ff]/18 bg-[#65f7ff]/10 text-[#65f7ff]">
                      <CircleUserRound className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-white">
                        {getStudentDisplayName(student.username, student.nickname)}
                      </span>
                      <span className="block truncate text-xs text-white/42">
                        @{student.username}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-4 text-white/62">
                  <div className="max-w-[14rem] truncate">{student.email || student.phone_number}</div>
                </td>
                <td className="px-4 py-4 text-right font-semibold text-white">
                  {student.report_count}
                </td>
                <td className="px-4 py-4 text-right font-semibold text-[#d8ff5d]">
                  {formatScore(student.best_score)}
                </td>
                <td className="px-4 py-4 text-white/62">
                  {formatDateTime(student.last_report_at)}
                </td>
                <td className="px-4 py-4">
                  <span className="inline-flex rounded-full border border-[#d8ff5d]/24 bg-[#d8ff5d]/10 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#e8ff9a]">
                    {student.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
