"use client";

import { AccountEntryButton } from "@/components/account/AccountEntryButton";
import { ThemeToggle } from "@/components/navigation/ThemeToggle";
import { useInterfaceText } from "@/hooks/useInterfaceText";
import "./pose-navigation.css";

export function PoseAccountTools() {
  const t = useInterfaceText();
  return (
    <div className="pose-account-tools" role="group" aria-label={t("Account")}>
      <ThemeToggle />
      <AccountEntryButton className="pose-account-entry" />
    </div>
  );
}
