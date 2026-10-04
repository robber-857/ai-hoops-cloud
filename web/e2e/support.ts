import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import { test as base, expect, type Page, type Response, type Locator } from "@playwright/test";

export type SeedAccount = {
  username: string;
  password: string;
  public_id: string;
  display_name: string;
};

export type E2ESeed = {
  namespace: string;
  accounts: { parent: SeedAccount; coach: SeedAccount; peer: SeedAccount };
  class: { public_id: string; name: string };
  plan: { public_id: string; title: string };
  base_url?: string;
  api_url?: string;
};

function readSeed(): E2ESeed {
  const path = process.env.AI_HOOPS_E2E_FIXTURE;
  if (!path || !isAbsolute(path)) {
    throw new Error("Set AI_HOOPS_E2E_FIXTURE to the absolute JSON path produced by the dedicated E2E seeder.");
  }
  const seed = JSON.parse(readFileSync(path, "utf8")) as E2ESeed;
  if (!seed.namespace || !seed.class?.public_id || !seed.plan?.public_id) {
    throw new Error("E2E fixture must contain a namespace, class and published plan.");
  }
  for (const role of ["parent", "coach", "peer"] as const) {
    const account = seed.accounts?.[role];
    if (!account?.username || !account.password || !account.public_id || !account.display_name) {
      throw new Error(`E2E fixture is missing the ${role} test account fields.`);
    }
  }
  return seed;
}

export const test = base.extend<object, { seed: E2ESeed }>({
  seed: [async ({}, use) => { await use(readSeed()); }, { scope: "worker" }],
});
export { expect };

export function apiResponse(response: Response, path: string | RegExp, method = "GET"): boolean {
  const pathname = new URL(response.url()).pathname;
  return response.request().method() === method &&
    (typeof path === "string" ? pathname === `/api/v1${path}` : path.test(pathname));
}

export async function login(page: Page, account: SeedAccount, next = "/me") {
  await page.goto(`/auth/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Athlete Identifier", { exact: true }).fill(account.username);
  await page.getByLabel("Security Key", { exact: true }).fill(account.password);
  const response = page.waitForResponse(r => apiResponse(r, "/auth/login/password", "POST"));
  await page.getByRole("button", { name: "Secure Login", exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(url => url.pathname === next.split("?")[0]);
}

export async function logout(page: Page) {
  // The profile has a visible logout control on both desktop and mobile.
  await page.goto("/me/profile");
  await page.getByRole("button", { name: "Log Out", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/login/);
}

export function section(page: Page, heading: string): Locator {
  return page.locator("section").filter({ has: page.getByRole("heading", { name: heading, exact: true }) });
}

export function sydneyDates() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find(p => p.type === "year")!.value);
  const month = parts.find(p => p.type === "month")!.value;
  const day = parts.find(p => p.type === "day")!.value;
  // First-of-month anniversaries are valid in leap years and keep the expected
  // completed years independent of the local machine's time zone.
  return { today: `${year}-${month}-${day}`, birth: `${year - 12}-${month}-01`, started: `${year - 2}-${month}-01` };
}

export async function assertNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1);
}
