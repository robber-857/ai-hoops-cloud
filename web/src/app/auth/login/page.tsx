import { Suspense } from "react";

import { LoginClient } from "@/components/auth/LoginClient";

export const metadata = { referrer: "no-referrer" } as const;

export default function LoginPage() {
  return (
    <Suspense>
      <LoginClient />
    </Suspense>
  );
}
