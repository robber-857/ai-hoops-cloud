"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  BookOpenCheck,
  Boxes,
  ChevronRight,
  LayoutDashboard,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import { LogoutButton } from "@/components/account/LogoutButton";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/types/auth";

type AdminShellProps = {
  children: React.ReactNode;
  user: AuthUser;
  title: string;
  breadcrumb: string[];
};

const navItems = [
  { href: routes.admin.home, label: "Overview", icon: LayoutDashboard },
  { href: routes.admin.camps, label: "Camps", icon: Boxes },
  { href: routes.admin.classes, label: "Classes", icon: UsersRound },
  { href: routes.admin.templates, label: "Templates", icon: BookOpenCheck },
];

export function AdminLoadingSurface() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#05070c] text-white">
      <div className="rounded-lg border border-white/10 bg-white/[0.055] px-8 py-7 text-center shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#65f7ff]/60 border-t-transparent" />
        <div className="mt-4 text-[0.72rem] uppercase tracking-[0.28em] text-white/48">
          Loading admin console
        </div>
      </div>
    </main>
  );
}

export function AdminForbiddenSurface({ user }: { user: AuthUser }) {
  return (
    <AdminShell user={user} title="Admin access required" breadcrumb={["Access"]}>
      <section className="rounded-lg border border-red-400/20 bg-red-500/10 p-8 text-center backdrop-blur-2xl">
        <AlertTriangle className="mx-auto h-10 w-10 text-red-200" />
        <h2 className="mt-5 font-[var(--font-display)] text-2xl font-bold text-white">
          This workspace is available to administrators only.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/58">
          Current role: {user.role}. Use an admin account to maintain camps, classes, members, and
          templates.
        </p>
      </section>
    </AdminShell>
  );
}

export function AdminShell({ children, user, title, breadcrumb }: AdminShellProps) {
  const pathname = usePathname();
  const username = user.nickname?.trim() || user.username;

  return (
    <main className="min-h-screen bg-[#05070c] text-white">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(101,247,255,0.12),transparent_28%),radial-gradient(circle_at_88%_16%,rgba(216,255,93,0.08),transparent_24%),linear-gradient(135deg,#05070c_0%,#08111d_48%,#05070c_100%)]" />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[16rem] border-r border-white/10 bg-[#07111d]/68 px-4 py-5 shadow-[18px_0_60px_rgba(0,0,0,0.24)] backdrop-blur-2xl lg:block">
        <Link href={routes.admin.home} className="flex items-center gap-3 px-2">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#65f7ff]/28 bg-[#65f7ff]/12 text-[#65f7ff]">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-[var(--font-display)] text-lg font-bold text-white">
              AI Hoops
            </span>
            <span className="block text-[0.68rem] uppercase tracking-[0.24em] text-[#65f7ff]/70">
              Admin Ops
            </span>
          </span>
        </Link>

        <nav className="mt-10 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href || (item.href !== routes.admin.home && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition",
                  isActive
                    ? "border border-[#65f7ff]/22 bg-[#65f7ff]/10 text-white"
                    : "text-white/55 hover:bg-white/[0.05] hover:text-white",
                )}
              >
                <Icon className="h-4 w-4 text-[#65f7ff]" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute inset-x-4 bottom-5 rounded-lg border border-white/10 bg-white/[0.045] p-4">
          <div className="text-sm font-semibold text-white">{username}</div>
          <div className="mt-1 text-[0.68rem] uppercase tracking-[0.2em] text-white/45">
            {user.role}
          </div>
        </div>
      </aside>

      <section className="relative z-10 lg:pl-[16rem]">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[#05070c]/70 backdrop-blur-2xl">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1 text-[0.68rem] uppercase tracking-[0.18em] text-white/46">
                <span>Admin</span>
                {breadcrumb.map((item) => (
                  <span key={item} className="flex items-center gap-1">
                    <ChevronRight className="h-3 w-3 text-[#65f7ff]/60" />
                    <span>{item}</span>
                  </span>
                ))}
              </div>
              <h1 className="mt-1 truncate font-[var(--font-display)] text-lg font-bold tracking-[0.02em] text-white sm:text-xl">
                {title}
              </h1>
            </div>
            <LogoutButton
              label="Log out"
              className="min-h-10 rounded-lg border-white/10 bg-white/[0.045] px-3 text-xs text-white/72 hover:bg-white/[0.08]"
            />
          </div>
        </header>

        <div className="relative mx-auto flex w-full max-w-[1460px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </section>
    </main>
  );
}
