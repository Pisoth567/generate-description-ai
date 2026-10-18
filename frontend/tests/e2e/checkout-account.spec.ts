import { test, expect } from "@playwright/test";
test("deprecated routes redirect; profile language and all theme choices; no credit UX", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("designer@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("local-test-password");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/generate$/);
  for (const path of [
    "/dashboard",
    "/pricing",
    "/payments",
    "/payments/return",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/generate$/);
  }
  await page.goto("/account");
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByText("Verified", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Link Google account" }),
  ).toHaveAttribute("href", "/api/auth/google/start?mode=link");
  for (const theme of ["light", "dark", "system"]) {
    await page.getByLabel("Theme", { exact: true }).selectOption(theme);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("theme"))).toBe(theme);
  }
  await page.getByLabel("Application language").selectOption("km");
  await expect(page.locator("html")).toHaveAttribute("lang", "km");
  await expect(
    page.getByRole("heading", { name: "ប្រវត្តិរូប" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "km");
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByLabel("ភាសាកម្មវិធី").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("link", { name: /Pricing|Payments|Dashboard|Buy credits/i }),
  ).toHaveCount(0);
  expect(await page.locator("main").innerText()).not.toMatch(
    /credits|plan|google_sub|JWT/i,
  );
  await page.getByRole("button", { name: "Profile menu" }).click();
  await page.getByRole("menuitem", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/login/);
});
