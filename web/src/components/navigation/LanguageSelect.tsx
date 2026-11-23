"use client";

import { useState } from "react";
import { Languages } from "lucide-react";
import { useLanguagePreference } from "@/components/account/LanguagePreferenceProvider";
import { normalizeLanguage } from "@/lib/language";

export function LanguageSelect() {
  const { language, saveLanguage, loading, error, reload } = useLanguagePreference();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative flex min-h-11 shrink-0 items-center gap-1 text-sm">
      <Languages aria-hidden="true" size={16} />
      <select aria-label={language === "en" ? "Language" : "语言"} value={language}
        disabled={loading || busy || Boolean(error)} className="min-h-11 max-w-24 cursor-pointer rounded bg-transparent"
        onChange={async event => {
          const next = normalizeLanguage(event.target.value);
          setFailed(false);
          setBusy(true);
          try { await saveLanguage(next); } catch { setFailed(true); } finally { setBusy(false); }
        }}>
        <option lang="en" value="en">English</option>
        <option lang="zh-CN" value="zh-CN">简体中文</option>
      </select>
      {(failed || error) && <button type="button" role="alert" onClick={() => { reload(); setFailed(false); }} className="underline">
        {language === "en" ? "Retry" : "重试"}
      </button>}
    </div>
  );
}
