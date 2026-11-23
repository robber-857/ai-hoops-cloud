import { expect, test } from "@playwright/test";

test("guests can switch language across the website and keep their login draft", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("combobox", { name: "Language", exact: true })).toHaveValue("en");
  await page.getByRole("combobox", { name: "Language", exact: true }).selectOption("zh-CN");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("专注执教");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await page.getByRole("link", { name: "登录", exact: true }).first().click();
  await page.getByLabel("学员账号", { exact: true }).fill("example-player");
  await page.getByRole("combobox", { name: "语言", exact: true }).selectOption("en");
  await expect(page.getByLabel("Athlete Identifier", { exact: true })).toHaveValue("example-player");
  await page.getByRole("link", { name: "Register", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Language", exact: true })).toHaveValue("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
