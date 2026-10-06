type DateInputLimits = {
  required?: boolean;
  minDate?: string | null;
  maxDate?: string | null;
};

type DateInputValidation = {
  iso: string | null;
  error: string | null;
};

/** Insert separators while typing; partial dates remain editable and invalid. */
export function maskDateInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)]
    .filter(Boolean).join("/");
}

/** Accept the visible yyyy/mm/dd format and existing ISO date values. */
export function parseDateInput(value: string | null | undefined): string | null {
  const match = /^(\d{4})([-/])(\d{2})\2(\d{2})$/.exec(value?.trim() ?? "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[3]);
  const day = Number(match[4]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const lastDay = month === 2 ? (leapYear ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
  if (day > lastDay) return null;
  return `${match[1]}-${match[3]}-${match[4]}`;
}

/** Keep unfinished or invalid drafts visible instead of restoring a saved date. */
export function formatDateInput(value: string | null | undefined): string {
  return parseDateInput(value)?.replaceAll("-", "/") ?? value ?? "";
}

export function validateDateInput(
  value: string | null | undefined,
  { required = false, minDate, maxDate }: DateInputLimits = {},
): DateInputValidation {
  if (value == null || value === "") {
    return { iso: null, error: required ? "Enter a date in yyyy/mm/dd format." : null };
  }
  const iso = parseDateInput(value);
  if (!iso) return { iso: null, error: "Enter a valid date in yyyy/mm/dd format." };
  const min = parseDateInput(minDate);
  const max = parseDateInput(maxDate);
  if ((minDate && !min) || (maxDate && !max) || (min && max && min > max)) {
    return { iso: null, error: "Date limits are unavailable. Please reload." };
  }
  if (min && iso < min) {
    return { iso: null, error: `Enter a date on or after ${formatDateInput(min)}.` };
  }
  if (max && iso > max) {
    return { iso: null, error: `Enter a date on or before ${formatDateInput(max)}.` };
  }
  return { iso, error: null };
}

/** Saved timestamps retain their time, with a fixed Sydney date and 24-hour clock. */
export function formatProfileDateTime(value: string | null | undefined): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}/${part("month")}/${part("day")} ${part("hour")}:${part("minute")}`;
}
