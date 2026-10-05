import { randomUUID } from "node:crypto";
import { test, expect, login, apiResponse } from "./support";
import type { ReportRead } from "../src/services/reports";

// The dedicated seeder supplies synthetic stored measurements and a historical
// template. These checks exercise the real report API, not video inference/S3.
test("age preview cancels, failed save retries once, history stays frozen and sharing is read-only", async ({ page, browser, seed, baseURL }) => {
  const sourceId = seed.age_reports.source;
  const loginResponse = page.waitForResponse(r => apiResponse(r, "/auth/login/password", "POST"));
  await login(page, seed.accounts.parent, `/pose-2d/report?id=${sourceId}`);
  const { access_token: token } = await (await loginResponse).json();
  const headers = { Authorization: `Bearer ${token}` };
  const api = process.env.API_BASE_URL ?? "http://127.0.0.1:8123/api/v1";
  const originalResponse = await page.request.get(`${api}/reports/${sourceId}`, { headers });
  expect(originalResponse.ok()).toBe(true);
  const original = await originalResponse.json() as ReportRead;
  const dashboardBefore = await (await page.request.get(`${api}/me/dashboard`, { headers })).json();
  const age = page.getByRole("combobox", { name: "Age Group", exact: true });
  await expect(age).toHaveValue("16-18");
  await expect(age).toBeEnabled();
  await age.selectOption("4-7");
  await expect(page.getByText(/Preview for ages 4-7/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Share", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(age).toHaveValue("16-18");
  await expect(page.getByRole("button", { name: "Save as new report", exact: true })).toHaveCount(0);
  await age.selectOption("4-7");

  const requests: Record<string, unknown>[] = [];
  let releaseSave!: () => void;
  const saving = new Promise<void>(resolve => { releaseSave = resolve; });
  await page.route(`**/reports/${sourceId}/reanalyze-age`, async route => {
    requests.push(route.request().postDataJSON());
    if (requests.length === 1) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Synthetic one-shot save failure" }) });
    } else {
      await saving;
      await route.continue();
    }
  });
  await page.getByRole("button", { name: "Save as new report", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Synthetic one-shot save failure" })).toBeVisible();
  await expect(age).toHaveValue("4-7");
  const savedResponse = page.waitForResponse(r => apiResponse(r, `/reports/${sourceId}/reanalyze-age`, "POST") && r.ok());
  await page.getByRole("button", { name: "Save as new report", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saving…", exact: true })).toBeDisabled();
  await expect(age).toBeDisabled();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
  releaseSave();
  const saved = await (await savedResponse).json() as ReportRead;
  expect(requests).toHaveLength(2);
  expect(requests[0].request_id).toBe(requests[1].request_id);
  expect(saved.public_id).toBe(requests[1].request_id);
  expect(saved.public_id).not.toBe(sourceId);
  expect(saved.template_snapshot).toEqual(original.template_snapshot);
  expect(saved.score_data.saved_metrics).toEqual(original.score_data.saved_metrics);
  expect(saved.timeline_data).toEqual(original.timeline_data);
  expect(saved.score_data.score_context).toMatchObject({ age_group: "4-7", source_report_public_id: sourceId });
  expect(saved.overall_score).not.toBe(original.overall_score);
  await expect(page).toHaveURL(url => url.searchParams.get("id") === saved.public_id);
  await expect(age).toHaveValue("4-7");
  await page.reload();
  await expect(age).toHaveValue("4-7");

  // Retry the same successful write through the real API: one immutable result.
  const retry = await page.request.post(`${api}/reports/${sourceId}/reanalyze-age`, { headers, data: requests[1] });
  expect(retry.ok()).toBe(true);
  expect((await retry.json()).public_id).toBe(saved.public_id);
  const list = await (await page.request.get(`${api}/reports/mine`, { headers })).json();
  expect(list.items.filter((report: { public_id: string }) => report.public_id === saved.public_id)).toHaveLength(1);
  const unchanged = await (await page.request.get(`${api}/reports/${sourceId}`, { headers })).json();
  expect(unchanged).toEqual(original);
  const dashboardAfter = await (await page.request.get(`${api}/me/dashboard`, { headers })).json();
  expect(dashboardAfter.stats).toEqual(dashboardBefore.stats);
  expect(dashboardAfter.recent_sessions).toEqual(dashboardBefore.recent_sessions);
  expect(dashboardAfter.active_tasks).toEqual(dashboardBefore.active_tasks);
  const anonymous = await browser.newContext();
  try {
    const shared = await anonymous.newPage();
    await shared.goto(`${baseURL}/pose-2d/report?id=${saved.public_id}&share=1`);
    await expect(shared.getByRole("combobox", { name: "Age Group", exact: true })).toHaveValue("4-7");
    await expect(shared.getByRole("combobox", { name: "Age Group", exact: true })).toBeDisabled();
    await expect(shared.getByRole("button", { name: "Save as new report", exact: true })).toHaveCount(0);
    const denied = await anonymous.request.post(`${api}/reports/${sourceId}/reanalyze-age`, { data: { ...requests[1], request_id: randomUUID() } });
    expect([401, 403]).toContain(denied.status());
    await shared.goto(`${baseURL}/pose-2d/report?id=${saved.public_id}`);
    await expect(shared).toHaveURL(/\/auth\/login\?next=/);
    await shared.goto(`${baseURL}/pose-2d/training?share=1&id=${saved.public_id}`);
    await expect(shared).toHaveURL(/\/auth\/login\?next=/);
  } finally { await anonymous.close(); }
});

test("missing historical rules block age edits; failed report loads can retry without stale scores", async ({ page, seed }) => {
  await login(page, seed.accounts.parent, `/pose-2d/report?id=${seed.age_reports.missing_rules}`);
  const age = page.getByRole("combobox", { name: "Age Group", exact: true });
  await expect(age).toHaveValue("16-18");
  await expect(age).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save as new report", exact: true })).toHaveCount(0);
  let failed = false;
  await page.route(`**/reports/${seed.age_reports.source}`, async route => {
    if (!failed) {
      failed = true;
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Synthetic report load failure" }) });
    } else { await route.continue(); }
  });
  await page.goto(`/pose-2d/report?id=${seed.age_reports.source}`);
  await expect(page.getByRole("alert").filter({ hasText: "Synthetic report load failure" })).toBeVisible();
  await page.getByRole("button", { name: /retry/i }).click();
  await expect(age).toHaveValue("16-18");
  await expect(age).toBeEnabled();
  await expect(page.getByRole("heading", { name: "Could not load report", exact: true })).toHaveCount(0);
  // Native history updates are supported by Next navigation. Staying in the
  // mounted component catches old report data leaking across a failed ID change.
  await page.evaluate(() => window.history.pushState(null, "", `/pose-2d/report?id=${crypto.randomUUID()}`));
  await expect(page.getByRole("heading", { name: "Could not load report", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Age Group", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Share", exact: true })).toHaveCount(0);
});
