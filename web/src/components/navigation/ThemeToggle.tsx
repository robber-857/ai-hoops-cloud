"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { themeChangeEvent, themeStorageKey } from "@/lib/workspaceTheme";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

function getTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark");
  window.dispatchEvent(new Event(themeChangeEvent));
}

function subscribe(listener: () => void) {
  function sync(event: StorageEvent) {
    if (event.key === themeStorageKey || event.key === null) {
      applyTheme(event.newValue === "light" ? "light" : "dark");
    }
  }
  window.addEventListener("storage", sync);
  window.addEventListener(themeChangeEvent, listener);
  return () => {
    window.removeEventListener("storage", sync);
    window.removeEventListener(themeChangeEvent, listener);
  };
}

export function ThemeToggle({ className }: { className?: string }) {
  const isLight = useSyncExternalStore(subscribe, getTheme, () => "dark") === "light";
  const label = isLight ? "Switch to dark mode" : "Switch to light mode";

  return (
    <button
      type="button"
      className={cn("ui-icon-button", className)}
      aria-label={label}
      title={label}
      onClick={() => {
        const nextTheme = isLight ? "dark" : "light";
        try {
          localStorage.setItem(themeStorageKey, nextTheme);
        } catch {
          // The toggle still works for this page when browser storage is unavailable.
        }
        applyTheme(nextTheme);
      }}
    >
      {isLight ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
    </button>
  );
}
