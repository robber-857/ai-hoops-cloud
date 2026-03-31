import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  rightSlot?: ReactNode;
}

export function AuthField({ label, hint, rightSlot, className, ...props }: FieldProps) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-white/88">{label}</span>
        {hint ? <span className="text-xs text-white/45">{hint}</span> : null}
      </div>
      <div className="flex items-center gap-3 rounded-[1.4rem] border border-white/12 bg-black/14 px-4 py-3 transition focus-within:border-[#ff8f4d] focus-within:bg-black/22">
        <input
          className={cn(
            "w-full border-none bg-transparent text-[15px] text-white outline-none placeholder:text-white/28",
            className,
          )}
          {...props}
        />
        {rightSlot}
      </div>
    </label>
  );
}

export function AuthSegmentTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 rounded-full border border-white/10 bg-white/5 p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full px-4 py-2.5 text-sm font-medium transition",
              active
                ? "bg-[#ff8f4d] text-[#081423] shadow-[0_12px_30px_rgba(255,143,77,0.28)]"
                : "text-white/58 hover:bg-white/8 hover:text-white",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
