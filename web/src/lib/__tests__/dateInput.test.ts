import { describe, expect, it } from "vitest";
import { formatDateInput, formatProfileDateTime, maskDateInput, parseDateInput, validateDateInput } from "../dateInput";

describe("Profile date input", () => {
  it("inserts slashes for digits, pasted dates, and partial edits", () => {
    for (const value of ["20120601", "2012/06/01", "2012-06-01"]) {
      expect(maskDateInput(value)).toBe("2012/06/01");
      expect(parseDateInput(maskDateInput(value))).toBe("2012-06-01");
    }
    expect(maskDateInput("20120")).toBe("2012/0");
    expect(maskDateInput("2012060")).toBe("2012/06/0");
    expect(maskDateInput("")).toBe("");
    expect(validateDateInput(maskDateInput("20260230")).error).not.toBeNull();
  });
  it("normalizes visible dates and old ISO values to the same API value", () => {
    expect(parseDateInput("2014/01/09")).toBe("2014-01-09");
    expect(parseDateInput("2014-01-09")).toBe("2014-01-09");
    expect(parseDateInput(" 2014/01/09 ")).toBe("2014-01-09");
    expect(formatDateInput("2014-01-09")).toBe("2014/01/09");
    expect(formatDateInput("2014/01/09")).toBe("2014/01/09");
  });

  it.each(["2026/02/29", "1900/02/29", "2026/04/31", "2026/00/01", "2026/13/01", "2026/01/00", "0000/01/01"])("rejects a non-existent calendar date: %s", (value) => {
    expect(parseDateInput(value)).toBeNull();
    expect(validateDateInput(value).error).not.toBeNull();
  });

  it("keeps leap days without JavaScript year or month rollover", () => {
    expect(parseDateInput("2024/02/29")).toBe("2024-02-29");
    expect(parseDateInput("2000/02/29")).toBe("2000-02-29");
    expect(parseDateInput("0001/01/01")).toBe("0001-01-01");
    expect(parseDateInput("9999/12/31")).toBe("9999-12-31");
  });

  it.each(["2014/", "2014/01/", "2014/1/09", "2014/01/9", "09/01/2014", "20140109", "2014/01-09", "2014/01/099", "yesterday"])("does not turn unfinished or malformed edits into a saved date: %s", (value) => {
    expect(formatDateInput(value)).toBe(value);
    expect(parseDateInput(value)).toBeNull();
    expect(validateDateInput(value).iso).toBeNull();
    expect(validateDateInput(value).error).not.toBeNull();
  });

  it("permits clearing an optional date but blocks clearing a required one", () => {
    expect(validateDateInput("")).toEqual({ iso: null, error: null });
    expect(validateDateInput(null)).toEqual({ iso: null, error: null });
    expect(validateDateInput(" ").error).not.toBeNull();
    expect(validateDateInput(" ", { required: true }).error).not.toBeNull();
    expect(formatDateInput(undefined)).toBe("");
  });

  it("enforces inclusive min/max and refuses a future date", () => {
    const limits = { minDate: "2014-01-09", maxDate: "2026-10-06" };
    expect(validateDateInput("2014/01/09", limits)).toEqual({ iso: "2014-01-09", error: null });
    expect(validateDateInput("2026/10/06", limits)).toEqual({ iso: "2026-10-06", error: null });
    expect(validateDateInput("2014/01/08", limits).error).toContain("2014/01/09");
    expect(validateDateInput("2026/10/07", limits).error).toContain("2026/10/06");
  });

  it("does not silently ignore invalid or reversed date limits", () => {
    expect(validateDateInput("2026/10/06", { maxDate: "2026-02-30" }).error).not.toBeNull();
    expect(validateDateInput("2026/10/06", { minDate: "2026-10-07", maxDate: "2026-10-06" }).error).not.toBeNull();
  });

  it("formats saved timestamps with Sydney dates and a 24-hour clock", () => {
    expect(formatProfileDateTime("2026-10-05T13:30:00Z")).toBe("2026/10/06 00:30");
    expect(formatProfileDateTime("2026-06-01T14:30:00Z")).toBe("2026/06/02 00:30");
    expect(formatProfileDateTime("2026-10-03T16:30:00Z")).toBe("2026/10/04 03:30");
    expect(formatProfileDateTime("invalid")).toBe("Not available");
    expect(formatProfileDateTime(null)).toBe("Not available");
  });
});
