type DateParts = { year: number; month: number; day: number };

export function sydneyDateKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((key) => parts.find((part) => part.type === key)?.value)
    .join("-");
}

function parseDate(value: string | null | undefined): DateParts | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;
  if (day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
      ? 29
      : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function isValidPastDate(
  value: string | null | undefined,
  today = sydneyDateKey(),
): boolean {
  return Boolean(parseDate(value) && parseDate(today) && value! <= today);
}

export function ageYears(
  dateOfBirth: string | null | undefined,
  at = sydneyDateKey(),
): number | null {
  const start = parseDate(dateOfBirth);
  const end = parseDate(at);
  if (!start || !end || dateOfBirth! > at) return null;
  const beforeBirthday =
    end.month < start.month ||
    (end.month === start.month && end.day < start.day);
  return end.year - start.year - (beforeBirthday ? 1 : 0);
}

export function trainingDuration(
  startedOn: string | null | undefined,
  at = sydneyDateKey(),
): { years: number; months: number } | null {
  const start = parseDate(startedOn);
  const end = parseDate(at);
  if (!start || !end || startedOn! > at) return null;
  let completeMonths = (end.year - start.year) * 12 + end.month - start.month;
  // A month-end start reaches its anniversary on the shorter month's last day.
  const anniversaryDay = Math.min(start.day, daysInMonth(end.year, end.month));
  if (end.day < anniversaryDay) completeMonths -= 1;
  return { years: Math.floor(completeMonths / 12), months: completeMonths % 12 };
}

export function trainingDurationLabel(
  startedOn: string | null | undefined,
  at = sydneyDateKey(),
): string {
  const duration = trainingDuration(startedOn, at);
  if (!duration) return "Not recorded";
  const parts: string[] = [];
  if (duration.years) {
    parts.push(`${duration.years} ${duration.years === 1 ? "year" : "years"}`);
  }
  if (duration.months) {
    parts.push(`${duration.months} ${duration.months === 1 ? "month" : "months"}`);
  }
  return parts.join(" · ") || "Less than 1 month";
}

export function deriveBmi(
  heightCm: string | number | null | undefined,
  weightKg: string | number | null | undefined,
): string | null {
  const height = decimalFraction(heightCm);
  const weight = decimalFraction(weightKg);
  if (!height || !weight || height.numerator <= 0n || weight.numerator <= 0n) return null;
  // BMI = kg * 10,000 / cm². Keep input decimals exact and match Decimal HALF_UP.
  return roundedHundredths(
    weight.numerator * height.denominator ** 2n * 1_000_000n,
    weight.denominator * height.numerator ** 2n,
  );
}

function decimalFraction(value: string | number | null | undefined) {
  if (value == null) return null;
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  const text = String(value).trim();
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const [integer, fraction = ""] = text.split(".");
  return {
    numerator: BigInt((integer || "0") + fraction),
    denominator: 10n ** BigInt(fraction.length),
  };
}

function roundedHundredths(numerator: bigint, denominator: bigint): string {
  let hundredths = numerator / denominator;
  if ((numerator % denominator) * 2n >= denominator) hundredths += 1n;
  return `${hundredths / 100n}.${String(hundredths % 100n).padStart(2,"0")}`;
}

export function measurementBmi(record: {
  height_cm: string | number;
  weight_kg: string | number;
  bmi?: string | number | null;
}): string | null {
  if (record.bmi != null && record.bmi !== "") {
    const bmi = decimalFraction(record.bmi);
    if (bmi && bmi.numerator > 0n) return roundedHundredths(bmi.numerator * 100n, bmi.denominator);
  }
  return deriveBmi(record.height_cm, record.weight_kg);
}
