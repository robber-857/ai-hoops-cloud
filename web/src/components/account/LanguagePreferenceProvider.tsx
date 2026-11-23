"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { normalizeLanguage, type AppLanguage } from "@/lib/language";
import { meService, type MeProfileRead } from "@/services/me";
import { useAuthStore } from "@/store/authStore";

type Preference = {
  language: AppLanguage;
  profile: MeProfileRead | null;
  loading: boolean;
  error: string;
  refresh: (profile: MeProfileRead) => void;
  reload: () => void;
  saveLanguage: (language: AppLanguage) => Promise<void>;
};

const LanguagePreferenceContext = createContext<Preference | null>(null);

const preferenceEvent = "apex-language-changed";
function storedLanguage(key: string): AppLanguage {
  try { return normalizeLanguage(localStorage.getItem(key)); } catch { return "en"; }
}
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(preferenceEvent, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(preferenceEvent, listener);
  };
}
function remember(key: string, value: AppLanguage) {
  try { localStorage.setItem(key, value); } catch { /* Storage is optional. */ }
  window.dispatchEvent(new Event(preferenceEvent));
}

export function LanguagePreferenceProvider({ children }: { children: React.ReactNode }) {
  const owner = useAuthStore((state) => state.user?.public_id ?? null);
  const storageKey = `apex-language:${owner ?? "guest"}`;
  const cached = useSyncExternalStore(subscribe, () => storedLanguage(storageKey), () => "en" as const);
  const [guestOverride, setGuestOverride] = useState<AppLanguage | null>(null);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{
    owner: string | null;
    profile: MeProfileRead | null;
    error: string;
    loading: boolean;
  }>({ owner: null, profile: null, error: "", loading: true });
  const ownerRef = useRef(owner);
  ownerRef.current = owner;

  useEffect(() => {
    if (!owner) return;
    let active = true;
    meService.getProfile().then((profile) => {
      if (active && ownerRef.current === owner) {
        setState({ owner, profile, error: "", loading: false });
        remember(storageKey, profile.preferred_language);
      }
    }).catch((reason: unknown) => {
      if (active && ownerRef.current === owner) {
        setState({
          owner, profile: null, loading: false,
          error: reason instanceof Error ? reason.message : "Could not load language preference.",
        });
      }
    });
    return () => { active = false; };
  }, [owner, retry, storageKey]);

  const refresh = useCallback((profile: MeProfileRead) => {
    if (owner && ownerRef.current === owner) {
      setState({ owner, profile, error: "", loading: false });
      remember(storageKey, profile.preferred_language);
    }
  }, [owner, storageKey]);
  const reload = useCallback(() => {
    setState({ owner, profile: null, error: "", loading: true });
    setRetry((value) => value + 1);
  }, [owner]);

  const profile = state.owner === owner ? state.profile : null;
  const language = profile?.preferred_language ?? (!owner ? guestOverride : null) ?? cached;
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  async function saveLanguage(next: AppLanguage) {
    if (!owner) {
      remember(storageKey, next);
      setGuestOverride(storedLanguage(storageKey) === next ? null : next);
      return;
    }
    if (!profile) throw new Error("Profile unavailable");
    const updated = await meService.updateProfile({
      preferred_language: next, expected_updated_at: profile.updated_at,
    });
    refresh(updated);
  }
  return (
    <LanguagePreferenceContext.Provider value={{
      language,
      profile,
      loading: Boolean(owner) && (state.owner !== owner || state.loading),
      error: state.owner === owner ? state.error : "",
      refresh,
      reload,
      saveLanguage,
    }}>
      {children}
    </LanguagePreferenceContext.Provider>
  );
}

export function useAppLanguage(): AppLanguage {
  return useContext(LanguagePreferenceContext)?.language ?? "en";
}

export function useLanguagePreference(): Preference {
  const preference = useContext(LanguagePreferenceContext);
  if (!preference) throw new Error("Language preference requires LanguagePreferenceProvider.");
  return preference;
}
