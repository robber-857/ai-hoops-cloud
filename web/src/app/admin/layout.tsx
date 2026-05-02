import { Suspense } from "react";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminLoadingSurface } from "@/components/admin/AdminShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AdminLoadingSurface />}>
      <ProtectedRoute>{children}</ProtectedRoute>
    </Suspense>
  );
}
