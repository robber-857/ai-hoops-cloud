"use client";
import { useAdminText } from "@/components/admin/adminCopy";

import {
  AdminShell,
  AdminForbiddenSurface,
  AdminLoadingSurface,
} from "@/components/admin/AdminShell";
import { useAuthStore } from "@/store/authStore";
import { isAdminRole } from "@/lib/authRedirect";
export default function Layout({ children }: { children: React.ReactNode }) {
  const t = useAdminText();
  const user = useAuthStore((s) => s.user);
  if (!user) return <AdminLoadingSurface />;
  if (!isAdminRole(user.role)) return <AdminForbiddenSurface user={user} />;
  return (
    <AdminShell user={user} title={t("Recipes")} breadcrumb={[t("ADMIN"), t("RECIPES")]}>
      {children}
    </AdminShell>
  );
}
