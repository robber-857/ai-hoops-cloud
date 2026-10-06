"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AccountCenterShell } from "@/components/account/AccountCenterShell";
import { AdminShell } from "@/components/admin/AdminShell";
import { CoachShell } from "@/components/coach/CoachShell";
import { useAuthStore } from "@/store/authStore";
import { LanguagePreferenceProvider } from "@/components/account/LanguagePreferenceProvider";

export default function FoodLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  return (
    <ProtectedRoute>
      <LanguagePreferenceProvider key={user?.public_id ?? "anonymous"}>
      {user?.role === "admin" ? (
        <AdminShell user={user} title="Food nutrients" breadcrumb={["Food nutrients"]}>
          {children}
        </AdminShell>
      ) : user?.role === "coach" ? (
        <CoachShell user={user} title="Food nutrients" breadcrumb={["Food nutrients"]}>
          {children}
        </CoachShell>
      ) : (
        <AccountCenterShell username={user?.nickname || user?.username || "Account"}>
          {children}
        </AccountCenterShell>
      )}
      </LanguagePreferenceProvider>
    </ProtectedRoute>
  );
}
