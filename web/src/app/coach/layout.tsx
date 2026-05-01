import { Suspense } from "react";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

function CoachRouteFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#030712] text-white">
      <div className="rounded-lg border border-white/10 bg-white/[0.055] px-8 py-7 text-center shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#65f7ff]/60 border-t-transparent" />
        <div className="mt-4 text-[0.72rem] uppercase tracking-[0.28em] text-white/48">
          Loading coach console
        </div>
      </div>
    </main>
  );
}

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<CoachRouteFallback />}>
      <ProtectedRoute>{children}</ProtectedRoute>
    </Suspense>
  );
}
