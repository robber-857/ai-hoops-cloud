"use client";

import { useAppLanguage } from "./LanguagePreferenceProvider";
import { chinesePlayerText, englishPlayerText } from "@/lib/playerText";

export function usePlayerCopy() {
  const language = useAppLanguage();
  const isChinese = language === "zh-CN";
  return { language, t: isChinese ? chinesePlayerText : englishPlayerText, isChinese, locale: isChinese ? "zh-CN" : "en-AU" };
}
