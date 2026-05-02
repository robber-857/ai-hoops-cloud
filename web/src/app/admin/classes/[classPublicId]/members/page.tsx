"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, Loader2, Plus, UserMinus } from "lucide-react";

import {
  AdminForbiddenSurface,
  AdminLoadingSurface,
  AdminShell,
} from "@/components/admin/AdminShell";
import { formatDateTime } from "@/components/coach/coachUtils";
import {
  adminService,
  type AdminClassMemberRead,
  type AdminClassRead,
} from "@/services/admin";
import { useAuthStore } from "@/store/authStore";

const fieldClass =
  "min-h-11 w-full rounded-lg border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#65f7ff]/46 focus:bg-black/34 focus:ring-2 focus:ring-[#65f7ff]/12";
const labelClass = "text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/46";

export default function AdminClassMembersPage() {
  const params = useParams<{ classPublicId: string }>();
  const classPublicId = params.classPublicId;
  const user = useAuthStore((state) => state.user);
  const hasInitialized = useAuthStore((state) => state.hasInitialized);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const [classes, setClasses] = useState<AdminClassRead[]>([]);
  const [members, setMembers] = useState<AdminClassMemberRead[]>([]);
  const [userPublicId, setUserPublicId] = useState("");
  const [memberRole, setMemberRole] = useState("student");
  const [remarks, setRemarks] = useState("");
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";
  const classItem = useMemo(
    () => classes.find((item) => item.public_id === classPublicId) ?? null,
    [classPublicId, classes],
  );

  const loadData = async () => {
    const [classesResponse, membersResponse] = await Promise.all([
      adminService.listClasses(),
      adminService.listClassMembers(classPublicId),
    ]);
    setClasses(classesResponse.items);
    setMembers(membersResponse.items);
  };

  useEffect(() => {
    if (!hasInitialized || !user || !isAdmin || !classPublicId) {
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);

    void Promise.all([adminService.listClasses(), adminService.listClassMembers(classPublicId)])
      .then(([classesResponse, membersResponse]) => {
        if (!isActive) {
          return;
        }
        setClasses(classesResponse.items);
        setMembers(membersResponse.items);
      })
      .catch((fetchError) => {
        if (isActive) {
          setError(fetchError instanceof Error ? fetchError.message : "Unable to load members.");
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
  }, [classPublicId, hasInitialized, isAdmin, user]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const member = await adminService.addClassMember(classPublicId, {
        user_public_id: userPublicId.trim(),
        member_role: memberRole,
        status: "active",
        remarks: remarks.trim() || null,
      });
      setMessage(`Added ${member.username} as ${member.member_role}.`);
      setUserPublicId("");
      setRemarks("");
      await loadData();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to add member.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeMember = async (member: AdminClassMemberRead) => {
    setRemovingMemberId(member.public_id);
    setError(null);
    setMessage(null);

    try {
      await adminService.removeClassMember(classPublicId, member.public_id);
      setMessage(`Removed ${member.username} from class membership.`);
      await loadData();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Unable to remove member.");
    } finally {
      setRemovingMemberId(null);
    }
  };

  if (!hasInitialized || isInitializing || !user) {
    return <AdminLoadingSurface />;
  }

  if (!isAdmin) {
    return <AdminForbiddenSurface user={user} />;
  }

  return (
    <AdminShell
      user={user}
      title={classItem?.name ?? "Class Members"}
      breadcrumb={["Classes", classItem?.name ?? "Members"]}
    >
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
                Member registry
              </div>
              <h1 className="mt-2 font-[var(--font-display)] text-2xl font-bold text-white">
                {classItem?.name ?? "Class members"}
              </h1>
            </div>
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-[#65f7ff]" /> : null}
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-white/10 bg-black/18">
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full border-collapse text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.035] text-[0.68rem] uppercase tracking-[0.18em] text-white/42">
                  <tr>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Joined</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {members.map((member) => (
                    <tr key={member.public_id} className="hover:bg-[#65f7ff]/[0.055]">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-white">
                          {member.nickname || member.username}
                        </div>
                        <div className="mt-1 text-xs text-white/38">{member.user_public_id}</div>
                      </td>
                      <td className="px-4 py-4 text-white/62">
                        {member.member_role} / {member.user_role}
                      </td>
                      <td className="px-4 py-4 text-white/62">
                        {formatDateTime(member.joined_at)}
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-full border border-[#d8ff5d]/24 bg-[#d8ff5d]/10 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[#e8ff9a]">
                          {member.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          disabled={removingMemberId === member.public_id || member.status === "removed"}
                          onClick={() => removeMember(member)}
                          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 text-xs font-semibold text-white/72 transition hover:border-red-300/30 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {removingMemberId === member.public_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <UserMinus className="h-4 w-4" />
                          )}
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-white/48">
                        No members yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.055] p-5 backdrop-blur-2xl">
          <div className={labelClass}>Add member</div>
          <h2 className="mt-2 font-[var(--font-display)] text-xl font-bold text-white">
            Link user to class
          </h2>
          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className={labelClass}>User public ID</span>
              <input
                className={fieldClass}
                value={userPublicId}
                onChange={(event) => setUserPublicId(event.target.value)}
                required
              />
            </label>
            <label className="block space-y-2">
              <span className={labelClass}>Member role</span>
              <select
                className={fieldClass}
                value={memberRole}
                onChange={(event) => setMemberRole(event.target.value)}
              >
                <option value="student">student</option>
                <option value="coach">coach</option>
              </select>
            </label>
            <label className="block space-y-2">
              <span className={labelClass}>Remarks</span>
              <textarea
                className={`${fieldClass} min-h-24 resize-none py-3`}
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
              />
            </label>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/34 bg-[#65f7ff]/12 px-4 text-sm font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/18 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add member
            </button>
          </form>
        </section>
      </div>
    </AdminShell>
  );
}
