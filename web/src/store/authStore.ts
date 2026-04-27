"use client";

import { create } from "zustand";

import type { AuthUser, LoginResponse } from "@/types/auth";

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  hasInitialized: boolean;
  setSession: (payload: LoginResponse) => void;
  setUser: (user: AuthUser | null) => void;
  startInitialization: () => void;
  finishInitialization: () => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isInitializing: false,
  hasInitialized: false,
  setSession: (payload) => {
    set({
      user: payload.user,
      isAuthenticated: true,
      isInitializing: false,
      hasInitialized: true,
    });
  },
  setUser: (user) => {
    set({
      user,
      isAuthenticated: Boolean(user),
    });
  },
  startInitialization: () => {
    set({
      isInitializing: true,
    });
  },
  finishInitialization: () => {
    set({
      isInitializing: false,
      hasInitialized: true,
    });
  },
  clearSession: () => {
    set({
      user: null,
      isAuthenticated: false,
      isInitializing: false,
      hasInitialized: true,
    });
  },
}));
