"use client";

import { useEffect, useRef, type InputHTMLAttributes } from "react";
import { formatDateInput, parseDateInput, validateDateInput } from "@/lib/dateInput";

type ProfileDateInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "onChange" | "min" | "max" | "pattern" | "placeholder"
> & {
  value: string;
  onChange: (value: string) => void;
  minDate?: string | null;
  maxDate?: string | null;
};

export function ProfileDateInput({
  value,
  onChange,
  required = false,
  minDate,
  maxDate,
  ...props
}: ProfileDateInputProps) {
  const input = useRef<HTMLInputElement>(null);
  const { error } = validateDateInput(value, { required, minDate, maxDate });

  useEffect(() => {
    input.current?.setCustomValidity(error ?? "");
  }, [error]);

  return (
    <input
      {...props}
      ref={input}
      type="text"
      required={required}
      placeholder="yyyy/mm/dd"
      aria-invalid={error ? true : undefined}
      value={formatDateInput(value)}
      onChange={(event) => {
        const raw = event.currentTarget.value;
        event.currentTarget.setCustomValidity(
          validateDateInput(raw, { required, minDate, maxDate }).error ?? "",
        );
        // Always pass the edit through. Invalid/partial input must replace an old date.
        onChange(parseDateInput(raw) ?? raw);
      }}
    />
  );
}
