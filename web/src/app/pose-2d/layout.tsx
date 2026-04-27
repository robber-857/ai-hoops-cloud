import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

export default function Pose2DLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
