"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AccountCenterShell } from "@/components/account/AccountCenterShell";
import { AccountDataProvider } from "@/components/account/AccountDataProvider";
import { LanguagePreferenceProvider } from "@/components/account/LanguagePreferenceProvider";
import { useAuthStore } from "@/store/authStore";
import { routes } from "@/lib/routes";
import { canRoleOpenPath, getDefaultPathForRole } from "@/lib/authRedirect";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, hasInitialized, isAuthenticated } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const canAccess = Boolean(user && canRoleOpenPath(user.role, pathname));
  useEffect(() => {
    if (hasInitialized && !isAuthenticated) {
      router.replace(
        `${routes.auth.login}?next=${encodeURIComponent(pathname + window.location.search)}`,
      );
    } else if (hasInitialized && user && !canAccess) {
      router.replace(getDefaultPathForRole(user.role));
    }
  }, [hasInitialized, isAuthenticated, pathname, router, user, canAccess]);
  if (!hasInitialized || !isAuthenticated || !user || !canAccess) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-[#090b0f] text-white"
        role="status"
      >
        Loading personal center…
      </main>
    );
  }
  return (
    <AccountDataProvider key={user.public_id}>
      <LanguagePreferenceProvider key={user.public_id}>
        <AccountCenterShell username={user.nickname || user.username}>
          {children}
        </AccountCenterShell>
      </LanguagePreferenceProvider>
    </AccountDataProvider>
  );
}
