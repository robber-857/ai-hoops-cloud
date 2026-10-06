"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AccountCenterShell } from "@/components/account/AccountCenterShell";
import { AccountDataProvider } from "@/components/account/AccountDataProvider";
import { LanguagePreferenceProvider } from "@/components/account/LanguagePreferenceProvider";
import { useAuthStore } from "@/store/authStore";
import { routes } from "@/lib/routes";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, hasInitialized, isAuthenticated } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (hasInitialized && !isAuthenticated) {
      router.replace(
        `${routes.auth.login}?next=${encodeURIComponent(pathname + window.location.search)}`,
      );
    }
  }, [hasInitialized, isAuthenticated, pathname, router]);
  if (!hasInitialized || !isAuthenticated || !user) {
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
