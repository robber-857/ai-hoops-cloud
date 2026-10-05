import { routes } from "@/lib/routes";

const CANONICAL_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** This exception renders the report's existing public, read-only API view only. */
export function isPublicSharedReportRoute(
  pathname: string | null,
  searchParams: Pick<URLSearchParams, "getAll">,
): boolean {
  if (pathname !== routes.pose2d.report) return false;
  const share = searchParams.getAll("share");
  const ids = searchParams.getAll("id");
  return share.length === 1 && share[0] === "1" && ids.length === 1 && CANONICAL_UUID.test(ids[0]);
}
