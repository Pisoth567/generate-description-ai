import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
async function login(page: Page) {
  await page.goto("/login");
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("designer@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("local-test-password");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/generate$/);
}
test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) =>
    ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort(),
  );
});
test("registration, verification paste, resend cooldown, login verification path", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/register");
  await expect(
    page.getByRole("link", { name: "Continue with Google" }),
  ).toHaveAttribute("href", "/api/auth/google/start");
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("new@example.test");
  await page.getByLabel("Password", { exact: true }).fill("local-password");
  await page.getByLabel("Confirm Password").fill("different");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Passwords must match.",
  );
  await page.getByLabel("Confirm Password").fill("local-password");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL(/\/verify-email$/);
  await expect(
    page.getByRole("button", { name: /Resend code/ }),
  ).toBeDisabled();
  await expect(
    page.getByRole("textbox", { name: "Email", exact: true }),
  ).toHaveValue("new@example.test");
  await page.clock.fastForward(61000);
  await page.getByRole("button", { name: /Resend code/ }).click();
  await expect(page.getByRole("status")).toContainText("Code sent");
  await page.getByLabel("Verification code").fill("123456");
  await page.getByRole("button", { name: "Verify Email", exact: true }).click();
  await expect(page).toHaveURL(/verified=1/);
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("unverified@example.test");
  await page.getByLabel("Password", { exact: true }).fill("local-password");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.getByRole("link", { name: "Verify Email" })).toBeVisible();
});
test("text generation, custom keyboard category, languages and copy", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await login(page);
  await page.getByLabel("Product Name").fill("Canvas tote");
  await page.getByRole("combobox", { name: "Category" }).click();
  await page
    .getByPlaceholder("Search or enter a category")
    .fill("Handmade Khmer Products");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("combobox", { name: "Category" })).toContainText(
    "Handmade Khmer Products",
  );
  await page
    .getByLabel("Product Details / Features")
    .fill("Cotton canvas\nInside pocket");
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  for (const language of ["English", "Khmer"]) {
    await page.getByLabel("Output Language").selectOption(language);
    const sent = page.waitForRequest(
      (r) => r.url().endsWith("/api/generate") && r.method() === "POST",
    );
    await page
      .getByRole("button", { name: "Generate Description", exact: true })
      .click();
    const request = await sent;
    expect(request.headers()["content-type"]).toContain("application/json");
    expect(request.postData()).toContain("Handmade Khmer Products");
    await expect(page.locator(".description")).toHaveAttribute(
      "lang",
      language === "Khmer" ? "km" : "en",
    );
  }
  await page
    .getByRole("button", { name: "Copy description", exact: true })
    .click();
  await expect(
    page.getByText("Description copied to clipboard.", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toEqual(
    await page.locator(".description").innerText(),
  );
  expect(await page.content()).not.toContain("local-test-session-never-render");
  expect(
    (await context.cookies()).find((c) => c.name === "access_token")?.httpOnly,
  ).toBe(true);
});
test("history filters, card copy, empty and safe error states", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await login(page);
  await page.goto("/history");
  await page.getByLabel("Search this page").fill("canvas");
  await expect(page.locator("article")).toHaveCount(1);
  await page
    .locator("article")
    .getByRole("button", { name: "Copy description" })
    .click();
  await expect(
    page.getByText("Description copied to clipboard.", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => navigator.clipboard.readText()),
  ).not.toContain("Everyday canvas tote");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByLabel("Language", { exact: true }).selectOption("Khmer");
  await expect(
    page.getByRole("heading", { name: "កាបូបក្រណាត់" }),
  ).toBeVisible();
  await page.route("**/api/generations?*", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "No descriptions yet" }),
  ).toBeVisible();
  await page.unroute("**/api/generations?*");
  await page.route("**/api/generations?*", (route) =>
    route.fulfill({ status: 503, json: {} }),
  );
  await page.reload();
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
});
for (const width of [320, 375, 390, 768, 1024, 1440])
  test(`responsive and accessibility ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    for (const path of [
      "/register",
      "/login",
      "/generate",
      "/history",
      "/profile",
      "/verify-email",
    ]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const result = await new AxeBuilder({ page }).analyze();
      expect(result.violations).toEqual([]);
    }
  });
test("rate limit error is friendly", async ({ page }) => {
  await login(page);
  await page.getByLabel("Product Name").fill("Product");
  await page.getByLabel("Product Details / Features").fill("Details");
  await page.route("**/api/generate", (route) =>
    route.fulfill({ status: 429, json: { error: {} } }),
  );
  await page
    .getByRole("button", { name: "Generate Description", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Please wait a little",
  );
});

test("navigation locale persists, Khmer categories search, output stays independent", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await login(page);
  await page.getByLabel("Output Language").selectOption("Khmer");
  await page.getByLabel("Navigation language").click();
  await page.getByRole("menuitemradio", { name: "ខ្មែរ" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "km");
  await expect(page.getByLabel("ភាសានៃអត្ថបទ")).toHaveValue("Khmer");
  await page.getByRole("combobox", { name: "ប្រភេទ", exact: true }).click();
  await page.getByPlaceholder("ស្វែងរក ឬបញ្ចូលប្រភេទ").fill("អេឡិចត្រូនិក");
  await page.getByRole("option", { name: "អេឡិចត្រូនិក", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "ប្រភេទ", exact: true }),
  ).toContainText("អេឡិចត្រូនិក");
  await expect(page.locator('input[name="category"]')).toHaveValue(
    "Electronics",
  );
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "km");
  await page.goto("/history/1");
  await page.getByRole("button", { name: "ចម្លងការពិពណ៌នា" }).click();
  await expect(
    page.getByText("Description copied to clipboard.", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toEqual(
    await page.locator(".description").innerText(),
  );
  await page.getByLabel("ភាសាក្នុងម៉ឺនុយ").click();
  await page.getByRole("menuitemradio", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("verification errors and email service failures are safe and localized", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/verify-email");
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("review@example.test");
  await page.getByLabel("Verification code").fill("123456");
  await page.route("**/api/auth/verify-email", (route) =>
    route.fulfill({
      status: 400,
      json: {
        error: {
          code: "invalid_verification_code",
          message: "private provider detail",
        },
      },
    }),
  );
  await page.getByRole("button", { name: "Verify Email", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Invalid or expired code",
  );
  await page.route("**/api/auth/resend-verification", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: {
          code: "email_delivery_unavailable",
          message: "private provider detail",
        },
      },
    }),
  );
  await page.clock.fastForward(61000);
  await page.getByRole("button", { name: /Resend code/ }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Email delivery is unavailable",
  );
  await expect(page.getByRole("status")).toBeEmpty();
  expect(await page.locator("main").innerText()).not.toContain(
    "private provider detail",
  );
  await page.goto("/register");
  await page.getByLabel("Application language").selectOption("km");
  await page.goto("/verify-email");
  await expect(
    page.getByRole("heading", { name: "ផ្ទៀងផ្ទាត់អ៊ីមែលរបស់អ្នក" }),
  ).toBeVisible();
});

test("Khmer active forms and category remain accessible in light and dark at all widths", async ({
  page,
}) => {
  await login(page);
  await page.getByLabel("Navigation language").click();
  await page.getByRole("menuitemradio", { name: "ខ្មែរ" }).click();
  for (const theme of ["light", "dark"]) {
    await page.goto("/profile");
    await page.evaluate((value) => localStorage.setItem("theme", value), theme);
    await page.reload();
    await expect(page.locator("html")).toHaveClass(new RegExp(theme));
    for (const width of [320, 375, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of [
        "/register",
        "/login",
        "/verify-email",
        "/generate",
        "/history",
        "/profile",
      ]) {
        await page.goto(path);
        await expect(page.locator("html")).toHaveAttribute("lang", "km");
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
    }
    for (const path of [
      "/register",
      "/login",
      "/verify-email",
      "/generate",
      "/history",
      "/profile",
    ]) {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
    await page.goto("/generate");
    await expect(page.locator("main")).toBeVisible();
    await page.getByRole("combobox", { name: "ប្រភេទ", exact: true }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.keyboard.press("Escape");
  }
  await page.getByLabel("ភាសាក្នុងម៉ឺនុយ").click();
  await page.getByRole("menuitemradio", { name: "English" }).click();
});
