"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Loader2,
  Megaphone,
  Save,
  Search,
  Send,
} from "lucide-react";

import {
  AdminForbiddenSurface,
  AdminLoadingSurface,
  AdminShell,
} from "@/components/admin/AdminShell";
import { formatDateTime } from "@/components/coach/coachUtils";
import { cn } from "@/lib/utils";
import {
  adminService,
  type AdminAnnouncementRead,
  type AdminAnnouncementScopeType,
  type AdminCampRead,
  type AdminClassRead,
  type AdminCreateAnnouncementPayload,
  type AdminUserRole,
} from "@/services/admin";
import { useAuthStore } from "@/store/authStore";

const fieldClass =
  "min-h-11 w-full rounded-lg border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#65f7ff]/46 focus:bg-black/34 focus:ring-2 focus:ring-[#65f7ff]/12";
const labelClass = "text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/46";
const scopes: AdminAnnouncementScopeType[] = ["global", "camp", "class", "role"];
const statuses = ["published", "draft", "archived"];
const targetRoles: AdminUserRole[] = ["coach", "student"];

function statusTone(status: string) {
  if (status === "published") {
    return "border-[#d8ff5d]/24 bg-[#d8ff5d]/10 text-[#e8ff9a]";
  }
  if (status === "archived") {
    return "border-white/10 bg-white/[0.04] text-white/48";
  }
  return "border-[#65f7ff]/24 bg-[#65f7ff]/10 text-[#dffbff]";
}

function scopeLabel(item: AdminAnnouncementRead) {
  if (item.scope_type === "camp") {
    return item.camp_name || "Camp";
  }
  if (item.scope_type === "class") {
    return item.class_name || "Class";
  }
  if (item.scope_type === "role") {
    return item.target_role || "Role";
  }
  return "Global";
}

function scopedPayload(form: AdminCreateAnnouncementPayload): AdminCreateAnnouncementPayload {
  return {
    ...form,
    target_role: form.scope_type === "role" ? form.target_role : null,
    camp_public_id: form.scope_type === "camp" ? form.camp_public_id : null,
    class_public_id: form.scope_type === "class" ? form.class_public_id : null,
    publish_at: form.publish_at || null,
    expire_at: form.expire_at || null,
  };
}

function emptyForm(): AdminCreateAnnouncementPayload {
  return {
    scope_type: "global",
    target_role: "student",
    camp_public_id: "",
    class_public_id: "",
    title: "",
    content: "",
    status: "published",
    is_pinned: false,
    publish_at: "",
    expire_at: "",
    notify_recipients: true,
  };
}

