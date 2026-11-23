"use client";

import { useInterfaceText } from "@/hooks/useInterfaceText";


import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis, Menu, X } from "lucide-react";
import { LogoutButton } from "@/components/account/LogoutButton";
import type { WorkspaceMobileNavItem } from "./WorkspaceMobileMenu";

export function WorkspaceMobileDrawer({
  items = [],
  title,
  sections,
}: {
  items?: WorkspaceMobileNavItem[];
  title: string;
  sections?: { label: string; items: WorkspaceMobileNavItem[] }[];
}) {
  const t = useInterfaceText();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const id = useId();
  const isCurrent = (item: WorkspaceMobileNavItem) =>
    pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`));
  const sectionIsCurrent = sections?.some(section => section.items.some(isCurrent));
  const close = () => {
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const query = window.matchMedia("(min-width: 1024px)");
    const resize = () => {
      if (query.matches) dialog.current?.close();
    };
    query.addEventListener("change", resize);
    return () => {
      document.body.style.overflow = previousOverflow;
      query.removeEventListener("change", resize);
    };
  }, [open]);

  const navLink = (item: WorkspaceMobileNavItem) => {
    const Icon = item.icon;
    return <Link key={item.href} href={item.href} onClick={close}
      aria-current={isCurrent(item) ? "page" : undefined} className="account-nav-item">
      {Icon && <Icon size={17} aria-hidden="true" />}
      {t(item.label)}
    </Link>;
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={sections ? t(title) : t("Open workspace menu")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-current={sectionIsCurrent ? "true" : undefined}
        data-active={sectionIsCurrent || undefined}
        aria-controls={id}
        onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
        }}
        className={sections ? "account-bottom-tab" : "ui-icon-button workspace-drawer-trigger"}
      >
        {sections ? <><span className="account-tab-icon"><Ellipsis size={21} aria-hidden="true" /></span><span>{t(title)}</span></> : <Menu size={20} />}
      </button>
      <dialog
        ref={dialog}
        id={id}
        aria-labelledby={`${id}-title`}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              "a[href], button:not([disabled])",
            ),
          );
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onClose={() => {
          setOpen(false);
          trigger.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        className="workspace-mobile-dialog fixed inset-0 m-0 h-[100dvh] max-h-none w-full max-w-none border-0 bg-transparent p-0 text-[var(--ui-text)]"
      >
        <div className={sections ? "account-menu-sheet" : "ml-auto flex h-full w-[min(88vw,380px)] flex-col overflow-y-auto border-l border-[var(--ui-border)] bg-[var(--ui-sidebar)] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] motion-safe:animate-[drawer-enter_180ms_ease-out]"}>
          <div className={sections ? "account-menu-header" : "mb-5 flex items-center justify-between gap-3"}>
            <h2 id={`${id}-title`} className="text-lg font-semibold">
              {t(title)}
            </h2>
            <button
              type="button"
              aria-label={t("Close workspace menu")}
              onClick={close}
              className="ui-icon-button"
            >
              <X size={20} />
            </button>
          </div>
          <div className={sections ? "account-menu-body" : "contents"}>
          <nav
            aria-label={t("Workspace navigation")}
            className={sections ? "account-menu-sections" : "flex flex-1 flex-col gap-1"}
          >
            {sections ? sections.map(section => (
              <section key={section.label}>
                <h3>{t(section.label)}</h3>
                <div className="account-menu-links">{section.items.map(navLink)}</div>
              </section>
            )) : items.map(navLink)}
          </nav>
          <div className="mt-5 border-t border-[var(--ui-border)] pt-4">
            <Link
              href="/"
              onClick={close}
              className="account-nav-item"
            >
              {t("AI Hoops home")}
            </Link>
            <LogoutButton className="mt-3 min-h-11 w-full" />
          </div>
          </div>
        </div>
        <style>{`@keyframes drawer-enter { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
      </dialog>
    </>
  );
}
