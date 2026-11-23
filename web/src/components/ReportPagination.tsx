"use client";

import { useId, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ReportPaginationProps = {
  page: number;
  total: number;
  onChange: (page: number) => void;
  disabled?: boolean;
};

export function ReportPagination({
  page,
  total,
  onChange,
  disabled = false,
}: ReportPaginationProps) {
  const pages = Math.max(1, Math.ceil(total / 10));
  const inputId = useId();
  const [input, setInput] = useState("");
  const target = Number(input);
  const valid = /^\d+$/.test(input) && Number.isInteger(target) && target >= 1 && target <= pages;

  function jumpToPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid || disabled) return;
    onChange(target);
    setInput("");
  }

  return (
    <nav
      aria-label="Report pagination"
      className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-x-5 gap-y-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-3 text-sm text-[var(--ui-text)] sm:px-4"
    >
      <div aria-live="polite" aria-atomic="true" className="min-w-0 flex-1 basis-full sm:basis-auto">
        <p className="font-semibold tabular-nums">Page {page} of {pages}</p>
        <p className="mt-0.5 text-xs tabular-nums text-[var(--ui-muted)]">
          {total ? `Showing ${(page - 1) * 10 + 1}–${Math.min(page * 10, total)} of ${total} reports` : "0 reports"}
        </p>
      </div>
      <div role="group" aria-label="Previous and next page" className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="ui-button disabled:cursor-not-allowed"
          disabled={disabled || page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Previous
        </button>
        <button
          type="button"
          className="ui-button disabled:cursor-not-allowed"
          disabled={disabled || page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Next
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
      <form
        aria-label="Jump to a page"
        className="flex min-w-0 flex-wrap items-center gap-2 max-sm:w-full max-sm:border-t max-sm:border-[var(--ui-border)] max-sm:pt-3"
        onSubmit={jumpToPage}
      >
        <label htmlFor={inputId} className="font-medium text-[var(--ui-muted)]">
          Page number
        </label>
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={1}
          max={pages}
          step={1}
          value={input}
          disabled={disabled}
          onChange={(event) => setInput(event.target.value)}
          className="min-h-11 w-16 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-subtle)] px-2 text-[var(--ui-text)] tabular-nums disabled:cursor-not-allowed"
        />
        <button
          className="ui-button ui-primary disabled:cursor-not-allowed"
          disabled={disabled || !valid}
          type="submit"
        >
          Go
        </button>
      </form>
    </nav>
  );
}
