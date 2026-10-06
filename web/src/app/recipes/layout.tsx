"use client";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AccountCenterShell } from "@/components/account/AccountCenterShell";
import { AdminShell } from "@/components/admin/AdminShell";
import { CoachShell } from "@/components/coach/CoachShell";
import { useAuthStore } from "@/store/authStore";
export default function RecipeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = useAuthStore((s) => s.user);
  return (
    <ProtectedRoute>
      {user?.role === "admin" ? (
        <AdminShell user={user} title="Recipe library" breadcrumb={["Recipes"]}>
          {children}
        </AdminShell>
      ) : user?.role === "coach" ? (
        <CoachShell user={user} title="Recipe library" breadcrumb={["Recipes"]}>
          {children}
        </CoachShell>
      ) : (
        <AccountCenterShell
          username={user?.nickname || user?.username || "Account"}
        >
          {children}
        </AccountCenterShell>
      )}
    </ProtectedRoute>
  );
}
