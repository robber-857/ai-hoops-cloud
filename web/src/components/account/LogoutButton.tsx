"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { authService } from "@/services/auth";
import { useAuthStore } from "@/store/authStore";

type LogoutButtonProps = {
  className?: string;
  label?: string;
};

export function LogoutButton({
  className,
  label = "Log Out",
}: LogoutButtonProps) {
  const router = useRouter();
  const clearSession = useAuthStore((state) => state.clearSession);
  const [isPending, setIsPending] = useState(false);

  const handleLogout = async () => {
    if (isPending) {
      return;
    }

    setIsPending(true);

    try {
      await authService.logout();
    } catch (error) {
      console.error("Logout failed, clearing local session anyway.", error);
    } finally {
      clearSession();
      router.replace(routes.auth.login);
      router.refresh();
      setIsPending(false);
    }
  };

  return (
    <Button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className={cn(
        "rounded-full border border-red-300/25 bg-red-400/12 text-red-100 shadow-[0_18px_45px_rgba(0,0,0,0.22)] hover:bg-red-400/18",
        className
      )}
    >
      {isPending ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : (
        <LogOut className="h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
