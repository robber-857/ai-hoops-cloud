"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Pencil, Plus, Save } from "lucide-react";

import {
  AdminForbiddenSurface,
  AdminLoadingSurface,
  AdminShell,
} from "@/components/admin/AdminShell";
import { formatDate, formatDateTime } from "@/components/coach/coachUtils";
import { adminService, type AdminCampRead } from "@/services/admin";
import { useAuthStore } from "@/store/authStore";

const fieldClass =
  "min-h-11 w-full rounded-lg border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#65f7ff]/46 focus:bg-black/34 focus:ring-2 focus:ring-[#65f7ff]/12";
const labelClass = "text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/46";

function toApiDate(value: string) {
  return value || null;
}

export default function AdminCampsPage() {
  const user = useAuthStore((state) => state.user);
  const hasInitialized = useAuthStore((state) => state.hasInitialized);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const [camps, setCamps] = useState<AdminCampRead[]>([]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [seasonName, setSeasonName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editCamp, setEditCamp] = useState<AdminCampRead | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editSeasonName, setEditSeasonName] = useState("");
  const [editStatus, setEditStatus] = useState("active");
  const [editDescription, setEditDescription] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";

  const loadCamps = async () => {
    const response = await adminService.listCamps();
    setCamps(response.items);
  };

  useEffect(() => {
    if (!hasInitialized || !user || !isAdmin) {
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);

    void adminService
      .listCamps()
      .then((response) => {
        if (isActive) {
          setCamps(response.items);
        }
      })
      .catch((fetchError) => {
        if (isActive) {
          setError(fetchError instanceof Error ? fetchError.message : "Unable to load camps.");
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

    try {
      const camp = await adminService.createCamp({
        name: name.trim(),
        code: code.trim(),
        description: description.trim() || null,
        season_name: seasonName.trim() || null,
        status: "active",
        start_date: toApiDate(startDate),
        end_date: toApiDate(endDate),
      });
      setMessage(`Created camp ${camp.name}.`);
      setName("");
      setCode("");
      setSeasonName("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      await loadCamps();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create camp.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const beginEdit = (camp: AdminCampRead) => {
    setEditCamp(camp);
    setEditName(camp.name);
    setEditCode(camp.code);
    setEditSeasonName(camp.season_name || "");
    setEditStatus(camp.status);
    setEditDescription(camp.description || "");
    setEditStartDate(camp.start_date || "");
    setEditEndDate(camp.end_date || "");
    setMessage(null);
    setError(null);
  };

  const handleEditSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editCamp) {
      return;
    }

    setIsSubmittingEdit(true);
    setError(null);
    setMessage(null);

    try {
      const camp = await adminService.updateCamp(editCamp.public_id, {
        name: editName.trim(),
        code: editCode.trim(),
        season_name: editSeasonName.trim() || null,
        status: editStatus,
        description: editDescription.trim() || null,
        start_date: toApiDate(editStartDate),
        end_date: toApiDate(editEndDate),
      });
      setMessage(`Updated camp ${camp.name}.`);
      setEditCamp(camp);
      await loadCamps();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to update camp.");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  if (!hasInitialized || isInitializing || !user) {
    return <AdminLoadingSurface />;
  }

  if (!isAdmin) {
    return <AdminForbiddenSurface user={user} />;
  }

  return (
    <AdminShell user={user} title="Training Camps" breadcrumb={["Camps"]}>
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
                Camp registry
              </div>
              <h1 className="mt-2 font-[var(--font-display)] text-2xl font-bold text-white">
                Training camps
              </h1>
            </div>
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-[#65f7ff]" /> : null}
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-white/10 bg-black/18">
            <div className="overflow-x-auto">
              <table className="min-w-[820px] w-full border-collapse text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.035] text-[0.68rem] uppercase tracking-[0.18em] text-white/42">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Camp</th>
                    <th className="px-4 py-3 font-semibold">Season</th>
                    <th className="px-4 py-3 text-right font-semibold">Classes</th>
                    <th className="px-4 py-3 font-semibold">Window</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {camps.map((camp) => (
                    <tr key={camp.public_id} className="hover:bg-[#65f7ff]/[0.055]">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-white">{camp.name}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/38">
                          {camp.code}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-white/62">{camp.season_name || "--"}</td>
                      <td className="px-4 py-4 text-right font-semibold text-white">
                        {camp.class_count}
                      </td>
                      <td className="px-4 py-4 text-white/62">
                        {formatDate(camp.start_date)} to {formatDate(camp.end_date)}
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-full border border-[#d8ff5d]/24 bg-[#d8ff5d]/10 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#e8ff9a]">
                          {camp.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => beginEdit(camp)}
                          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/24 bg-[#65f7ff]/10 px-3 text-xs font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/16"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {camps.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-white/48">
                        No camps yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-3 text-xs text-white/36">
            Latest update {formatDateTime(camps[0]?.created_at)}
          </div>
        </section>

        <aside className="space-y-5">
        <section className="rounded-lg border border-white/10 bg-white/[0.055] p-5 backdrop-blur-2xl">
          <div className={labelClass}>Edit camp</div>
          <h2 className="mt-2 font-[var(--font-display)] text-xl font-bold text-white">
            {editCamp ? editCamp.name : "Select a camp"}
          </h2>
          {editCamp ? (
            <form className="mt-5 space-y-4" onSubmit={handleEditSubmit}>
              <label className="block space-y-2">
                <span className={labelClass}>Name</span>
                <input className={fieldClass} value={editName} onChange={(event) => setEditName(event.target.value)} required />
              </label>
              <label className="block space-y-2">
                <span className={labelClass}>Code</span>
                <input className={fieldClass} value={editCode} onChange={(event) => setEditCode(event.target.value)} required />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className={labelClass}>Season</span>
                  <input className={fieldClass} value={editSeasonName} onChange={(event) => setEditSeasonName(event.target.value)} />
                </label>
                <label className="block space-y-2">
                  <span className={labelClass}>Status</span>
                  <select className={fieldClass} value={editStatus} onChange={(event) => setEditStatus(event.target.value)}>
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                    <option value="archived">archived</option>
                  </select>
                </label>
              </div>
              <label className="block space-y-2">
                <span className={labelClass}>Description</span>
                <textarea
                  className={`${fieldClass} min-h-24 resize-none py-3`}
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className={labelClass}>Start</span>
                  <input className={fieldClass} type="date" value={editStartDate} onChange={(event) => setEditStartDate(event.target.value)} />
                </label>
                <label className="block space-y-2">
                  <span className={labelClass}>End</span>
                  <input className={fieldClass} type="date" value={editEndDate} onChange={(event) => setEditEndDate(event.target.value)} />
                </label>
              </div>
              <button
                type="submit"
                disabled={isSubmittingEdit}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#d8ff5d]/32 bg-[#d8ff5d]/10 px-4 text-sm font-semibold text-[#f1ffc1] transition hover:bg-[#d8ff5d]/16 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmittingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save changes
              </button>
            </form>
          ) : (
            <p className="mt-4 text-sm leading-6 text-white/50">
              Pick a camp from the registry to update its season, dates, status, or description.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.055] p-5 backdrop-blur-2xl">
          <div className={labelClass}>Create camp</div>
          <h2 className="mt-2 font-[var(--font-display)] text-xl font-bold text-white">
            Add training camp
          </h2>
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className={labelClass}>Name</span>
              <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label className="block space-y-2">
              <span className={labelClass}>Code</span>
              <input className={fieldClass} value={code} onChange={(event) => setCode(event.target.value)} required />
            </label>
            <label className="block space-y-2">
              <span className={labelClass}>Season</span>
              <input className={fieldClass} value={seasonName} onChange={(event) => setSeasonName(event.target.value)} />
            </label>
            <label className="block space-y-2">
              <span className={labelClass}>Description</span>
              <textarea
                className={`${fieldClass} min-h-24 resize-none py-3`}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
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
              disabled={isSubmitting}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/34 bg-[#65f7ff]/12 px-4 text-sm font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/18 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create camp
            </button>
          </form>
        </section>
        </aside>
      </div>
    </AdminShell>
  );
}
