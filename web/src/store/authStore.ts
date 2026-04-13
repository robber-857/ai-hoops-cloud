"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { clearAuthCookie, setAuthCookie } from "@/lib/authCookie";
import type { AuthUser, LoginResponse } from "@/types/auth";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  tokenType: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setSession: (payload: LoginResponse) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      tokenType: null,
      user: null,
      isAuthenticated: false,
      setSession: (payload) => {
        setAuthCookie();
        set({
          accessToken: payload.access_token,
          refreshToken: payload.refresh_token,
          tokenType: payload.token_type,
          user: payload.user,
          isAuthenticated: true,
        });
      },
      clearSession: () => {
        clearAuthCookie();
        set({
          accessToken: null,
          refreshToken: null,
          tokenType: null,
          user: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: "ai-hoops-auth",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
