"use client";

import Link from "next/link";
import { CircleUserRound } from "lucide-react";

import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";

type AccountEntryButtonProps = {
  className?: string;
  compact?: boolean;
};

function getInitial(username?: string | null, nickname?: string | null): string {
  const source = nickname?.trim() || username?.trim();
  if (!source) {
    return "";
  }

  return source.slice(0, 1).toUpperCase();
}

function getAccountEntry(userRole?: string | null) {
  if (userRole === "admin") {
    return { href: routes.admin.home, label: "Admin" };
  }
  if (userRole === "coach") {
    return { href: routes.coach.home, label: "Coach" };
  }
  return { href: routes.user.me, label: "Profile" };
}

export function AccountEntryButton({
  className,
  compact = false,
}: AccountEntryButtonProps) {
  const user = useAuthStore((state) => state.user);
  const initial = getInitial(user?.username, user?.nickname);
  const entry = getAccountEntry(user?.role);

  return (
    <Link
      href={entry.href}
      aria-label={`Open ${entry.label}`}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-white/72 transition-all duration-200 hover:border-[#d8ff5d]/35 hover:bg-[#d8ff5d]/10 hover:text-white",
        compact ? "sm:px-3" : "sm:px-4",
        className
      )}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#d8ff5d]/25 bg-[#d8ff5d]/12 text-[0.72rem] font-semibold text-[#d8ff5d]">
        {initial || <CircleUserRound className="h-4 w-4" />}
      </span>
      <span className={cn(compact ? "hidden lg:inline" : "hidden sm:inline")}>{entry.label}</span>
    </Link>
  );
}
