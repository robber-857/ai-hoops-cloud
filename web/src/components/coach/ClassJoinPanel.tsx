"use client";

import { useEffect, useState } from "react";
import { Copy, Link2, UserRoundCheck } from "lucide-react";

import { classInviteUrl } from "@/lib/classInvite";
import { classCollaboration, type ClassInvitationStatus, type ClassJoinRequest } from "@/services/classCollaboration";

const buttonClass = "min-h-10 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)] px-3 py-2 text-sm font-semibold text-[var(--ui-text)] hover:bg-[var(--ui-subtle)] disabled:opacity-55";
const formatDate = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Australia/Sydney" });

export function ClassJoinPanel({ classId, canInvite, onApproved }: {
  classId: string;
  canInvite: boolean;
  onApproved: () => Promise<void>;
}) {
  const [invitation, setInvitation] = useState<ClassInvitationStatus>();
  const [requests, setRequests] = useState<ClassJoinRequest[]>([]);
  const [shareUrl, setShareUrl] = useState("");
  const [pending, setPending] = useState("initial");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([classCollaboration.getInvitation(classId), classCollaboration.listJoinRequests(classId)])
      .then(([link, items]) => {
        if (!active) return;
        setInvitation(link);
        setRequests(items);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load class invitations.");
      })
      .finally(() => { if (active) setPending(""); });
    return () => { active = false; };
  }, [classId, refresh]);

  async function changeInvite(action: "issue" | "revoke") {
    setPending(action);
    setNotice("");
    setError("");
    try {
      if (action === "issue") {
        const issued = await classCollaboration.issueInvitation(classId);
        setShareUrl(new URL(classInviteUrl(issued.token), window.location.origin).href);
        setInvitation({ active: true, expires_at: issued.expires_at });
      } else {
        await classCollaboration.revokeInvitation(classId);
        setShareUrl("");
        setInvitation({ active: false, expires_at: null });
        setNotice("Invitation link revoked.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update the invitation link.");
    } finally {
      setPending("");
    }
  }

  async function review(requestId: string, decision: "approved" | "declined") {
    setPending(requestId);
    setNotice("");
    setError("");
    try {
      const updated = await classCollaboration.review(classId, requestId, decision);
      setRequests((current) => current.map((item) => item.public_id === requestId ? updated : item));
      setNotice(`${updated.student_name}’s request was ${decision}.`);
      if (decision === "approved") await onApproved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update the class request.");
    } finally {
      setPending("");
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setNotice("Invitation link copied.");
    } catch {
      setNotice("Select the invitation link and copy it manually.");
    }
  }

  const waiting = requests.filter((item) => item.status === "pending");

  return (
    <section className="mb-6 space-y-4 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4 text-[var(--ui-text)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold"><Link2 className="size-4" /> Class invitations</h3>
          <p className="mt-1 text-sm text-[var(--ui-muted)]">Share a link with families. Each student applies and waits for your approval.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canInvite && invitation && (
            <button type="button" className={buttonClass} onClick={() => void changeInvite("issue")} disabled={!!pending}>
              {invitation.active ? "Replace link" : "Generate link"}
            </button>
          )}
          {invitation?.active && <button type="button" className={buttonClass} onClick={() => void changeInvite("revoke")} disabled={!!pending}>Revoke link</button>}
        </div>
      </div>
      {invitation?.active && invitation.expires_at ? (
        <p className="text-sm text-[var(--ui-muted)]">Expires {formatDate.format(new Date(invitation.expires_at))} Sydney time. Replacing the link deactivates the previous one.</p>
      ) : null}
      {shareUrl && (
        <div className="flex flex-wrap gap-2">
          <input aria-label="Shareable invitation link" readOnly value={shareUrl}
            className="min-h-10 min-w-0 flex-1 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-bg)] px-3 text-sm" onFocus={(event) => event.currentTarget.select()} />
          <button type="button" className={`inline-flex items-center gap-2 ${buttonClass}`} onClick={() => void copyLink()}><Copy className="size-4" /> Copy link</button>
        </div>
      )}
      {notice && <p role="status" className="text-sm">{notice}</p>}
      {error && <p role="alert" className="text-sm text-[var(--ui-danger)]">{error}</p>}
      <div className="border-t border-[var(--ui-border)] pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold"><UserRoundCheck className="size-4" /> Join requests {waiting.length > 0 && `(${waiting.length} pending)`}</h4>
          <button type="button" className={buttonClass} disabled={!!pending}
            onClick={() => { setError(""); setPending("initial"); setRefresh((count) => count + 1); }}>Refresh requests</button>
        </div>
        {pending === "initial" && <p role="status" className="mt-2 text-sm text-[var(--ui-muted)]">Loading requests…</p>}
        {pending !== "initial" && !error && !requests.length && <p className="mt-2 text-sm text-[var(--ui-muted)]">No requests yet.</p>}
        {requests.length > 0 && (
          <ul className="mt-2 divide-y divide-[var(--ui-border)]">
            {requests.map((item) => (
              <li key={item.public_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold">{item.student_name}</p>
                  <p className="text-xs text-[var(--ui-muted)]">{formatDate.format(new Date(item.requested_at))}</p>
                </div>
                {item.status === "pending" ? (
                  <div className="flex gap-2">
                    <button type="button" className={buttonClass} disabled={!!pending || !canInvite} onClick={() => void review(item.public_id, "approved")}>Approve</button>
                    <button type="button" className={buttonClass} disabled={!!pending} onClick={() => void review(item.public_id, "declined")}>Decline</button>
                  </div>
                ) : <span className="rounded-full bg-[var(--ui-subtle)] px-3 py-1 text-xs capitalize text-[var(--ui-muted)]">{item.status}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
