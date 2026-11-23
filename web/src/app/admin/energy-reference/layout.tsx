"use client";
import { useAdminText } from "@/components/admin/adminCopy";

import { AdminShell, AdminForbiddenSurface, AdminLoadingSurface } from '@/components/admin/AdminShell';
import { isAdminRole } from "@/lib/authRedirect";
import { useAuthStore } from '@/store/authStore';
export default function Layout({ children }: { children: React.ReactNode }) {
  const t = useAdminText();
  const user = useAuthStore(s=>s.user);
  if (!user) return <AdminLoadingSurface />;
  if (!isAdminRole(user.role)) return <AdminForbiddenSurface user={user} />;
  return <AdminShell user={user} title={t("Energy reference")} breadcrumb={[t("ADMIN"),t("ENERGY REFERENCE")]}>{children}</AdminShell>;
}
