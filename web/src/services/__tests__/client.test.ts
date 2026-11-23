import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest } from "../client";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("API failures used by safe recipe retries", () => {
  it("preserves rejected request status and readable validation text", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://example.test/api/v1");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: [{msg: "Servings must be positive"}] }), {status: 422})));
    try { await apiRequest("/admin/recipes"); throw new Error("Expected rejection"); }
    catch (error) { expect(error).toBeInstanceOf(ApiError); expect((error as ApiError).status).toBe(422); expect((error as Error).message).toBe("Servings must be positive"); }
  });
  it("keeps transport failures distinguishable from definite server rejection", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://example.test/api/v1");
    const lost = new TypeError("Response lost");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(lost));
    await expect(apiRequest("/admin/recipes")).rejects.toBe(lost);
    expect(lost).not.toBeInstanceOf(ApiError);
  });
  it("exposes the retryable in-progress code as well as its readable message", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://example.test/api/v1");
    const detail = { code: "assistant_reply_in_progress", message: "A reply is already in progress." };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail }), { status: 409 })));
    await expect(apiRequest("/me/assistant/conversations")).rejects.toMatchObject({
      status: 409, code: detail.code, message: detail.message,
    });
  });
  it("preserves unknown and zero nutrient values in successful responses", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://example.test/api/v1");
    const payload = {fibre: null, fat: "0.00"};
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), {status: 200})));
    await expect(apiRequest("/recipes/example")).resolves.toEqual(payload);
  });
});
