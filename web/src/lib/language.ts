export type AppLanguage = "en" | "zh-CN";

export function normalizeLanguage(value: unknown): AppLanguage {
  return value === "zh-CN" ? "zh-CN" : "en";
}
