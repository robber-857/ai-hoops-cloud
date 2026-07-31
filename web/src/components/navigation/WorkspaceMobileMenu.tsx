"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronRight, Menu, X } from "lucide-react";

import { LogoutButton } from "@/components/account/LogoutButton";
import { useAuthStore } from "@/store/authStore";

export type WorkspaceMobileNavItem = {
  href: string;
  label: string;
  exact?: boolean;
};

type WorkspaceMobileMenuProps = {
  items: WorkspaceMobileNavItem[];
  eyebrow: string;
  accent?: "lime" | "cyan";
};

const accentStyles = {
  lime: {
    trigger:
      "hover:border-[#d8ff5d]/55 hover:bg-[#d8ff5d]/10 hover:text-[#d8ff5d] focus-visible:outline-[#d8ff5d]",
    eyebrow: "text-[#d8ff5d]/78",
    active: "bg-[#d8ff5d]/8 text-[#e8ff9a]",
    activeIndex: "text-[#d8ff5d]",
    activeIcon: "text-[#d8ff5d]",
    identity: "border-[#d8ff5d]/20 bg-[#d8ff5d]/8 text-[#d8ff5d]",
  },
  cyan: {
    trigger:
      "hover:border-[#65f7ff]/55 hover:bg-[#65f7ff]/10 hover:text-[#65f7ff] focus-visible:outline-[#65f7ff]",
    eyebrow: "text-[#65f7ff]/78",
    active: "bg-[#65f7ff]/8 text-[#bafcff]",
    activeIndex: "text-[#65f7ff]",
    activeIcon: "text-[#65f7ff]",
    identity: "border-[#65f7ff]/20 bg-[#65f7ff]/8 text-[#65f7ff]",
  },
} as const;

function isActivePath(pathname: string, item: WorkspaceMobileNavItem) {
  return pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`));
}

export function WorkspaceMobileMenu({
  items,
  eyebrow,
  accent = "lime",
}: WorkspaceMobileMenuProps) {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const reduceMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const styles = accentStyles[accent];
  const username = user?.nickname?.trim() || user?.username || "Account";
  const role = user?.role || "member";

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  const closeMenu = () => {
    setIsOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    triggerRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = [
        triggerRef.current,
        ...(panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? []),
      ].filter((element): element is HTMLElement => Boolean(element));

      if (focusableElements.length === 0) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsOpen(false);
      }
    };

    desktopQuery.addEventListener("change", closeAtDesktop);
    return () => desktopQuery.removeEventListener("change", closeAtDesktop);
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.045] text-white/78 outline-none transition lg:hidden ${styles.trigger}`}
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close workspace menu" : "Open workspace menu"}
        title={isOpen ? "Close menu" : "Open menu"}
        onClick={() => setIsOpen((current) => !current)}
      >
        {isOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
      </button>

      {portalRoot
        ? createPortal(
            <AnimatePresence>
              {isOpen ? (
                <motion.div
            id={menuId}
            className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-[#05070c] px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[calc(5.75rem+env(safe-area-inset-top))] text-white lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label={`${eyebrow} navigation`}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:48px_48px] opacity-70" />

            <motion.div
              ref={panelRef}
              className="relative mx-auto flex min-h-[calc(100svh-7rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] w-full max-w-xl flex-col"
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
              transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className={`mb-4 text-[0.68rem] font-bold uppercase ${styles.eyebrow}`}>
                {eyebrow}
              </p>

              <nav className="border-y border-white/12" aria-label="Workspace navigation">
                {items.map((item, index) => {
                  const isActive = isActivePath(pathname, item);

                  return (
                    <motion.div
                      key={item.href}
                      initial={reduceMotion ? false : { opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: reduceMotion ? 0 : 0.05 + index * 0.025,
                        duration: reduceMotion ? 0 : 0.22,
                      }}
                    >
                      <Link
                        href={item.href}
                        onClick={closeMenu}
                        aria-current={isActive ? "page" : undefined}
                        className={`grid min-h-16 min-w-0 grid-cols-[2rem_minmax(0,1fr)_1.5rem] items-center gap-3 border-b border-white/10 px-1 text-white/82 outline-none transition last:border-b-0 hover:bg-white/[0.045] hover:text-white focus-visible:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/55 ${
                          isActive ? styles.active : ""
                        }`}
                      >
                        <span
                          className={`text-[0.65rem] font-bold ${
                            isActive ? styles.activeIndex : "text-white/32"
                          }`}
                          aria-hidden="true"
                        >
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 break-words font-[var(--font-display)] text-xl font-bold uppercase leading-tight">
                          {item.label}
                        </span>
                        <ChevronRight
                          className={`h-5 w-5 justify-self-end ${
                            isActive ? styles.activeIcon : "text-white/36"
                          }`}
                          aria-hidden="true"
                        />
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>

              <div className="mt-auto pt-7">
                <div className="flex min-w-0 items-center gap-3 border-t border-white/12 pt-5">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-sm font-bold ${styles.identity}`}
                  >
                    {username.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">
                      {username}
                    </span>
                    <span className="mt-0.5 block text-[0.65rem] uppercase text-white/42">
                      {role}
                    </span>
                  </span>
                </div>

                <LogoutButton
                  label="Log out"
                  className="mt-4 min-h-12 w-full justify-between rounded-lg border-red-300/20 bg-red-400/10 px-4 text-sm"
                />
              </div>
            </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            portalRoot,
          )
        : null}
    </>
  );
}
