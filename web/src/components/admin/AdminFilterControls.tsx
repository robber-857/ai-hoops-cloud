"use client";

import { cn } from "@/lib/utils";

export const adminFilterFormClass =
  "mt-5 grid w-full min-w-0 gap-3 rounded-lg border border-white/10 bg-black/18 p-3 sm:grid-cols-2 lg:grid-cols-3";

export const adminFilterButtonClass =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/24 bg-[#65f7ff]/10 px-4 text-sm font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/16 focus:outline-none focus:ring-2 focus:ring-[#65f7ff]/22";

type AdminFilterFieldProps = {
  children: React.ReactNode;
  className?: string;
  label: string;
};

export function AdminFilterField({ children, className, label }: AdminFilterFieldProps) {
  return (
    <label className={cn("min-w-0 space-y-1.5", className)}>
      <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/46">
        {label}
      </span>
      {children}
    </label>
  );
}

export function AdminFilterAction({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("flex min-w-0 items-end", className)}>{children}</div>;
}
