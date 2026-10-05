"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { LogoutButton } from "@/components/account/LogoutButton";
import type { WorkspaceMobileNavItem } from "./WorkspaceMobileMenu";

export function WorkspaceMobileDrawer({
  items,
  title,
}: {
  items: WorkspaceMobileNavItem[];
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const id = useId();
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

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label="Open workspace menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
        }}
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/20 text-white lg:hidden"
      >
        <Menu size={20} />
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
        className="fixed inset-0 m-0 h-[100dvh] max-h-none w-full max-w-none border-0 bg-transparent p-0 text-white backdrop:bg-black/65"
      >
        <div className="ml-auto flex h-full w-[min(88vw,380px)] flex-col overflow-y-auto border-l border-white/15 bg-[#10141b] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] motion-safe:animate-[drawer-enter_180ms_ease-out]">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 id={`${id}-title`} className="text-lg font-semibold">
              {title}
            </h2>
            <button
              type="button"
              aria-label="Close workspace menu"
              onClick={close}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/20"
            >
              <X size={20} />
            </button>
          </div>
          <nav
            aria-label="Personal center mobile"
            className="flex flex-1 flex-col gap-1"
          >
            {items.map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                aria-current={pathname === item.href ? "page" : undefined}
                className={`flex min-h-12 items-center rounded-lg px-3 text-sm font-medium ${index === items.length - 1 ? "mt-auto" : ""} ${pathname === item.href ? "bg-[#d8ff5d]/12 text-[#e8ff9a]" : "text-white/80 hover:bg-white/5"}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-5 border-t border-white/15 pt-4">
            <Link
              href="/"
              onClick={close}
              className="flex min-h-11 items-center px-3 text-sm text-white/75"
            >
              AI Hoops home
            </Link>
            <LogoutButton className="mt-3 min-h-11 w-full" />
          </div>
        </div>
        <style>{`@keyframes drawer-enter { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
      </dialog>
    </>
  );
}
