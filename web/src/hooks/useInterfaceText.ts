"use client";

import { useAppLanguage } from "@/components/account/LanguagePreferenceProvider";
import { interfaceText } from "@/lib/interfaceText";

const english = (text: string, ...values: (string | number)[]) => interfaceText("en", text, ...values);
const chinese = (text: string, ...values: (string | number)[]) => interfaceText("zh-CN", text, ...values);

export function useInterfaceText() {
  return useAppLanguage() === "zh-CN" ? chinese : english;
}
