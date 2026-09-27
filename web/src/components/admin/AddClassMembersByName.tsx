"use client";
import { useEffect, useRef, useState } from "react";
import {
  adminService,
  type AdminUserRead,
  type AdminClassMemberRead,
} from "@/services/admin";
import { staffName, staffContact } from "@/lib/staffNames";
const field =
  "min-h-11 w-full rounded-lg border border-white/25 bg-[#10141b] px-3 py-2 text-sm text-white";
export function AddClassMembersByName({
  classId,
  members,
  onAdded,
}: {
  classId: string;
  members: AdminClassMemberRead[];
  onAdded: () => Promise<void>;
}) {
  const [query, setQuery] = useState(""),
    [role, setRole] = useState<"student" | "coach">("student"),
    [page, setPage] = useState(1),
    [rows, setRows] = useState<AdminUserRead[]>([]),
    [total, setTotal] = useState(0),
    [selected, setSelected] = useState<AdminUserRead[]>([]),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [retry, setRetry] = useState(0);
  const inFlight = useRef(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      adminService
        .listUsers({
          keyword: query,
          role,
          status: "active",
          page,
          page_size: 10,
        })
        .then((data) => {
          if (active) {
            setRows(data.items);
            setTotal(data.total);
          }
        })
        .catch((e) => {
          if (active) {
            setRows([]);
            setError(e.message);
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, role, page, retry]);
  async function add() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    const failed: AdminUserRead[] = [];
    const errors: string[] = [];
    for (const person of selected) {
      try {
        await adminService.addClassMember(classId, {
          user_public_id: person.public_id,
          member_role: role,
          status: "active",
        });
      } catch (e) {
        failed.push(person);
        errors.push(
          `${staffName(person)} (${staffContact(person)}): ${e instanceof Error ? e.message : "Could not add member."}`,
        );
      }
    }
    setSelected(failed);
    setMessage(`Added ${selected.length - failed.length} member(s).`);
    setError(errors.join(" "));
    try {
      await onAdded();
    } catch {
      setError(
        (current) =>
          current +
          " Memberships could not refresh. Reload the page to check saved changes.",
      );
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }
  return (
    <section className="min-w-0 rounded-lg border border-white/10 bg-white/[0.055] p-5">
      <h2 className="text-xl font-semibold">Add members by name</h2>
      <p className="mt-2 text-sm text-white/70">
        Search for a name or contact, then select the right person. Contacts
        help distinguish people with the same name.
      </p>
      <fieldset disabled={busy} className="mt-5 space-y-4">
        <label className="block space-y-2 text-sm">
          Member role
          <select
            aria-label="Member role"
            className={field}
            value={role}
            onChange={(e) => {
              setRole(e.target.value as "student" | "coach");
              setSelected([]);
              setPage(1);
            }}
          >
            <option value="student">Student</option>
            <option value="coach">Coach</option>
          </select>
        </label>
        <label className="block space-y-2 text-sm">
          Find by name or contact
          <input
            className={field}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Name, email or phone"
          />
        </label>
        {loading && <p role="status">Searching members…</p>}
        {error && (
          <div role="alert" className="text-sm text-red-200">
            {error}
            <button
              type="button"
              className="ml-2 min-h-11 underline"
              onClick={() => setRetry((v) => v + 1)}
            >
              Retry search
            </button>
          </div>
        )}
        {message && (
          <p role="status" className="text-sm text-[#d8ff5d]">
            {message}
          </p>
        )}
        <ul className="divide-y divide-white/15">
          {!loading &&
            rows.map((person) => {
              const exists = members.some(
                (m) =>
                  m.user_public_id === person.public_id &&
                  m.member_role === role &&
                  m.status === "active",
              );
              return (
                <li key={person.public_id}>
                  <label className="flex min-h-14 items-center gap-3 py-3">
                    <input
                      type="checkbox"
                      disabled={exists}
                      checked={
                        exists ||
                        selected.some((s) => s.public_id === person.public_id)
                      }
                      onChange={(e) =>
                        setSelected((s) =>
                          e.target.checked
                            ? [...s, person]
                            : s.filter((p) => p.public_id !== person.public_id),
                        )
                      }
                    />
                    <span className="min-w-0 break-words">
                      <span className="block font-medium">
                        {staffName(person)}
                      </span>
                      <span className="block text-xs text-white/70">
                        {staffContact(person)}
                        {exists ? " · Already in class" : ""}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
        </ul>
        {!loading && !rows.length && !error && (
          <p className="text-sm text-white/70">
            No matching members. Try another name or contact.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button
            type="button"
            className="min-h-11 underline disabled:opacity-40"
            disabled={loading || page <= 1}
            onClick={() => setPage((v) => v - 1)}
          >
            Previous results
          </button>
          <span>Page {page}</span>
          <button
            type="button"
            className="min-h-11 underline disabled:opacity-40"
            disabled={loading || page * 10 >= total}
            onClick={() => setPage((v) => v + 1)}
          >
            Next results
          </button>
        </div>
        {selected.length > 0 && (
          <p className="text-sm text-white/80">
            Selected:{" "}
            {selected
              .map((s) => `${staffName(s)} (${staffContact(s)})`)
              .join("; ")}
          </p>
        )}
        <button
          type="button"
          onClick={add}
          disabled={!selected.length}
          className="min-h-11 rounded-lg bg-[#d8ff5d] px-5 font-semibold text-black disabled:opacity-50"
        >
          {busy
            ? "Adding members…"
            : `Add selected members (${selected.length})`}
        </button>
      </fieldset>
    </section>
  );
}
