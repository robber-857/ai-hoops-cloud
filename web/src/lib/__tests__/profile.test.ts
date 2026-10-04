import { describe, expect, it } from "vitest";
import {
  ageYears,
  deriveBmi,
  isValidPastDate,
  measurementBmi,
  sydneyDateKey,
  trainingDuration,
  trainingDurationLabel,
} from "@/lib/profile";

describe("profile dates", () => {
  it("uses Sydney's date across UTC midnight and daylight saving", () => {
    expect(sydneyDateKey(new Date("2026-10-03T15:30:00Z"))).toBe("2026-10-04");
    expect(sydneyDateKey(new Date("2026-07-01T13:30:00Z"))).toBe("2026-07-01");
    expect(sydneyDateKey(new Date("2026-07-01T14:30:00Z"))).toBe("2026-07-02");
  });

  it("checks birthday boundaries and historical measurement dates", () => {
    expect(ageYears("2014-10-03", "2026-10-02")).toBe(11);
    expect(ageYears("2014-10-03", "2026-10-03")).toBe(12);
    expect(ageYears("2014-10-03", "2024-01-03")).toBe(9);
    expect(ageYears("2012-02-29", "2025-02-28")).toBe(12);
    expect(ageYears("2012-02-29", "2025-03-01")).toBe(13);
  });

  it("counts complete calendar years and months without using elapsed days", () => {
    expect(trainingDuration("2024-10-03", "2026-10-02")).toEqual({ years: 1, months: 11 });
    expect(trainingDuration("2024-10-03", "2026-10-03")).toEqual({ years: 2, months: 0 });
    expect(trainingDuration("2025-12-04", "2026-10-03")).toEqual({ years: 0, months: 9 });
    expect(trainingDuration("2025-12-03", "2026-10-03")).toEqual({ years: 0, months: 10 });
  });

  it("handles shorter month anniversaries and leap years", () => {
    expect(trainingDuration("2026-01-31", "2026-02-27")).toEqual({ years: 0, months: 0 });
    expect(trainingDuration("2026-01-31", "2026-02-28")).toEqual({ years: 0, months: 1 });
    expect(trainingDuration("2024-02-29", "2025-02-28")).toEqual({ years: 1, months: 0 });
    expect(trainingDuration("2024-02-29", "2024-03-28")).toEqual({ years: 0, months: 0 });
  });

  it("does not accept empty, invalid or future dates", () => {
    for (const value of [null, "", "2026-02-29", "2026-04-31", "2026-13-03", "2026-10-04", "03/10/2026"]) {
      expect(isValidPastDate(value, "2026-10-03")).toBe(false);
      expect(trainingDuration(value, "2026-10-03")).toBeNull();
      expect(ageYears(value, "2026-10-03")).toBeNull();
    }
    expect(isValidPastDate("2024-02-29", "2026-10-03")).toBe(true);
    expect(isValidPastDate("2026-10-03", "2026-10-03")).toBe(true);
  });

  it("shows clear experience labels including a new starter", () => {
    expect(trainingDurationLabel(null, "2026-10-03")).toBe("Not recorded");
    expect(trainingDurationLabel("2026-10-03", "2026-10-03")).toBe("Less than 1 month");
    expect(trainingDurationLabel("2025-09-03", "2026-10-03")).toBe("1 year · 1 month");
    expect(trainingDurationLabel("2024-10-03", "2026-10-03")).toBe("2 years");
  });
});

describe("profile BMI", () => {
  it("uses centimetres and kilograms and rounds to two decimal places", () => {
    expect(deriveBmi("150", "40")).toBe("17.78");
    expect(deriveBmi(172.5, 61.2)).toBe("20.57");
  });

  it("matches decimal HALF_UP at exact rounding ties", () => {
    expect(deriveBmi("200", "80.02")).toBe("20.01");
    expect(deriveBmi("200", "80.06")).toBe("20.02");
    expect(deriveBmi("200", "80.019")).toBe("20.00");
    expect(deriveBmi("200", "80.021")).toBe("20.01");
    expect(measurementBmi({ height_cm:"200",weight_kg:"80.02",bmi:"20.005" })).toBe("20.01");
  });

  it("keeps missing or invalid measurements separate from zero", () => {
    for (const value of [null, undefined, "", "unknown", 0, -1, Infinity]) {
      expect(deriveBmi(value, 40)).toBeNull();
      expect(deriveBmi(150, value)).toBeNull();
    }
  });

  it("supports old saved measurements without BMI and numeric new responses", () => {
    expect(measurementBmi({ height_cm: "150", weight_kg: "40" })).toBe("17.78");
    expect(measurementBmi({ height_cm: "150", weight_kg: "40", bmi: null })).toBe("17.78");
    expect(measurementBmi({ height_cm: "150", weight_kg: "40", bmi: 17.78 })).toBe("17.78");
    expect(measurementBmi({ height_cm: "150", weight_kg: "40", bmi: "17.78" })).toBe("17.78");
  });
});
