"use client";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AccountCenterShell } from "@/components/account/AccountCenterShell";
import { useAuthStore } from "@/store/authStore";
export default function RecipeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = useAuthStore((s) => s.user);
  return (
    <ProtectedRoute>
      <AccountCenterShell
        username={user?.nickname || user?.username || "Account"}
      >
        {children}
      </AccountCenterShell>
    </ProtectedRoute>
  );
}
