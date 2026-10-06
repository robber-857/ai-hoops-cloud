"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
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
};

const LanguagePreferenceContext = createContext<Preference | null>(null);

export function LanguagePreferenceProvider({ children }: { children: React.ReactNode }) {
  const owner = useAuthStore((state) => state.user?.public_id ?? null);
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
  }, [owner, retry]);

  const refresh = useCallback((profile: MeProfileRead) => {
    if (owner && ownerRef.current === owner) {
      setState({ owner, profile, error: "", loading: false });
    }
  }, [owner]);
  const reload = useCallback(() => {
    setState({ owner, profile: null, error: "", loading: true });
    setRetry((value) => value + 1);
  }, [owner]);

  const profile = state.owner === owner ? state.profile : null;
  return (
    <LanguagePreferenceContext.Provider value={{
      language: normalizeLanguage(profile?.preferred_language),
      profile,
      loading: Boolean(owner) && (state.owner !== owner || state.loading),
      error: state.owner === owner ? state.error : "",
      refresh,
      reload,
    }}>
      {children}
    </LanguagePreferenceContext.Provider>
  );
}

export function useLanguagePreference(): Preference {
  const preference = useContext(LanguagePreferenceContext);
  if (!preference) throw new Error("Language preference requires LanguagePreferenceProvider.");
  return preference;
}
