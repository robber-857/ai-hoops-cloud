import type { CampLesson } from "../src/services/campLessons";
import type { ClassReport, Publication, ReportPreview } from "../src/services/classReports";
import type { Locator, Page } from "@playwright/test";
import { test, expect, apiResponse, login, logout, section, sydneyDates,
  assertNoHorizontalOverflow, type SeedAccount } from "./support";

async function fillDate(input: Locator, date: string) {
  // Profile uses an explicit slash format; coach dates retain their native
  // control. In both cases, HTTP assertions below require canonical ISO dates.
  const displayed = await input.getAttribute("type") === "date" ? date : date.replaceAll("-", "/");
  await input.fill(displayed);
  await input.press("Tab");
  await expect(input).toHaveValue(displayed);
}

async function saveMeasurement(page: Page, height: string, weight: string) {
  const dates = sydneyDates();
  const measurements = section(page, "Player measurements");
  const sex = measurements.getByRole("combobox", { name: "Sex (optional)", exact: true });
  await expect(sex).toBeEnabled();
  await fillDate(measurements.getByLabel("Date of birth", { exact: true }), dates.birth);
  await fillDate(measurements.getByLabel("Measurement date", { exact: true }), dates.today);
  await measurements.getByLabel("Height (cm)", { exact: true }).fill(height);
  await measurements.getByLabel("Weight (kg)", { exact: true }).fill(weight);
  await sex.selectOption("male");
  const pending = page.waitForResponse(r => apiResponse(r, "/me/profile/measurements", "POST"));
  await measurements.getByRole("button", { name: "Save new measurement", exact: true }).click();
  const response = await pending;
  expect(response.ok()).toBe(true);
  expect(response.request().postDataJSON()).toMatchObject({
    date_of_birth: dates.birth, measured_on: dates.today, height_cm: height, weight_kg: weight,
  });
  await expect(measurements.getByText("Measurement saved. Previous records are unchanged.", { exact: true })).toBeVisible();
  return response.json();
}

function participant(editor: Locator, lesson: CampLesson, account: SeedAccount) {
  const roster = lesson.roster.find(row => row.student_public_id === account.public_id);
  if (!roster) throw new Error("The dedicated class fixture is missing an expected student.");
  const label = roster.contact ? `${roster.name} (${roster.contact})` : roster.name;
  const selection = editor.getByRole("combobox", { name: `Participation for ${label}`, exact: true });
  const container = editor.locator("tbody tr").filter({ has: selection });
  return { selection, container, label };
}

async function saveLesson(page: Page, lesson: CampLesson) {
  const savedResponse = page.waitForResponse(r =>
    apiResponse(r, `/coach/classes/${lesson.class_public_id}/lessons/${lesson.public_id}`, "PUT"));
  const previewResponse = page.waitForResponse(async r =>
    apiResponse(r, /\/report-preview$/) && r.ok() &&
    (await r.json() as ReportPreview).lesson_version === lesson.version + 1);
  await section(page, "Today’s training").getByRole("button", { name: "Save draft", exact: true }).click();
  const saved = await savedResponse;
  expect(saved.ok()).toBe(true);
  const next = await saved.json() as CampLesson;
  const preview = await (await previewResponse).json() as ReportPreview;
  expect(preview.blockers).toEqual([]);
  expect(preview.preview_fingerprint).toMatch(/^[a-f0-9]{64}$/);
  await expect(page.getByRole("heading", { name: "Today’s training", exact: true })).toHaveCount(1);
  return { lesson: next, preview };
}

async function publish(page: Page, lesson: CampLesson, preview: ReportPreview) {
  const pending = page.waitForResponse(r =>
    apiResponse(r, `/coach/classes/${lesson.class_public_id}/lessons/${lesson.public_id}/publish-reports`, "POST"));
  await section(page, "3. Publish to students").getByRole("button", { name: /^Publish to \d+ students$/ }).click();
  const response = await pending;
  expect(response.ok()).toBe(true);
  expect(response.request().postDataJSON()).toMatchObject({
    expected_version: lesson.version, expected_preview_fingerprint: preview.preview_fingerprint,
  });
  return await response.json() as Publication;
}

