import { Suspense } from "react";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

function Pose2DRouteFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07080b] text-white">
      <div className="analysis-surface rounded-[28px] border border-white/10 px-8 py-7 text-center">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-sky-300/60 border-t-transparent" />
        <div className="mt-4 text-[0.72rem] uppercase tracking-[0.28em] text-white/48">
          Checking session
        </div>
      </div>
    </main>
  );
}

export default function Pose2DLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<Pose2DRouteFallback />}>
      <ProtectedRoute>{children}</ProtectedRoute>
    </Suspense>
  );
}
