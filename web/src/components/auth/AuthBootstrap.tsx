"use client";

import { useEffect } from "react";

import { authService } from "@/services/auth";
import { useAuthStore } from "@/store/authStore";

export function AuthBootstrap() {
  const startInitialization = useAuthStore((state) => state.startInitialization);
  const setUser = useAuthStore((state) => state.setUser);
  const clearSession = useAuthStore((state) => state.clearSession);
  const finishInitialization = useAuthStore((state) => state.finishInitialization);

  useEffect(() => {
    let isActive = true;

    startInitialization();

    void authService
      .getCurrentUser()
      .then((user) => {
        if (!isActive) {
          return;
        }
        setUser(user);
      })
      .catch(() => {
        if (!isActive) {
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
