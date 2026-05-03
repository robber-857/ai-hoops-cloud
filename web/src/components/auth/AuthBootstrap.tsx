"use client";

import { useEffect } from "react";

import { getAuthAccessToken } from "@/lib/authToken";
import { authService } from "@/services/auth";
import { useAuthStore } from "@/store/authStore";

export function AuthBootstrap() {
  const startInitialization = useAuthStore((state) => state.startInitialization);
  const setUser = useAuthStore((state) => state.setUser);
  const clearSession = useAuthStore((state) => state.clearSession);
  const finishInitialization = useAuthStore((state) => state.finishInitialization);

  useEffect(() => {
    let isActive = true;
    const requestAccessToken = getAuthAccessToken();

    startInitialization();

    void authService
      .getCurrentUser()
      .then((user) => {
        if (!isActive || getAuthAccessToken() !== requestAccessToken) {
          return;
        }
        setUser(user);
      })
      .catch(() => {
        if (!isActive || getAuthAccessToken() !== requestAccessToken) {
          return;
        }
        clearSession();
      })
      .finally(() => {
        if (!isActive) {
          return;
        }
        finishInitialization();
      });

    return () => {
      isActive = false;
    };
  }, [clearSession, finishInitialization, setUser, startInitialization]);

  return null;
}
