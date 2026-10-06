"use client";

import { useEffect, useLayoutEffect, useRef, type InputHTMLAttributes } from "react";
import { formatDateInput, maskDateInput, parseDateInput, validateDateInput } from "@/lib/dateInput";

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
  const caret = useRef<number | null>(null);
  const { error } = validateDateInput(value, { required, minDate, maxDate });

  useEffect(() => {
    input.current?.setCustomValidity(error ?? "");
  }, [error]);

  useLayoutEffect(() => {
    if (caret.current !== null) {
      input.current?.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  });

  return (
    <input
      {...props}
      ref={input}
      type="text"
      inputMode="numeric"
      required={required}
      placeholder="yyyy/mm/dd"
      aria-invalid={error ? true : undefined}
      value={formatDateInput(value)}
      onKeyDown={(event) => {
        props.onKeyDown?.(event);
        if (event.defaultPrevented) return;
        const field = event.currentTarget;
        const start = field.selectionStart ?? 0;
        if (start !== field.selectionEnd) return;
        // Delete the adjacent digit together with a separator, so deletion never gets stuck.
        if (event.key === "Backspace" && field.value[start - 1] === "/") {
          field.setSelectionRange(start - 2, start);
        } else if (event.key === "Delete" && field.value[start] === "/") {
          field.setSelectionRange(start, start + 2);
        }
      }}
      onChange={(event) => {
        const field = event.currentTarget;
        const digitsBeforeCaret = field.value.slice(0, field.selectionStart ?? 0).replace(/\D/g, "").length;
        const raw = maskDateInput(field.value);
        const position = Math.min(raw.length, digitsBeforeCaret + (digitsBeforeCaret > 4 ? 1 : 0) + (digitsBeforeCaret > 6 ? 1 : 0));
        caret.current = position;
        field.value = raw;
        field.setSelectionRange(position, position);
        event.currentTarget.setCustomValidity(
          validateDateInput(raw, { required, minDate, maxDate }).error ?? "",
        );
        // Always pass the edit through. Invalid/partial input must replace an old date.
        onChange(parseDateInput(raw) ?? raw);
      }}
    />
  );
}
