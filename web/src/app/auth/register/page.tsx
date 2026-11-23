import { Suspense } from "react";
import { RegisterClient } from "@/components/auth/RegisterClient";

export const metadata = { referrer: "no-referrer" } as const;

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterClient />
    </Suspense>
  );
}
