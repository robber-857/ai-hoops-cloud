"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Search,
  UserCog,
  UserX,
} from "lucide-react";

import {
  AdminForbiddenSurface,
  AdminLoadingSurface,
  AdminShell,
} from "@/components/admin/AdminShell";
import { formatDateTime } from "@/components/coach/coachUtils";
import {
  adminService,
  type AdminClassRead,
  type AdminCreateUserPayload,
  type AdminUserDetailRead,
  type AdminUserRead,
  type AdminUserRole,
  type AdminUserStatus,
} from "@/services/admin";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

const fieldClass =
  "min-h-11 w-full rounded-lg border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#65f7ff]/46 focus:bg-black/34 focus:ring-2 focus:ring-[#65f7ff]/12";
const labelClass = "text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/46";
const roles: AdminUserRole[] = ["student", "coach", "admin"];
const statuses: AdminUserStatus[] = ["active", "disabled", "locked"];

function statusTone(status: string) {
  if (status === "active") {
    return "border-[#d8ff5d]/24 bg-[#d8ff5d]/10 text-[#e8ff9a]";
  }
  if (status === "disabled") {
    return "border-red-300/24 bg-red-400/10 text-red-100";
  }
  return "border-[#65f7ff]/24 bg-[#65f7ff]/10 text-[#dffbff]";
}

function displayName(user: AdminUserRead) {
  return user.nickname?.trim() || user.username;
}

function selectedClassIds(user: AdminUserDetailRead | null) {
  if (!user) {
    return [];
  }
  return user.memberships
    .filter((membership) => membership.status === "active")
    .map((membership) => membership.class_public_id);
}