async function readReport(page: Page, report: ClassReport) {
  await page.goto(`/me/class-reports/${report.public_id}`);
  await expect(page.getByRole("heading", { name: "Published class record", exact: true })).toBeVisible();
  await expect(page.getByText(new RegExp(`${report.total_minutes} recorded minutes`))).toBeVisible();
  const article = page.locator("article");
  await expect(article.getByText(`≈ ${report.exercise_energy!.total_kcal} kcal`, { exact: true })).toBeVisible();
  await expect(article.getByRole("button", { name: /save|publish|edit/i })).toHaveCount(0);
  await expect(article.locator("input,select,textarea")).toHaveCount(0);
}

test.describe("simplified training and food nutrition with real dedicated APIs", () => {
  // The course uses the profile created by the preceding UI scenario. A new
  // seed JSON/database namespace is required for each complete run.
  test.describe.configure({ mode: "serial" });

  test("yyyy/mm/dd profile dates persist as ISO after refresh and login; body history retains BMI", async ({ page, seed }) => {
    const dates = sydneyDates();
    await login(page, seed.accounts.parent, "/me/profile");
    const basics = section(page, "Player profile");
    const nickname = `UI Athlete ${seed.namespace}`;
    await expect(basics.getByLabel("Started training on", { exact: true })).toHaveAttribute("placeholder", "yyyy/mm/dd");
    await expect(basics.getByRole("combobox", { name: "Language", exact: true })).toHaveValue("en");
    await basics.getByLabel(/Player name \/ nickname/).fill(nickname);
    await fillDate(basics.getByLabel("Started training on", { exact: true }), dates.started);
    await expect(basics.locator("output")).toHaveText("2 years");
    const savedResponse = page.waitForResponse(r => apiResponse(r, "/me/profile", "PATCH"));
    await basics.getByRole("button", { name: "Save profile", exact: true }).click();
    const saved = await savedResponse;
    expect(saved.status()).toBe(200);
    expect(saved.request().postDataJSON()).toMatchObject({ nickname, training_started_on: dates.started });
    expect(await saved.json()).toMatchObject({ nickname, training_started_on: dates.started });
    await expect(basics.getByText(/Profile saved\./)).toBeVisible();
    await expect(page.getByRole("link", { name: "Open personal center", exact: true })).toContainText(nickname);

    await saveMeasurement(page, "150", "40");
    await saveMeasurement(page, "155", "43");
    const measurements = section(page, "Player measurements");
    await expect(measurements.getByLabel("Date of birth", { exact: true })).toHaveAttribute("placeholder", "yyyy/mm/dd");
    await expect(measurements.getByLabel("Measurement date", { exact: true })).toHaveAttribute("placeholder", "yyyy/mm/dd");
    await expect(page.locator('input[type="date"]')).toHaveCount(0);
    await expect(measurements.locator("li")).toHaveCount(2);
    await expect(measurements.locator("li").nth(0)).toContainText("BMI 17.90");
    await expect(measurements.locator("li").nth(1)).toContainText("BMI 17.78");
    await expect(measurements.locator("output").nth(0)).toHaveText("12 years");

    await page.reload();
    await expect(basics.getByLabel("Started training on", { exact: true })).toHaveValue(dates.started.replaceAll("-", "/"));
    await expect(measurements.getByLabel("Date of birth", { exact: true })).toHaveValue(dates.birth.replaceAll("-", "/"));
    await expect(measurements.locator("li")).toHaveCount(2);
    await logout(page);
    await login(page, seed.accounts.parent, "/me/profile");
    await expect(basics.getByLabel(/Player name \/ nickname/)).toHaveValue(nickname);
    await expect(basics.getByLabel("Started training on", { exact: true })).toHaveValue(dates.started.replaceAll("-", "/"));
    await expect(basics.locator("output")).toHaveText("2 years");
    await expect(measurements.getByLabel("Date of birth", { exact: true })).toHaveValue(dates.birth.replaceAll("-", "/"));
    await expect(measurements.getByLabel("Height (cm)", { exact: true })).toHaveValue("155.00");
    await expect(measurements.locator("li")).toHaveCount(2);

    // Switch identity in the same browser session through the real logout/login
    // flow: an empty peer profile must not retain the preceding player's data.
    await logout(page);
    await login(page, seed.accounts.peer, "/me/profile");
    await expect(basics.getByLabel("Started training on", { exact: true })).toHaveValue("");
    await expect(basics.locator("output")).toHaveText("Not recorded");
    await expect(measurements.locator("li")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open personal center", exact: true })).not.toContainText(nickname);
  });

  test("coach publishes personal activity minutes, parent reads, stale preview retries and history stays frozen", async ({ page, browser, seed, baseURL }) => {
    test.setTimeout(240_000);
    const dates = sydneyDates();
    const next = `/coach/lessons?classId=${seed.class.public_id}&planId=${seed.plan.public_id}`;
    await login(page, seed.accounts.coach, next);
    // The linked class is selected by the page. Re-selecting the same option
    // dispatches an artificial change event and clears plans without a new
    // class-ID transition to fetch them again.
    await expect(page.getByRole("combobox", { name: "Class", exact: true })).toHaveValue(seed.class.public_id);
    await expect(page.getByRole("combobox", { name: "Published plan", exact: true })
      .locator(`option[value="${seed.plan.public_id}"]`)).toHaveCount(1);
    await page.getByRole("combobox", { name: "Published plan", exact: true }).selectOption(seed.plan.public_id);
    await fillDate(page.getByLabel("Lesson date", { exact: true }), dates.today);
    const createdResponse = page.waitForResponse(r => apiResponse(r, `/coach/classes/${seed.class.public_id}/lessons`, "POST"));
    await page.getByRole("button", { name: "Start session", exact: true }).click();
    const created = await createdResponse;
    expect(created.ok()).toBe(true);
    let lesson = await created.json() as CampLesson;
    let editor = section(page, "Today’s training");
    const title = `UI Training ${seed.namespace}`;
    await editor.getByLabel("Lesson title", { exact: true }).fill(title);
    await expect(editor.getByLabel("Actual minutes", { exact: true })).toHaveCount(2);
    const names = ["UI warm-up", "UI basketball game"];
    const codes = ["warmup", "basketball_game"];
    for (let index = 0; index < 2; index++) {
      await editor.getByLabel(`Activity ${index + 1}`, { exact: true }).fill(names[index]);
      await editor.getByLabel("Actual minutes", { exact: true }).nth(index).fill(index === 0 ? "10" : "20");
      await editor.getByText("Activity notes & energy estimate (optional)", { exact: true }).nth(index).click();
      await editor.getByRole("combobox", { name: `Activity standard for activity ${index + 1}`, exact: true }).selectOption(codes[index]);
      await expect(editor.getByLabel(`Activity ${index + 1}`, { exact: true })).toHaveValue(names[index]);
      await expect(editor.getByRole("combobox", { name: `Intensity for activity ${index + 1}`, exact: true })).toHaveValue("");
      await editor.getByRole("combobox", { name: `Intensity for activity ${index + 1}`, exact: true }).selectOption(index === 0 ? "low" : "high");
    }
    const parent = participant(editor, lesson, seed.accounts.parent);
    await parent.selection.selectOption("partial");
    await parent.container.getByLabel(`${names[0]} minutes for ${parent.label}`, { exact: true }).fill("10");
    await parent.container.getByLabel(`${names[1]} minutes for ${parent.label}`, { exact: true }).fill("10");
    await participant(editor, lesson, seed.accounts.peer).selection.selectOption("absent");
    await expect(section(page, "3. Publish to students").getByRole("button", { name: "Save draft before publishing", exact: true })).toBeDisabled();
    const firstSave = await saveLesson(page, lesson);
    lesson = firstSave.lesson;
    expect(lesson.items.map(i => [i.activity_code, i.intensity])).toEqual([["warmup", "low"], ["basketball_game", "high"]]);
    const first = await publish(page, lesson, firstSave.preview);
    const original = first.reports.find(r => r.attendance === "partial")!;
    expect(original).toBeTruthy();
    expect(Number(original.total_minutes)).toBe(20);
    expect(original.items.map(i => Number(i.minutes))).toEqual([10, 10]);
    expect(original.exercise_energy?.status).toBe("complete");
    expect(original.exercise_energy!.total_kcal).toBeGreaterThan(0);
    expect(original.profile?.weight_kg).toBe("43.00");
    const absent = first.reports.find(r => r.attendance === "absent")!;
    expect(absent.exercise_energy?.status).toBe("not_applicable");

    const parentContext = await browser.newContext({ baseURL, timezoneId: "Australia/Sydney" });
    const parentPage = await parentContext.newPage();
    try {
      await login(parentPage, seed.accounts.parent);
      const today = section(parentPage, "Today’s training");
      await expect(today).toContainText("20 personal training minutes");
      await today.getByRole("link", { name: title, exact: true }).click();
      await readReport(parentPage, original);
      await expect(parentPage.locator("article")).toContainText("10 minutes participated / 20 class minutes");

      editor = section(page, "Today’s training");
      const revisedParent = participant(editor, lesson, seed.accounts.parent);
      await revisedParent.container.getByLabel(`${names[0]} minutes for ${revisedParent.label}`, { exact: true }).fill("8");
      await revisedParent.container.getByLabel(`${names[1]} minutes for ${revisedParent.label}`, { exact: true }).fill("5");
      const secondSave = await saveLesson(page, lesson);
      lesson = secondSave.lesson;

      // Change the actual profile through its form after the coach's preview.
      // The server must reject this fingerprint until a new preview is read.
      await parentPage.goto("/me/profile");
      await saveMeasurement(parentPage, "160", "46");
      const conflict = page.waitForResponse(r => apiResponse(r, /\/publish-reports$/, "POST"));
      await section(page, "3. Publish to students").getByRole("button", { name: /^Publish to \d+ students$/ }).click();
      expect((await conflict).status()).toBe(409);
      const publisher = section(page, "3. Publish to students");
      await expect(publisher.getByRole("alert")).toBeVisible();
      const newPreviewResponse = page.waitForResponse(r => apiResponse(r, /\/report-preview$/));
      await publisher.getByRole("button", { name: "Retry", exact: true }).click();
      const newPreview = await (await newPreviewResponse).json() as ReportPreview;
      expect(newPreview.preview_fingerprint).not.toBe(secondSave.preview.preview_fingerprint);
      const second = await publish(page, lesson, newPreview);
      const latest = second.reports.find(r => r.attendance === "partial")!;
      expect(Number(latest.total_minutes)).toBe(13);
      expect(latest.profile?.weight_kg).toBe("46.00");
      expect(latest.exercise_energy!.total_kcal!).toBeLessThan(original.exercise_energy!.total_kcal!);

      await parentPage.goto("/me/class-reports/daily");
      await expect(parentPage.getByRole("link", { name: title, exact: true })).toHaveCount(1);
      await expect(parentPage.getByText(/13 minutes · Partial participation/)).toBeVisible();
      await parentPage.getByRole("link", { name: title, exact: true }).click();
      await readReport(parentPage, latest);
      await parentPage.getByRole("link", { name: `Lesson v${original.lesson_version}`, exact: true }).click();
      await expect(parentPage.locator("article")).toContainText("Historical version.");
      await expect(parentPage.locator("article")).toContainText("43.00 kg");
      await readReport(parentPage, original);
    } finally {
      await parentContext.close();
    }
  });

  test("English default and saved Chinese preference survive refresh, login and account switches", async ({ page, seed }) => {
    test.setTimeout(180_000);
    await login(page, seed.accounts.parent, "/foods");
    await expect(page.getByRole("heading", { name: "Food nutrition", exact: true })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "28 matching foods" })).toBeVisible();
    await expect(page.getByRole("link", { name: "AFCD", exact: true })).toHaveAttribute("href", "https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd/data-files");
    await expect(page.getByText(/Food composition data represents/)).toHaveCount(0);
    await page.goto("/me/profile");
    const basics = section(page, "Player profile");
    const language = basics.getByRole("combobox", { name: "Language", exact: true });
    await expect(language).toHaveValue("en");
    const start = basics.getByLabel("Started training on", { exact: true });
    await expect(start).toBeEnabled();
    await expect(start).toHaveValue(sydneyDates().started.replaceAll("-", "/"));
    const existingDate = await start.inputValue();
    await start.fill("2026/02/30");
    await expect.poll(() => start.evaluate((element: HTMLInputElement) => element.validity.valid)).toBe(false);
    await start.fill(existingDate);
    await language.selectOption("zh-CN");
    const pending = page.waitForResponse(r => apiResponse(r, "/me/profile", "PATCH"));
    await basics.getByRole("button", { name: "Save profile", exact: true }).click();
    const saved = await pending;
    expect(saved.status()).toBe(200);
    expect(saved.request().postDataJSON()).toMatchObject({ preferred_language: "zh-CN" });
    expect(await saved.json()).toMatchObject({ preferred_language: "zh-CN", training_started_on: existingDate.replaceAll("/", "-") });
    await expect(basics.getByText(/Profile saved\./)).toBeVisible();
    await page.goto("/foods");
    await expect(page.getByRole("heading", { name: "食材营养", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "食材营养", exact: true })).toBeVisible();
    await logout(page);
    await login(page, seed.accounts.parent, "/foods");
    await expect(page.getByRole("heading", { name: "食材营养", exact: true })).toBeVisible();
    await logout(page);
    await login(page, seed.accounts.peer, "/foods");
    await expect(page.getByRole("heading", { name: "Food nutrition", exact: true })).toBeVisible();
    await expect(page.locator("article").first()).toContainText("Chicken breast");
    await logout(page);
    await login(page, seed.accounts.parent, "/me/profile");
    await expect(language).toHaveValue("zh-CN");
    await language.selectOption("en");
    await page.route("**/api/v1/me/profile", route => {
      if (route.request().method() !== "PATCH") return route.continue();
      return route.fulfill({
        status: 503, contentType: "application/json",
        headers: { "access-control-allow-origin": new URL(page.url()).origin, "access-control-allow-credentials": "true" },
        body: JSON.stringify({ detail: "E2E temporary profile failure" }),
      });
    }, { times: 1 });
    await basics.getByRole("button", { name: "Save profile", exact: true }).click();
    await expect(basics.getByRole("alert")).toContainText("E2E temporary profile failure");
    await expect(language).toHaveValue("en");
    const retried = page.waitForResponse(r => apiResponse(r, "/me/profile", "PATCH"));
    await basics.getByRole("button", { name: "Save profile", exact: true }).click();
    expect((await retried).status()).toBe(200);
    await expect(basics.getByText(/Profile saved\./)).toBeVisible();
    await page.goto("/foods");
    await expect(page.getByRole("heading", { name: "Food nutrition", exact: true })).toBeVisible();
  });

  test("foods use official per-100g data, category/search/pagination and retry work on desktop and mobile", async ({ page, seed }) => {
    await login(page, seed.accounts.parent, "/me/profile");
    const basics = section(page, "Player profile");
    await basics.getByRole("combobox", { name: "Language", exact: true }).selectOption("zh-CN");
    const preference = page.waitForResponse(r => apiResponse(r, "/me/profile", "PATCH"));
    await basics.getByRole("button", { name: "Save profile", exact: true }).click();
    expect((await preference).status()).toBe(200);
    await expect(basics.getByText(/Profile saved\./)).toBeVisible();
    await page.goto("/foods");
    await expect(page.getByRole("heading", { name: "食材营养", exact: true })).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "共 28 条匹配食材" })).toBeVisible();
    await expect(page.locator("article")).toHaveCount(20);
    await page.getByRole("button", { name: "下一页", exact: true }).click();
    await expect(page.locator("article")).toHaveCount(8);
    await expect(page.getByRole("button", { name: "下一页", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "上一页", exact: true }).click();
    await expect(page.locator("article")).toHaveCount(20);
    await page.getByRole("button", { name: "奶类", exact: true }).click();
    await expect(page.getByRole("button", { name: "奶类", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("article")).toHaveCount(5);
    const search = page.getByLabel("搜索食材名称或状态", { exact: true });
    await search.fill("牛奶");
    await search.press("Enter");
    await expect(page.locator("article")).toHaveCount(3);
    const milk = page.locator("article").filter({ has: page.getByRole("heading", { name: "全脂牛奶", exact: true }) });
    await expect(milk).toContainText("每 100 g 可食部分");
    for (const value of ["5.4 g", "3.3 g", "3.4 g"]) await expect(milk).toContainText(value);
    await search.fill("milk");
    const englishSearch = page.waitForResponse(r => apiResponse(r, "/training-foods") &&
      new URL(r.url()).searchParams.get("query") === "milk");
    await page.getByRole("button", { name: "搜索", exact: true }).click();
    expect((await englishSearch).status()).toBe(200);
    await expect(page.locator("article")).toHaveCount(3);
    await search.fill(`no-food-${seed.namespace}`);
    await search.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "没有匹配的食材" })).toBeVisible();
    await expect(page.locator("article")).toHaveCount(0);

    await search.fill("");
    await search.press("Enter");
    await expect(page.locator("article")).toHaveCount(5);
    // Inject on an existing component's category change, rather than its first
    // mount: development StrictMode may discard the first mount's response.
    // Retry must then read the real authenticated API with the same filter.
    await page.route("**/api/v1/training-foods?**", route => route.fulfill({
      status: 503, contentType: "application/json",
      headers: { "access-control-allow-origin": new URL(page.url()).origin, "access-control-allow-credentials": "true" },
      body: JSON.stringify({ detail: "E2E temporary food source failure" }),
    }), { times: 1 });
    await page.getByRole("button", { name: "全部", exact: true }).click();
    const foodError = page.getByRole("alert").filter({ hasText: "食材数据暂不可用，请稍后重试。" });
    await expect(foodError).toBeVisible();
    await page.getByRole("button", { name: "重新加载", exact: true }).click();
    await expect(page.locator("article")).toHaveCount(20);
    await expect(foodError).toHaveCount(0);

    for (const width of [360, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await assertNoHorizontalOverflow(page);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const menu = page.getByRole("button", { name: "Open workspace menu", exact: true });
    await menu.focus();
    await menu.press("Enter");
    const drawer = page.getByRole("dialog", { name: "Personal center", exact: true });
    await expect(drawer).toBeVisible();
    const close = drawer.getByRole("button", { name: "Close workspace menu", exact: true });
    await expect(close).toBeFocused();
    await close.press("Shift+Tab");
    await expect(drawer.getByRole("button", { name: "Log Out", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
    await expect(menu).toBeFocused();
    await menu.press("Enter");
    const profileLink = drawer.getByRole("link", { name: "Personal profile", exact: true });
    await profileLink.focus();
    await profileLink.press("Enter");
    await expect(page).toHaveURL(/\/me\/profile$/);
    await expect(section(page, "Player profile").locator("output")).toHaveText("2 years");
    await assertNoHorizontalOverflow(page);
    await page.goto("/me");
    await expect(section(page, "Today’s training")).toContainText("13 personal training minutes");
    await assertNoHorizontalOverflow(page);
  });
});