export default function AdminAnnouncementsPage() {
  const user = useAuthStore((state) => state.user);
  const hasInitialized = useAuthStore((state) => state.hasInitialized);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const [announcements, setAnnouncements] = useState<AdminAnnouncementRead[]>([]);
  const [camps, setCamps] = useState<AdminCampRead[]>([]);
  const [classes, setClasses] = useState<AdminClassRead[]>([]);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AdminAnnouncementRead | null>(null);
  const [scopeFilter, setScopeFilter] = useState<AdminAnnouncementScopeType | "">("");
  const [statusFilter, setStatusFilter] = useState("");
  const [keyword, setKeyword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<AdminCreateAnnouncementPayload>(emptyForm);

  const isAdmin = user?.role === "admin";

  const loadAnnouncements = async () => {
    const response = await adminService.listAnnouncements({
      scope_type: scopeFilter,
      status: statusFilter,
      keyword: keyword.trim(),
      limit: 100,
    });
    setAnnouncements(response.items);
  };

  useEffect(() => {
    if (!hasInitialized || !user || !isAdmin) {
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);

    void Promise.all([
      adminService.listAnnouncements({ limit: 100 }),
      adminService.listCamps(),
      adminService.listClasses(),
    ])
      .then(([announcementResponse, campsResponse, classesResponse]) => {
        if (!isActive) {
          return;
        }
        setAnnouncements(announcementResponse.items);
        setCamps(campsResponse.items);
        setClasses(classesResponse.items);
      })
      .catch((fetchError) => {
        if (isActive) {
          setError(fetchError instanceof Error ? fetchError.message : "Unable to load announcements.");
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

  const submitFilters = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await loadAnnouncements();
    } catch (filterError) {
      setError(filterError instanceof Error ? filterError.message : "Unable to filter announcements.");
    }
  };

  const createAnnouncement = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const created = await adminService.createAnnouncement(
        scopedPayload({
          ...form,
          title: form.title.trim(),
          content: form.content.trim(),
        }),
      );
      setMessage(`Published ${created.title}.`);
      setForm(emptyForm());
      await loadAnnouncements();
      setSelectedAnnouncement(null);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create announcement.");
    } finally {
      setIsSaving(false);
    }
  };

  const selectAnnouncement = (item: AdminAnnouncementRead) => {
    setSelectedAnnouncement(item);
    setForm({
      scope_type: item.scope_type,
      target_role: item.target_role ?? "student",
      camp_public_id: item.camp_public_id ?? "",
      class_public_id: item.class_public_id ?? "",
      title: item.title,
      content: item.content,
      status: item.status,
      is_pinned: item.is_pinned,
      publish_at: item.publish_at ?? "",
      expire_at: item.expire_at ?? "",
      notify_recipients: false,
    });
  };

  const saveSelectedAnnouncement = async () => {
    if (!selectedAnnouncement) {
      return;
    }
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await adminService.updateAnnouncement(
        selectedAnnouncement.public_id,
        scopedPayload({
          ...form,
          title: form.title.trim(),
          content: form.content.trim(),
        }),
      );
      setMessage(`Updated ${updated.title}.`);
      await loadAnnouncements();
      setSelectedAnnouncement(updated);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update announcement.");
    } finally {
      setIsSaving(false);
    }
  };

  const submitAnnouncementForm = async (event: React.FormEvent<HTMLFormElement>) => {
    if (!selectedAnnouncement) {
      await createAnnouncement(event);
      return;
    }
    event.preventDefault();
    await saveSelectedAnnouncement();
  };

  const startNewAnnouncement = () => {
    setSelectedAnnouncement(null);
    setForm(emptyForm());
  };

  const archiveAnnouncement = async (item: AdminAnnouncementRead) => {
    setError(null);
    setMessage(null);
    try {
      await adminService.archiveAnnouncement(item.public_id);
      setMessage(`Archived ${item.title}.`);
      await loadAnnouncements();
      if (selectedAnnouncement?.public_id === item.public_id) {
        setSelectedAnnouncement(null);
      }
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Unable to archive announcement.");
    }
  };

  if (!hasInitialized || isInitializing || !user) {
    return <AdminLoadingSurface />;
  }

  if (!isAdmin) {
    return <AdminForbiddenSurface user={user} />;
  }

  return (
    <AdminShell user={user} title="Announcements" breadcrumb={["Announcements"]}>
      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {message ? (
        <div className="flex items-center gap-2 rounded-lg border border-[#d8ff5d]/24 bg-[#d8ff5d]/10 px-4 py-3 text-sm font-medium text-[#efffb8]">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]">
        <section className="min-w-0 rounded-lg border border-white/10 bg-white/[0.055] p-5 backdrop-blur-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className={labelClass}>Broadcast center</div>
              <h1 className="mt-2 font-[var(--font-display)] text-2xl font-bold text-white">
                Scope-aware announcements
              </h1>
              <p className="mt-2 text-sm text-white/52">
                {announcements.length} announcements in the current view
              </p>
            </div>
            <form className="grid gap-3 md:grid-cols-[9rem_9rem_minmax(12rem,1fr)_auto]" onSubmit={submitFilters}>
              <select className={fieldClass} value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value as AdminAnnouncementScopeType | "")}>
                <option value="">All scopes</option>
                {scopes.map((scope) => (
                  <option key={scope} value={scope}>
                    {scope}
                  </option>
                ))}
              </select>
              <select className={fieldClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">All status</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <input
                className={fieldClass}
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="Title or content"
              />
              <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/24 bg-[#65f7ff]/10 px-4 text-sm font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/16">
                <Search className="h-4 w-4" />
                Search
              </button>
            </form>
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-white/10 bg-black/18">
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full border-collapse text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.035] text-[0.68rem] uppercase tracking-[0.18em] text-white/42">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Announcement</th>
                    <th className="px-4 py-3 font-semibold">Scope</th>
                    <th className="px-4 py-3 text-right font-semibold">Notify</th>
                    <th className="px-4 py-3 font-semibold">Publish</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {announcements.map((item) => (
                    <tr key={item.public_id} className="transition hover:bg-[#65f7ff]/[0.055]">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 font-semibold text-white">
                          <Megaphone className="h-4 w-4 text-[#65f7ff]" />
                          {item.title}
                        </div>
                        <div className="mt-1 max-w-[26rem] truncate text-xs text-white/42">
                          {item.content}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-white/62">
                        <div className="font-semibold text-white">{scopeLabel(item)}</div>
                        <div className="mt-1 text-xs text-white/38">{item.scope_type}</div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="font-[var(--font-display)] text-xl font-bold text-[#d8ff5d]">
                          {item.notification_count}
                        </div>
                        <div className="mt-1 text-xs text-white/42">{item.read_count} read</div>
                      </td>
                      <td className="px-4 py-4 text-white/62">{formatDateTime(item.publish_at || item.created_at)}</td>
                      <td className="px-4 py-4">
                        <span className={cn("rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em]", statusTone(item.status))}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => selectAnnouncement(item)} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/24 bg-[#65f7ff]/10 px-3 text-xs font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/16">
                            <Save className="h-4 w-4" />
                            Edit
                          </button>
                          <button type="button" onClick={() => archiveAnnouncement(item)} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 text-xs font-semibold text-white/72 transition hover:border-red-300/24 hover:bg-red-400/10 hover:text-red-100">
                            <Archive className="h-4 w-4" />
                            Archive
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {announcements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-white/48">
                        {isLoading ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-[#65f7ff]" />
                            Loading announcements
                          </span>
                        ) : (
                          "No announcements match the current filters."
                        )}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <aside className="rounded-lg border border-white/10 bg-white/[0.055] p-5 backdrop-blur-2xl">
          <div className={labelClass}>{selectedAnnouncement ? "Edit announcement" : "Create announcement"}</div>
          <h2 className="mt-2 font-[var(--font-display)] text-xl font-bold text-white">
            {selectedAnnouncement ? selectedAnnouncement.title : "Publish broadcast"}
          </h2>
          <form className="mt-5 space-y-4" onSubmit={submitAnnouncementForm}>
            <label className="block space-y-2">
              <span className={labelClass}>Scope</span>
              <select className={fieldClass} value={form.scope_type} onChange={(event) => setForm((current) => ({ ...current, scope_type: event.target.value as AdminAnnouncementScopeType }))}>
                {scopes.map((scope) => (
                  <option key={scope} value={scope}>
                    {scope}
                  </option>
                ))}
              </select>
            </label>
            {form.scope_type === "camp" ? (
              <label className="block space-y-2">
                <span className={labelClass}>Camp</span>
                <select className={fieldClass} value={form.camp_public_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, camp_public_id: event.target.value }))} required>
                  <option value="">Select camp</option>
                  {camps.map((camp) => (
                    <option key={camp.public_id} value={camp.public_id}>
                      {camp.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {form.scope_type === "class" ? (
              <label className="block space-y-2">
                <span className={labelClass}>Class</span>
                <select className={fieldClass} value={form.class_public_id ?? ""} onChange={(event) => setForm((current) => ({ ...current, class_public_id: event.target.value }))} required>
                  <option value="">Select class</option>
                  {classes.map((classItem) => (
                    <option key={classItem.public_id} value={classItem.public_id}>
                      {classItem.name} / {classItem.camp_name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {form.scope_type === "role" ? (
              <label className="block space-y-2">
                <span className={labelClass}>Target role</span>
                <select className={fieldClass} value={form.target_role ?? "student"} onChange={(event) => setForm((current) => ({ ...current, target_role: event.target.value as AdminUserRole }))}>
                  {targetRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="block space-y-2">
              <span className={labelClass}>Title</span>
              <input className={fieldClass} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required />
            </label>
            <label className="block space-y-2">
              <span className={labelClass}>Content</span>
              <textarea className={`${fieldClass} min-h-36 resize-y py-3`} value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} required />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className={labelClass}>Status</span>
                <select className={fieldClass} value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-white/10 bg-black/20 px-3">
                <span className="text-sm font-semibold text-white/72">Pinned</span>
                <input type="checkbox" checked={Boolean(form.is_pinned)} onChange={(event) => setForm((current) => ({ ...current, is_pinned: event.target.checked }))} className="h-4 w-4 accent-[#d8ff5d]" />
              </label>
            </div>
            <label className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-white/10 bg-black/20 px-3">
              <span className="text-sm font-semibold text-white/72">Notify recipients</span>
              <input type="checkbox" checked={Boolean(form.notify_recipients)} onChange={(event) => setForm((current) => ({ ...current, notify_recipients: event.target.checked }))} className="h-4 w-4 accent-[#d8ff5d]" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className={labelClass}>Publish at</span>
                <input className={fieldClass} value={form.publish_at ?? ""} onChange={(event) => setForm((current) => ({ ...current, publish_at: event.target.value }))} placeholder="ISO datetime" />
              </label>
              <label className="block space-y-2">
                <span className={labelClass}>Expire at</span>
                <input className={fieldClass} value={form.expire_at ?? ""} onChange={(event) => setForm((current) => ({ ...current, expire_at: event.target.value }))} placeholder="ISO datetime" />
              </label>
            </div>
            {selectedAnnouncement ? (
              <button type="button" onClick={saveSelectedAnnouncement} disabled={isSaving} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#d8ff5d]/32 bg-[#d8ff5d]/10 px-4 text-sm font-semibold text-[#f1ffc1] transition hover:bg-[#d8ff5d]/16 disabled:cursor-not-allowed disabled:opacity-60">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save announcement
              </button>
            ) : (
              <button type="submit" disabled={isSaving} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/34 bg-[#65f7ff]/12 px-4 text-sm font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/18 disabled:cursor-not-allowed disabled:opacity-60">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Create announcement
              </button>
            )}
            {selectedAnnouncement ? (
              <button type="button" onClick={startNewAnnouncement} className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.045] px-4 text-sm font-semibold text-white/62 transition hover:bg-white/[0.08]">
                New announcement
              </button>
            ) : null}
          </form>
        </aside>
      </div>
    </AdminShell>
  );
}
