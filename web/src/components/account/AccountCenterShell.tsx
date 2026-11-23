"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronRight, CircleDot, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { WorkspaceMobileMenu } from "@/components/navigation/WorkspaceMobileMenu";
import { ThemeToggle } from "@/components/navigation/ThemeToggle";
import { LogoutButton } from "./LogoutButton";
import {
  accountNavigation,
  accountNavigationSections,
  profileNavigation,
  trainingNavigation,
} from "./accountNavigation";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

type AccountNavItem = (typeof accountNavigation)[number];

function matches(pathname: string, item: AccountNavItem) {
  return pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`));
}

function AccountNavLink({
  item,
  pathname,
  collapsed,
}: {
  item: AccountNavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      aria-current={matches(pathname, item) ? "page" : undefined}
      className={cn("account-nav-item", collapsed && "justify-center")}
    >
      <Icon size={17} aria-hidden="true" className="shrink-0" />
      {!collapsed && item.label}
    </Link>
  );
}

export function AccountCenterShell({
  children,
  username,
}: {
  children: React.ReactNode;
  username: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const pageLabel = accountNavigation.find((item) => matches(pathname, item))?.label;
  const avatar = (
    <span
      aria-hidden="true"
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--ui-accent-soft)] text-sm font-bold text-[var(--ui-accent)]"
    >
      {username.slice(0, 1).toUpperCase()}
    </span>
  );

  return (
    <div
      className={cn(
        "theme-workspace min-h-screen bg-[var(--ui-bg)] text-[var(--ui-text)] lg:grid",
        collapsed ? "lg:grid-cols-[4.75rem_minmax(0,1fr)]" : "lg:grid-cols-[14.25rem_minmax(0,1fr)]",
      )}
    >
      <a
        href="#account-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-[80] focus:bg-[var(--ui-action)] focus:p-3 focus:text-[var(--ui-action-text)]"
      >
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-[var(--ui-border)] bg-[var(--ui-sidebar)] px-3 pb-4 pt-3 lg:flex">
        <div className={cn("flex min-h-12 items-center justify-between gap-1 px-1", collapsed && "flex-col pb-2")}>
          <Link href={routes.home} aria-label="AI Hoops home" className="flex items-center gap-2.5 rounded-md">
            <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--ui-action)] text-[var(--ui-action-text)]">
              <CircleDot size={19} aria-hidden="true" />
            </span>
            {!collapsed && <span className="text-base font-extrabold tracking-tight">AI Hoops</span>}
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-expanded={!collapsed}
            aria-controls="student-sidebar"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-[var(--ui-muted)] hover:bg-[var(--ui-subtle)]"
          >
            {collapsed ? <PanelLeftOpen size={17} aria-hidden="true" /> : <PanelLeftClose size={17} aria-hidden="true" />}
          </button>
        </div>
        <nav
          id="student-sidebar"
          aria-label="Personal center"
          className="mt-3 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-1"
        >
          {accountNavigationSections.map((section) => (
            <div key={section.label} className="space-y-0.5">
              {!collapsed && (
                <div className="mb-1 px-2 text-xs font-semibold text-[var(--ui-muted)]">{section.label}</div>
              )}
              {section.items.map((item) => (
                <AccountNavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
              ))}
            </div>
          ))}
        </nav>
        <div className="mt-3 border-t border-[var(--ui-border)] pt-3">
          <AccountNavLink item={profileNavigation} pathname={pathname} collapsed={collapsed} />
          <LogoutButton
            label={collapsed ? "" : "Log out"}
            className={cn("mt-1 w-full justify-start rounded-lg border-0 bg-transparent px-2.5 text-[var(--ui-muted)] shadow-none hover:bg-[var(--ui-subtle)]", collapsed && "justify-center")}
          />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-[var(--ui-border)] bg-[var(--ui-surface)] pt-[env(safe-area-inset-top)]">
          <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-2 px-4 sm:px-6 lg:px-8">
            <Link href={routes.home} className="flex min-h-11 shrink-0 items-center gap-2 text-base font-extrabold tracking-tight lg:hidden">
              <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--ui-action)] text-[var(--ui-action-text)]">
                <CircleDot size={19} aria-hidden="true" />
              </span>
              AI Hoops
            </Link>
            <div className="hidden min-w-0 items-center gap-2 text-sm text-[var(--ui-muted)] lg:flex">
              <span>Player hub</span>
              {pageLabel && <>
                <ChevronRight size={14} aria-hidden="true" />
                <span className="truncate font-semibold text-[var(--ui-text)]">{pageLabel}</span>
              </>}
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <ThemeToggle />
              <Link
                href={routes.user.profile}
                aria-label="Open personal profile"
                className="flex min-h-11 items-center gap-2 rounded-lg p-1.5 hover:bg-[var(--ui-subtle)]"
              >
                {avatar}
                <span className="hidden max-w-32 truncate text-sm font-semibold sm:block">{username}</span>
              </Link>
              <WorkspaceMobileMenu items={accountNavigation} eyebrow="Player hub" variant="drawer" />
            </div>
          </div>
        </header>
        <nav aria-label="Training workspaces" className="border-b border-[var(--ui-border)] bg-[var(--ui-surface)]">
          <div className="mx-auto grid max-w-[1440px] grid-cols-3 items-center gap-1 px-3 sm:flex sm:gap-2 sm:px-6 lg:px-8">
            <span className="mr-1 hidden text-xs font-semibold text-[var(--ui-muted)] lg:block">Video analysis</span>
            {trainingNavigation.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="account-nav-item justify-center sm:px-3">
                <Icon size={15} aria-hidden="true" className="hidden sm:block" /> {label}
              </Link>
            ))}
          </div>
        </nav>
        <main
          id="account-content"
          tabIndex={-1}
          className="mx-auto flex max-w-[1440px] min-w-0 flex-col gap-6 px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))] [overflow-wrap:anywhere] sm:px-6 lg:px-8 lg:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
