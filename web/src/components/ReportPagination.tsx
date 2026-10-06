"use client";

import { useState } from "react";

export function ReportPagination({ page, total, onChange, disabled = false }: {
  page: number; total: number; onChange: (page: number) => void; disabled?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(total / 10));
  const [input, setInput] = useState("");
  const target = Number(input);
  const valid = /^\d+$/.test(input) && Number.isInteger(target) && target >= 1 && target <= pages;
  const buttonClass = "min-h-11 rounded-lg border border-white/20 px-4 disabled:cursor-not-allowed disabled:opacity-40";
  return <nav aria-label="Report pagination" className="mt-5 flex flex-wrap items-center gap-3 text-sm text-white/80">
    <span aria-live="polite">{total ? `${(page - 1) * 10 + 1}–${Math.min(page * 10, total)} of ${total}` : "0 reports"} · Page {page} of {pages}</span>
    <button type="button" className={buttonClass} disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
    <button type="button" className={buttonClass} disabled={disabled || page >= pages} onClick={() => onChange(page + 1)}>Next</button>
    <form className="flex items-center gap-2" onSubmit={event => { event.preventDefault(); if (valid && !disabled) { onChange(target); setInput(""); } }}>
      <label>Go to page <input aria-label="Page number" type="number" min={1} max={pages} step={1} value={input} disabled={disabled}
        onChange={event => setInput(event.target.value)} className="ml-2 min-h-11 w-20 rounded-lg border border-white/20 bg-[#10141b] px-2 text-white" /></label>
      <button className={buttonClass} disabled={disabled || !valid} type="submit">Go</button>
    </form>
  </nav>;
}
