"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, ChevronRight, Menu, X } from "lucide-react";

import { getDefaultPathForRole } from "@/lib/authRedirect";
import { routes } from "@/lib/routes";
import { useAuthStore } from "@/store/authStore";

const navigationItems = [
  { href: "#analysis", label: "How it works" },
  { href: "#modes", label: "Analysis" },
  { href: "#report", label: "Report" },
  { href: "#beta", label: "Private beta" },
] as const;

export function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accountHref =
    isAuthenticated && user
      ? getDefaultPathForRole(user.role)
      : routes.auth.login;
  const accountLabel = isAuthenticated && user ? "Open workspace" : "Log in";

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = [
        closeButtonRef.current,
        ...(menuPanelRef.current?.querySelectorAll<HTMLElement>(
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
    const desktopQuery = window.matchMedia("(min-width: 901px)");
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsOpen(false);
      }
    };

    desktopQuery.addEventListener("change", closeAtDesktop);
    return () => desktopQuery.removeEventListener("change", closeAtDesktop);
  }, []);

  const closeMenu = () => {
    setIsOpen(false);
    window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  };

  return (
    <>
      <header className={`nav${isOpen ? " nav-is-open" : ""}`}>
        <a
          className="brand"
          href="#top"
          aria-label="Apex Sport AI home"
          onClick={isOpen ? closeMenu : undefined}
        >
          APEX <span>SPORT AI</span>
          <small>SYDNEY</small>
        </a>

        <nav className="desktop-nav" aria-label="Primary navigation">
          {navigationItems.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <a className="nav-cta desktop-nav-cta" href={accountHref}>
          {accountLabel}
        </a>

        <button
          ref={isOpen ? closeButtonRef : menuButtonRef}
          type="button"
          className="mobile-menu-trigger"
          aria-controls={menuId}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
          title={isOpen ? "Close menu" : "Open menu"}
          onClick={() => {
            if (isOpen) {
              closeMenu();
            } else {
              setIsOpen(true);
            }
          }}
        >
          {isOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </header>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            id={menuId}
            className="mobile-menu-layer"
            role="dialog"
            aria-modal="true"
            aria-label="Primary navigation"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
          >
            <motion.div
              ref={menuPanelRef}
              className="mobile-menu-content"
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
              transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="mobile-menu-kicker">Explore Apex</p>

              <nav className="mobile-nav-list" aria-label="Mobile navigation">
                {navigationItems.map((item, index) => (
                  <motion.a
                    key={item.href}
                    href={item.href}
                    onClick={closeMenu}
                    initial={reduceMotion ? false : { opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: reduceMotion ? 0 : 0.06 + index * 0.035,
                      duration: reduceMotion ? 0 : 0.24,
                    }}
                  >
                    <span className="mobile-nav-index" aria-hidden="true">
                      0{index + 1}
                    </span>
                    <span>{item.label}</span>
                    <ChevronRight aria-hidden="true" />
                  </motion.a>
                ))}
              </nav>

              <a className="mobile-login-cta" href={accountHref} onClick={closeMenu}>
                {accountLabel}
                <ArrowUpRight aria-hidden="true" />
              </a>

              <div className="mobile-menu-footer" aria-hidden="true">
                <span>AI basketball performance lab</span>
                <span>Sydney</span>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
