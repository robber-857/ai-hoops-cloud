"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { routes } from "@/lib/routes";
import { useAuthStore } from "@/store/authStore";

type ProtectedRouteProps = {
  children: React.ReactNode;
};

function ProtectedRouteFallback() {
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

function ProtectedRouteInner({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const hasInitialized = useAuthStore((state) => state.hasInitialized);

  useEffect(() => {
    if (!hasInitialized || isInitializing || isAuthenticated) {
      return;
    }

    const query = searchParams.toString();
    const nextPath = query ? `${pathname}?${query}` : pathname;
    router.replace(`${routes.auth.login}?next=${encodeURIComponent(nextPath)}`);
  }, [hasInitialized, isAuthenticated, isInitializing, pathname, router, searchParams]);

  if (!hasInitialized || isInitializing) {
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

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07080b] text-white">
        <div className="analysis-surface rounded-[28px] border border-white/10 px-8 py-7 text-center">
          <div className="text-[0.72rem] uppercase tracking-[0.28em] text-white/48">
            Redirecting to login
          </div>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  return (
    <Suspense fallback={<ProtectedRouteFallback />}>
      <ProtectedRouteInner>{children}</ProtectedRouteInner>
    </Suspense>
  );
}
