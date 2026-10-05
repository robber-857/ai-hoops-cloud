import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isPublicSharedReportRoute } from "@/lib/sharedReportRoute";

const state = vi.hoisted(() => ({
  pathname: "/pose-2d/report",
  query: "",
  auth: { isAuthenticated: false, isInitializing: false, hasInitialized: true },
  replace: vi.fn(),
  effects: [] as Array<() => void>,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: state.replace }),
  usePathname: () => state.pathname,
  useSearchParams: () => new URLSearchParams(state.query),
}));
vi.mock("@/store/authStore", () => ({
  useAuthStore: (selector: (value: typeof state.auth) => unknown) => selector(state.auth),
}));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect: (effect: () => void) => { state.effects.push(effect); },
}));
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

const id = "12345678-1234-4234-8234-123456789abc";
const sharedQuery = `id=${id}&share=1`;

beforeEach(() => {
  state.pathname = "/pose-2d/report";
  state.query = sharedQuery;
  state.auth = { isAuthenticated: false, isInitializing: false, hasInitialized: true };
  state.replace.mockReset();
  state.effects = [];
});

describe("public shared report route boundary", () => {
  it.each([sharedQuery, `share=1&id=${id.toUpperCase()}`, `${sharedQuery}&returnTo=%2Fme`])
    ("accepts one canonical UUID and explicit public share: %s", (query) => {
      expect(isPublicSharedReportRoute("/pose-2d/report", new URLSearchParams(query))).toBe(true);
    });

  it.each(["/me", "/me/profile", "/me/reports", "/pose-2d/training", "/pose-2d/shooting",
    "/pose-2d/dribbling", "/pose-2d/report/", "/pose-2d/report/extra", "/POSE-2D/report", null])
    ("keeps all other paths protected: %s", (pathname) => {
      expect(isPublicSharedReportRoute(pathname, new URLSearchParams(sharedQuery))).toBe(false);
    });

  it.each([`id=${id}`, `id=${id}&share=0`, `id=${id}&share=true`, `id=${id}&share=01`,
    `id=${id}&share=1%20`, "share=1", "id=&share=1", "id=not-a-uuid&share=1",
    `id=${id.replaceAll("-", "")}&share=1`, `id=${id}%20&share=1`,
    `${sharedQuery}&share=0`, `${sharedQuery}&id=${id}`])
    ("rejects private, malformed or ambiguous query: %s", (query) => {
      expect(isPublicSharedReportRoute("/pose-2d/report", new URLSearchParams(query))).toBe(false);
    });
});

describe("ProtectedRoute public exception", () => {
  function render() {
    const html = renderToStaticMarkup(createElement(ProtectedRoute, null, "Read-only report child"));
    state.effects.forEach((effect) => effect());
    return html;
  }

  it.each([false, true])("renders an anonymous shared report while session initialization is %s", (initializing) => {
    state.auth.hasInitialized = !initializing;
    state.auth.isInitializing = initializing;
    expect(render()).toContain("Read-only report child");
    expect(state.replace).not.toHaveBeenCalled();
  });

  it.each(["/me/profile", "/pose-2d/training", "/pose-2d/shooting", "/pose-2d/dribbling"])
    ("redirects anonymous access to %s even with share parameters", (pathname) => {
      state.pathname = pathname;
      expect(render()).not.toContain("Read-only report child");
      expect(state.replace).toHaveBeenCalledWith(`/auth/login?next=${encodeURIComponent(`${pathname}?${sharedQuery}`)}`);
    });

  it("still redirects a private report to login", () => {
    state.query = `id=${id}`;
    expect(render()).toContain("Redirecting to login");
    expect(state.replace).toHaveBeenCalledWith(`/auth/login?next=${encodeURIComponent(`/pose-2d/report?id=${id}`)}`);
  });

  it("still waits for initialization on protected pages and allows authenticated access", () => {
    state.pathname = "/me/profile";
    state.auth = { isAuthenticated: false, isInitializing: true, hasInitialized: false };
    expect(render()).toContain("Checking session");
    expect(state.replace).not.toHaveBeenCalled();
    state.auth = { isAuthenticated: true, isInitializing: false, hasInitialized: true };
    expect(render()).toContain("Read-only report child");
    expect(state.replace).not.toHaveBeenCalled();
  });
});
