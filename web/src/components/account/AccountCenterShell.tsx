import Link from "next/link";
import { BarChart3, CircleUserRound, Dumbbell, Sparkles } from "lucide-react";

import { WorkspaceMobileMenu } from "@/components/navigation/WorkspaceMobileMenu";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

type AccountCenterShellProps = {
  children: React.ReactNode;
  username: string;
};

const navItems = [
  {
    href: routes.pose2d.shooting,
    label: "Shooting",
    icon: Dumbbell,
  },
  {
    href: routes.pose2d.dribbling,
    label: "Dribbling",
    icon: BarChart3,
  },
  {
    href: routes.pose2d.training,
    label: "Training",
    icon: Sparkles,
  },
  {
    href: routes.user.me,
    label: "Profile",
    icon: CircleUserRound,
    active: true,
  },
];

const mobileNavItems = navItems.map((item) => ({
  href: item.href,
  label: item.label,
  exact: item.href === routes.user.me,
}));

export function AccountCenterShell({
  children,
  username,
}: AccountCenterShellProps) {
  return (
    <main className="relative min-h-screen overflow-x-clip bg-[#090b0f] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(216,255,93,0.06),transparent_24%),radial-gradient(circle_at_18%_22%,rgba(216,255,93,0.05),transparent_18%),linear-gradient(180deg,#06080b_0%,#0b0f14_42%,#090b0f_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] opacity-20" />
      <div className="pointer-events-none absolute left-[-8rem] top-24 h-72 w-72 rounded-full bg-[#d8ff5d]/10 blur-3xl" />
      <div className="pointer-events-none absolute right-[-6rem] top-60 h-80 w-80 rounded-full bg-emerald-400/8 blur-3xl" />

      <header className="sticky top-0 z-[60] border-b border-white/8 bg-[#05070bcc]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-3 sm:gap-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <div className="truncate font-[var(--font-display)] text-[0.68rem] uppercase tracking-[0.24em] text-[#d8ff5d]/72 sm:text-[0.72rem] sm:tracking-[0.32em]">
              AI Hoops
            </div>
            <div className="truncate text-sm font-semibold text-white/86 sm:text-base">
              Personal Center
            </div>
          </div>

          <nav className="hidden items-center gap-2 lg:flex">
            {navItems.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200",
                    item.active
                      ? "border-[#d8ff5d]/35 bg-[#d8ff5d]/12 text-[#e8ff9a]"
                      : "border-white/10 bg-white/[0.03] text-white/68 hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex min-w-0 shrink-0 items-center gap-2">
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 sm:gap-3 sm:px-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d8ff5d]/25 bg-[#d8ff5d]/12 text-sm font-semibold text-[#d8ff5d]">
                {username.slice(0, 1).toUpperCase()}
              </span>
              <div className="hidden min-w-0 sm:block">
                <div className="max-w-36 truncate text-sm font-medium text-white">{username}</div>
              </div>
            </div>
            <WorkspaceMobileMenu
              items={mobileNavItems}
              eyebrow="Athlete workspace"
              accent="lime"
            />
          </div>
        </div>
      </header>

      <div className="relative mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-5 px-3 py-5 sm:gap-6 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        {children}
      </div>
    </main>
  );
}
