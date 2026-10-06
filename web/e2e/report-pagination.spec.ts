import { test, expect, login } from "./support";

// Synthetic list responses exercise UI controls; database tests separately cover
// actual paging, ordering, filters, owner isolation and coach membership access.
for (const workspace of ["student", "coach"] as const) {
  test(`${workspace} reports show ten rows and support next, previous, jump and last page`, async ({ page, seed }) => {
    const studentId = seed.accounts.parent.public_id;
    const endpoint = workspace === "student" ? "/me/reports" : `/coach/students/${studentId}/reports`;
    await page.route(`**/api/v1${endpoint}?*`, async route => {
      const query = new URL(route.request().url()).searchParams;
      const total = query.has("analysis_type") ? 4 : 24;
      const offset = Number(query.get("offset") ?? 0);
      const limit = Number(query.get("limit") ?? 20);
      const items = Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, index) => ({
        public_id: `report-${offset + index}`, student_public_id: studentId,
        student_name: "Synthetic Player", analysis_type: "training", template_code: "test",
        overall_score: 80, grade: "B", created_at: "2026-01-01T00:00:00Z", status: "completed",
      }));
      await route.fulfill({ json: { items, total } });
    });
    await login(page, workspace === "student" ? seed.accounts.parent : seed.accounts.coach,
      workspace === "student" ? "/me/reports" : `/coach/students/${studentId}`);
    const nav = page.getByRole("navigation", { name: "Report pagination" });
    await expect(nav).toContainText("Page 1 of 3");
    await expect(page.locator("table tbody tr")).toHaveCount(10);
    await expect(nav.getByRole("button", { name: "Previous", exact: true })).toBeDisabled();
    await nav.getByRole("button", { name: "Next", exact: true }).click();
    await expect(nav).toContainText("11–20 of 24");
    await nav.getByRole("spinbutton", { name: "Page number" }).fill("4");
    await expect(nav.getByRole("button", { name: "Go", exact: true })).toBeDisabled();
    await nav.getByRole("spinbutton", { name: "Page number" }).fill("3");
    await nav.getByRole("button", { name: "Go", exact: true }).click();
    await expect(nav).toContainText("21–24 of 24");
    await expect(page.locator("table tbody tr")).toHaveCount(4);
    await expect(nav.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
    await nav.getByRole("button", { name: "Previous", exact: true }).click();
    await expect(nav).toContainText("Page 2 of 3");
    if (workspace === "student") {
      await page.getByLabel("Analysis type", { exact: true }).selectOption("training");
      await expect(nav).toContainText("Page 1 of 1");
      await expect(page.locator("table tbody tr")).toHaveCount(4);
    } else {
      await expect(page.getByRole("heading", { name: "Player profile", exact: true })).toBeVisible();
      await page.goto("/me/profile");
      await expect(page).toHaveURL(/\/coach$/);
      await expect(page.getByRole("heading", { name: "Personal profile", exact: true })).toHaveCount(0);
    }
  });
}
