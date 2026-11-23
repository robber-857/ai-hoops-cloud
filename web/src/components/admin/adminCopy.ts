"use client";

import { useAppLanguage } from "@/components/account/LanguagePreferenceProvider";
import messages from "./admin.zh.json";

const chinese: Record<string, string> = messages;
type Value = string | number | null | undefined;

function interpolate(text: string, values: Value[]): string {
  return values.length ? text.replace(/\{(\d+)\}/g, (token, i: string) => String(values[Number(i)] ?? token)) : text;
}

function englishText(text: string, ...values: Value[]) {
  return interpolate(text, values);
}

function chineseText(text: string, ...values: Value[]) {
  return interpolate(Object.hasOwn(chinese, text) ? chinese[text] : text, values);
}

export function useAdminText() {
  return useAppLanguage() === "zh-CN" ? chineseText : englishText;
}
