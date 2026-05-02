"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, Plus, UsersRound } from "lucide-react";

import {
  AdminForbiddenSurface,
  AdminLoadingSurface,
  AdminShell,
} from "@/components/admin/AdminShell";
import { formatDate } from "@/components/coach/coachUtils";
import { routes } from "@/lib/routes";
import {
  adminService,
  type AdminCampRead,
  type AdminClassRead,
} from "@/services/admin";
import { useAuthStore } from "@/store/authStore";

const fieldClass =
  "min-h-11 w-full rounded-lg border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#65f7ff]/46 focus:bg-black/34 focus:ring-2 focus:ring-[#65f7ff]/12";
const labelClass = "text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/46";

function toApiDate(value: string) {
  return value || null;
}

export default function AdminClassesPage() {
  const user = useAuthStore((state) => state.user);
  const hasInitialized = useAuthStore((state) => state.hasInitialized);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const [camps, setCamps] = useState<AdminCampRead[]>([]);
  const [classes, setClasses] = useState<AdminClassRead[]>([]);
  const [campPublicId, setCampPublicId] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [maxStudents, setMaxStudents] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [updatingClassId, setUpdatingClassId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";

  const loadData = async () => {
    const [campsResponse, classesResponse] = await Promise.all([
      adminService.listCamps(),
      adminService.listClasses(),
    ]);
    setCamps(campsResponse.items);
    setClasses(classesResponse.items);
    if (!campPublicId && campsResponse.items[0]) {
      setCampPublicId(campsResponse.items[0].public_id);
    }
  };

  useEffect(() => {
    if (!hasInitialized || !user || !isAdmin) {
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);

    void Promise.all([adminService.listCamps(), adminService.listClasses()])
      .then(([campsResponse, classesResponse]) => {
        if (!isActive) {
          return;
        }
        setCamps(campsResponse.items);
        setClasses(classesResponse.items);
        setCampPublicId((current) => current || campsResponse.items[0]?.public_id || "");
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
  }, [hasInitialized, isAdmin, user]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    const parsedMaxStudents = Number(maxStudents);

    try {
      const classItem = await adminService.createClass({
        camp_public_id: campPublicId,
        name: name.trim(),
        code: code.trim(),
        description: description.trim() || null,
        status: "active",
        age_group: ageGroup.trim() || null,
        max_students:
          Number.isFinite(parsedMaxStudents) && parsedMaxStudents > 0 ? parsedMaxStudents : null,
        start_date: toApiDate(startDate),
        end_date: toApiDate(endDate),
      });
      setMessage(`Created class ${classItem.name}.`);
      setName("");
      setCode("");
      setDescription("");
      setAgeGroup("");
      setMaxStudents("");
      setStartDate("");
      setEndDate("");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create class.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleClassStatus = async (classItem: AdminClassRead) => {
    setUpdatingClassId(classItem.public_id);
    setError(null);
    setMessage(null);

    try {
      const updatedClass = await adminService.updateClass(classItem.public_id, {
        status: classItem.status === "active" ? "paused" : "active",
      });
      setClasses((currentClasses) =>
        currentClasses.map((item) =>
          item.public_id === classItem.public_id ? updatedClass : item,
        ),
      );
      setMessage(`Updated ${updatedClass.name} to ${updatedClass.status}.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update class.");
    } finally {
      setUpdatingClassId(null);
    }
  };

  if (!hasInitialized || isInitializing || !user) {
    return <AdminLoadingSurface />;
  }

  if (!isAdmin) {
    return <AdminForbiddenSurface user={user} />;
  }

  return (
    <AdminShell user={user} title="Classes" breadcrumb={["Classes"]}>
      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {message ? (
        <div className="rounded-lg border border-[#d8ff5d]/24 bg-[#d8ff5d]/10 px-4 py-3 text-sm font-medium text-[#efffb8]">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <section className="min-w-0 rounded-lg border border-white/10 bg-white/[0.055] p-5 backdrop-blur-2xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[0.68rem] uppercase tracking-[0.22em] text-white/42">
                Class registry
              </div>
              <h1 className="mt-2 font-[var(--font-display)] text-2xl font-bold text-white">
                Classes
              </h1>
            </div>
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-[#65f7ff]" /> : null}
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-white/10 bg-black/18">
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full border-collapse text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.035] text-[0.68rem] uppercase tracking-[0.18em] text-white/42">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Class</th>
                    <th className="px-4 py-3 font-semibold">Camp</th>
                    <th className="px-4 py-3 text-right font-semibold">Members</th>
                    <th className="px-4 py-3 font-semibold">Window</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {classes.map((classItem) => (
                    <tr key={classItem.public_id} className="hover:bg-[#65f7ff]/[0.055]">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-white">{classItem.name}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/38">
                          {classItem.code}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-white/62">{classItem.camp_name}</td>
                      <td className="px-4 py-4 text-right text-white">
                        {classItem.student_count} students / {classItem.coach_count} coaches
                      </td>
                      <td className="px-4 py-4 text-white/62">
                        {formatDate(classItem.start_date)} to {formatDate(classItem.end_date)}
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-full border border-[#d8ff5d]/24 bg-[#d8ff5d]/10 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#e8ff9a]">
                          {classItem.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={routes.admin.classMembers(classItem.public_id)}
                            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/24 bg-[#65f7ff]/10 px-3 text-xs font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/16"
                          >
                            <UsersRound className="h-4 w-4" />
                            Members
                          </Link>
                          <button
                            type="button"
                            disabled={updatingClassId === classItem.public_id}
                            onClick={() => toggleClassStatus(classItem)}
                            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.045] px-3 text-xs font-semibold text-white/72 transition hover:border-[#d8ff5d]/24 hover:bg-[#d8ff5d]/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {updatingClassId === classItem.public_id ? "Saving" : classItem.status === "active" ? "Pause" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {classes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-white/48">
                        No classes yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.055] p-5 backdrop-blur-2xl">
          <div className={labelClass}>Create class</div>
          <h2 className="mt-2 font-[var(--font-display)] text-xl font-bold text-white">
            Add class
          </h2>
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className={labelClass}>Camp</span>
              <select className={fieldClass} value={campPublicId} onChange={(event) => setCampPublicId(event.target.value)} required>
                <option value="">Select camp</option>
                {camps.map((camp) => (
                  <option key={camp.public_id} value={camp.public_id}>
                    {camp.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className={labelClass}>Name</span>
              <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label className="block space-y-2">
              <span className={labelClass}>Code</span>
              <input className={fieldClass} value={code} onChange={(event) => setCode(event.target.value)} required />
            </label>
            <label className="block space-y-2">
              <span className={labelClass}>Description</span>
              <textarea className={`${fieldClass} min-h-20 resize-none py-3`} value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className={labelClass}>Age group</span>
                <input className={fieldClass} value={ageGroup} onChange={(event) => setAgeGroup(event.target.value)} />
              </label>
              <label className="block space-y-2">
                <span className={labelClass}>Max</span>
                <input className={fieldClass} type="number" min={1} value={maxStudents} onChange={(event) => setMaxStudents(event.target.value)} />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className={labelClass}>Start</span>
                <input className={fieldClass} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
              </label>
              <label className="block space-y-2">
                <span className={labelClass}>End</span>
                <input className={fieldClass} type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
              </label>
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !campPublicId}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/34 bg-[#65f7ff]/12 px-4 text-sm font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/18 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create class
            </button>
          </form>
        </section>
      </div>
    </AdminShell>
  );
}
