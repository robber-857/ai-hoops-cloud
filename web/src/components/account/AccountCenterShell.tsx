"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WorkspaceMobileMenu } from "@/components/navigation/WorkspaceMobileMenu";
import { accountNavigation, trainingNavigation } from "./accountNavigation";
import { routes } from "@/lib/routes";

export function AccountCenterShell({
  children,
  username,
}: {
  children: React.ReactNode;
  username: string;
}) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-[#090b0f] text-white">
      <a
        href="#account-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-[80] focus:bg-[#d8ff5d] focus:p-3 focus:text-black"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-[60] border-b border-white/10 bg-[#090b0f] pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href={routes.home}
            className="shrink-0 font-[var(--font-display)] text-xl font-bold text-[#d8ff5d]"
          >
            AI HOOPS
          </Link>
          <nav
            aria-label="Training workspaces"
            className="hidden gap-2 lg:flex"
          >
            {trainingNavigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-11 items-center rounded-lg px-4 text-sm text-white/80 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#d8ff5d]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href={routes.user.me}
              aria-label="Open personal center"
              className="flex min-h-11 items-center gap-2 rounded-lg px-2 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#d8ff5d]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d8ff5d]/15 font-semibold text-[#d8ff5d]">
                {username.slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden max-w-36 truncate text-sm sm:block">
                {username}
              </span>
            </Link>
            <WorkspaceMobileMenu
              items={accountNavigation}
              eyebrow="Personal center"
              variant="drawer"
            />
          </div>
        </div>
      </header>
      <nav
        aria-label="Mobile training workspaces"
        className="grid grid-cols-3 border-b border-white/10 px-2 lg:hidden"
      >
        {trainingNavigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-12 items-center justify-center text-sm font-medium text-white/80 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#d8ff5d]"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mx-auto grid max-w-[1440px] items-start lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="sticky top-16 hidden min-h-[calc(100dvh-4rem)] border-r border-white/10 px-4 py-8 lg:flex lg:flex-col">
          <nav
            aria-label="Personal center"
            className="flex flex-1 flex-col gap-1"
          >
            {accountNavigation.map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className={`flex min-h-12 items-center rounded-lg px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-[#d8ff5d] ${index === accountNavigation.length - 1 ? "mt-auto" : ""} ${pathname === item.href ? "bg-[#d8ff5d]/12 text-[#e8ff9a]" : "text-white/75 hover:bg-white/5 hover:text-white"}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main
          id="account-content"
          tabIndex={-1}
          className="flex min-w-0 flex-col gap-6 [overflow-wrap:anywhere] px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
