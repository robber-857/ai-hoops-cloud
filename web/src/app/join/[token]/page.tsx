import type { Metadata } from "next";
import { ClassInviteLanding } from "@/components/account/ClassInviteLanding";

export const metadata: Metadata = {
  title: "Class invitation | AI Hoops",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default async function ClassInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ClassInviteLanding key={token} token={token} />;
}
