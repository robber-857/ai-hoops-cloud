"use client";
import { AdminShell, AdminForbiddenSurface, AdminLoadingSurface } from '@/components/admin/AdminShell';
import { useAuthStore } from '@/store/authStore';
export default function Layout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s=>s.user);
  if (!user) return <AdminLoadingSurface />;
  if (user.role !== 'admin') return <AdminForbiddenSurface user={user} />;
  return <AdminShell user={user} title="Energy reference" breadcrumb={['ADMIN','ENERGY REFERENCE']}>{children}</AdminShell>;
}