export default function AdminUsersPage() {
  const user = useAuthStore((state) => state.user);
  const hasInitialized = useAuthStore((state) => state.hasInitialized);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const [users, setUsers] = useState<AdminUserRead[]>([]);
  const [classes, setClasses] = useState<AdminClassRead[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetailRead | null>(null);
  const [roleFilter, setRoleFilter] = useState<"" | AdminUserRole>("");
  const [statusFilter, setStatusFilter] = useState<"" | AdminUserStatus>("");
  const [keyword, setKeyword] = useState("");
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState<AdminCreateUserPayload>({
    username: "",
    password: "",
    phone_number: "",
    email: "",
    nickname: "",
    role: "student",
    status: "active",
    class_public_ids: [],
  });

  const [editNickname, setEditNickname] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState<AdminUserRole>("student");
  const [editStatus, setEditStatus] = useState<AdminUserStatus>("active");
  const [editPassword, setEditPassword] = useState("");
  const [editClassIds, setEditClassIds] = useState<string[]>([]);

  const isAdmin = user?.role === "admin";

  const loadUsers = async () => {
    const response = await adminService.listUsers({
      role: roleFilter,
      status: statusFilter,
      keyword: keyword.trim(),
      page: 1,
      page_size: 50,
    });
    setUsers(response.items);
    setTotal(response.total);
    setSelectedUser((current) => {
      if (!current) {
        return current;
      }
      return response.items.some((item) => item.public_id === current.public_id) ? current : null;
    });
  };

  const loadSelectedUser = async (userPublicId: string) => {
    const detail = await adminService.getUser(userPublicId);
    setSelectedUser(detail);
    setEditNickname(detail.nickname || "");
    setEditEmail(detail.email || "");
    setEditPhone(detail.phone_number);
    setEditRole(detail.role === "user" ? "student" : detail.role);
    setEditStatus(detail.status);
    setEditPassword("");
    setEditClassIds(selectedClassIds(detail));
  };

  useEffect(() => {
    if (!hasInitialized || !user || !isAdmin) {
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);

    void Promise.all([adminService.listUsers({ page: 1, page_size: 50 }), adminService.listClasses()])
      .then(([usersResponse, classesResponse]) => {
        if (!isActive) {
          return;
        }
        setUsers(usersResponse.items);
        setTotal(usersResponse.total);
        setClasses(classesResponse.items);
      })
      .catch((fetchError) => {
        if (isActive) {
          setError(fetchError instanceof Error ? fetchError.message : "Unable to load users.");
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

  const filteredClasses = useMemo(
    () => classes.filter((classItem) => classItem.status !== "archived"),
    [classes],
  );

  const toggleCreateClass = (classPublicId: string, checked: boolean) => {
    setCreateForm((current) => {
      const currentIds = current.class_public_ids ?? [];
      return {
        ...current,
        class_public_ids: checked
          ? [...new Set([...currentIds, classPublicId])]
          : currentIds.filter((id) => id !== classPublicId),
      };
    });
  };

  const toggleEditClass = (classPublicId: string, checked: boolean) => {
    setEditClassIds((current) =>
      checked
        ? [...new Set([...current, classPublicId])]
        : current.filter((id) => id !== classPublicId),
    );
  };

  const submitFilters = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await loadUsers();
    } catch (filterError) {
      setError(filterError instanceof Error ? filterError.message : "Unable to filter users.");
    }
  };

  const createUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsCreating(true);
    setError(null);
    setMessage(null);
    try {
      const createdUser = await adminService.createUser({
        ...createForm,
        username: createForm.username.trim(),
        password: createForm.password,
        phone_number: createForm.phone_number.trim(),
        email: createForm.email?.trim() || null,
        nickname: createForm.nickname?.trim() || null,
        class_public_ids:
          createForm.role === "coach" || createForm.role === "student"
            ? createForm.class_public_ids
            : [],
      });
      setMessage(`Created ${displayName(createdUser)}.`);
      setCreateForm({
        username: "",
        password: "",
        phone_number: "",
        email: "",
        nickname: "",
        role: "student",
        status: "active",
        class_public_ids: [],
      });
      await loadUsers();
      await loadSelectedUser(createdUser.public_id);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create user.");
    } finally {
      setIsCreating(false);
    }
  };

  const saveSelectedUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedUser) {
      return;
    }
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updatedUser = await adminService.updateUser(selectedUser.public_id, {
        nickname: editNickname.trim() || null,
        email: editEmail.trim() || null,
        phone_number: editPhone.trim(),
        role: editRole,
        status: editStatus,
        password: editPassword || undefined,
        class_public_ids: editRole === "coach" || editRole === "student" ? editClassIds : [],
      });
      setMessage(`Updated ${displayName(updatedUser)}.`);
      await loadUsers();
      await loadSelectedUser(updatedUser.public_id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update user.");
    } finally {
      setIsSaving(false);
    }
  };

  const setUserStatus = async (targetUser: AdminUserRead, status: AdminUserStatus) => {
    setError(null);
    setMessage(null);
    try {
      const updatedUser = await adminService.updateUser(targetUser.public_id, { status });
      setMessage(`${displayName(updatedUser)} is now ${updatedUser.status}.`);
      await loadUsers();
      if (selectedUser?.public_id === targetUser.public_id) {
        await loadSelectedUser(targetUser.public_id);
      }
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Unable to update status.");
    }
  };

  if (!hasInitialized || isInitializing || !user) {
    return <AdminLoadingSurface />;
  }

  if (!isAdmin) {
    return <AdminForbiddenSurface user={user} />;
  }

  return (
    <AdminShell user={user} title="Registered Users" breadcrumb={["Users"]}>
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
              <div className={labelClass}>People registry</div>
              <h1 className="mt-2 font-[var(--font-display)] text-2xl font-bold text-white">
                Coaches and students
              </h1>
              <p className="mt-2 text-sm text-white/52">{total} registered records</p>
            </div>
            <form className="grid gap-3 md:grid-cols-[9rem_9rem_minmax(12rem,1fr)_auto]" onSubmit={submitFilters}>
              <select className={fieldClass} value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as "" | AdminUserRole)}>
                <option value="">All roles</option>
                {roles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <select className={fieldClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "" | AdminUserStatus)}>
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
                placeholder="Name, email, phone"
              />
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/24 bg-[#65f7ff]/10 px-4 text-sm font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/16"
              >
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
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Contact</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Classes</th>
                    <th className="px-4 py-3 text-right font-semibold">Reports</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {users.map((item) => (
                    <tr key={item.public_id} className="transition hover:bg-[#65f7ff]/[0.055]">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-white">{displayName(item)}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.14em] text-white/38">
                          {item.username}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-white/62">
                        <div>{item.email || "--"}</div>
                        <div className="mt-1 text-xs text-white/40">{item.phone_number}</div>
                      </td>
                      <td className="px-4 py-4 text-white/72">{item.role}</td>
                      <td className="px-4 py-4 text-white/62">
                        <div className="max-w-[16rem] truncate">
                          {item.class_names.length > 0 ? item.class_names.join(", ") : "--"}
                        </div>
                        <div className="mt-1 text-xs text-white/38">
                          {item.camp_names.length > 0 ? item.camp_names.join(", ") : "No camp"}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-semibold text-white">
                        {item.report_count}
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn("rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em]", statusTone(item.status))}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => loadSelectedUser(item.public_id)}
                            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/24 bg-[#65f7ff]/10 px-3 text-xs font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/16"
                          >
                            <Eye className="h-4 w-4" />
                            Detail
                          </button>
                          {item.status === "active" ? (
                            <button
                              type="button"
                              onClick={() => setUserStatus(item, "disabled")}
                              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-red-300/24 bg-red-400/10 px-3 text-xs font-semibold text-red-100 transition hover:bg-red-400/16"
                            >
                              <UserX className="h-4 w-4" />
                              Disable
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setUserStatus(item, "active")}
                              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#d8ff5d]/24 bg-[#d8ff5d]/10 px-3 text-xs font-semibold text-[#f1ffc1] transition hover:bg-[#d8ff5d]/16"
                            >
                              <RotateCcw className="h-4 w-4" />
                              Restore
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-white/48">
                        {isLoading ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-[#65f7ff]" />
                            Loading users
                          </span>
                        ) : (
                          "No users match the current filters."
                        )}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {selectedUser ? (
            <form className="mt-5 rounded-lg border border-white/10 bg-black/16 p-4" onSubmit={saveSelectedUser}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className={labelClass}>Selected user</div>
                  <h2 className="mt-2 font-[var(--font-display)] text-xl font-bold text-white">
                    {displayName(selectedUser)}
                  </h2>
                  <p className="mt-1 text-sm text-white/48">
                    Last login {formatDateTime(selectedUser.last_login_at)} / Last training{" "}
                    {formatDateTime(selectedUser.last_training_at)}
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#d8ff5d]/24 bg-[#d8ff5d]/10 px-4 text-sm font-semibold text-[#f1ffc1] transition hover:bg-[#d8ff5d]/16 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save user
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="block space-y-2">
                  <span className={labelClass}>Nickname</span>
                  <input className={fieldClass} value={editNickname} onChange={(event) => setEditNickname(event.target.value)} />
                </label>
                <label className="block space-y-2">
                  <span className={labelClass}>Email</span>
                  <input className={fieldClass} value={editEmail} onChange={(event) => setEditEmail(event.target.value)} />
                </label>
                <label className="block space-y-2">
                  <span className={labelClass}>Phone</span>
                  <input className={fieldClass} value={editPhone} onChange={(event) => setEditPhone(event.target.value)} required />
                </label>
                <label className="block space-y-2">
                  <span className={labelClass}>Role</span>
                  <select className={fieldClass} value={editRole} onChange={(event) => setEditRole(event.target.value as AdminUserRole)}>
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className={labelClass}>Status</span>
                  <select className={fieldClass} value={editStatus} onChange={(event) => setEditStatus(event.target.value as AdminUserStatus)}>
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className={labelClass}>Reset password</span>
                  <input className={fieldClass} value={editPassword} onChange={(event) => setEditPassword(event.target.value)} placeholder="Leave blank" type="password" />
                </label>
              </div>

              <div className="mt-5">
                <div className={labelClass}>Class assignment</div>
                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {filteredClasses.map((classItem) => (
                    <label
                      key={classItem.public_id}
                      className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.035] px-3 text-sm text-white/72"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-white">{classItem.name}</span>
                        <span className="block truncate text-xs text-white/42">{classItem.camp_name}</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={editClassIds.includes(classItem.public_id)}
                        onChange={(event) => toggleEditClass(classItem.public_id, event.target.checked)}
                        disabled={editRole === "admin"}
                        className="h-4 w-4 shrink-0 accent-[#d8ff5d] disabled:opacity-40"
                      />
                    </label>
                  ))}
                  {filteredClasses.length === 0 ? (
                    <div className="rounded-lg border border-white/10 bg-black/18 p-4 text-sm text-white/48">
                      Create classes before assigning users.
                    </div>
                  ) : null}
                </div>
              </div>
            </form>
          ) : null}
        </section>

        <aside className="space-y-5">
          <section className="rounded-lg border border-white/10 bg-white/[0.055] p-5 backdrop-blur-2xl">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#65f7ff]/24 bg-[#65f7ff]/10 text-[#65f7ff]">
                <UserCog className="h-5 w-5" />
              </span>
              <div>
                <div className={labelClass}>Create account</div>
                <h2 className="font-[var(--font-display)] text-xl font-bold text-white">
                  Add coach or student
                </h2>
              </div>
            </div>
            <form className="mt-5 space-y-4" onSubmit={createUser}>
              <label className="block space-y-2">
                <span className={labelClass}>Username</span>
                <input className={fieldClass} value={createForm.username} onChange={(event) => setCreateForm((current) => ({ ...current, username: event.target.value }))} required />
              </label>
              <label className="block space-y-2">
                <span className={labelClass}>Temporary password</span>
                <input className={fieldClass} value={createForm.password} onChange={(event) => setCreateForm((current) => ({ ...current, password: event.target.value }))} type="password" required />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className={labelClass}>Role</span>
                  <select className={fieldClass} value={createForm.role} onChange={(event) => setCreateForm((current) => ({ ...current, role: event.target.value as AdminUserRole }))}>
                    <option value="student">student</option>
                    <option value="coach">coach</option>
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className={labelClass}>Status</span>
                  <select className={fieldClass} value={createForm.status} onChange={(event) => setCreateForm((current) => ({ ...current, status: event.target.value as AdminUserStatus }))}>
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block space-y-2">
                <span className={labelClass}>Nickname</span>
                <input className={fieldClass} value={createForm.nickname ?? ""} onChange={(event) => setCreateForm((current) => ({ ...current, nickname: event.target.value }))} />
              </label>
              <label className="block space-y-2">
                <span className={labelClass}>Email</span>
                <input className={fieldClass} value={createForm.email ?? ""} onChange={(event) => setCreateForm((current) => ({ ...current, email: event.target.value }))} />
              </label>
              <label className="block space-y-2">
                <span className={labelClass}>Phone</span>
                <input className={fieldClass} value={createForm.phone_number} onChange={(event) => setCreateForm((current) => ({ ...current, phone_number: event.target.value }))} required />
              </label>
              <div>
                <div className={labelClass}>Assign classes</div>
                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                  {filteredClasses.map((classItem) => (
                    <label key={classItem.public_id} className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/18 px-3 text-sm text-white/66">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-white">{classItem.name}</span>
                        <span className="block truncate text-xs text-white/38">{classItem.camp_name}</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={(createForm.class_public_ids ?? []).includes(classItem.public_id)}
                        onChange={(event) => toggleCreateClass(classItem.public_id, event.target.checked)}
                        className="h-4 w-4 shrink-0 accent-[#d8ff5d]"
                      />
                    </label>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                disabled={isCreating}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/34 bg-[#65f7ff]/12 px-4 text-sm font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/18 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create user
              </button>
            </form>
          </section>
        </aside>
      </div>
    </AdminShell>
  );
}
