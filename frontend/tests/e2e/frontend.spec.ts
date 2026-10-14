import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("designer@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("local-test-password");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/generate$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["127.0.0.1", "localhost"].includes(url.hostname) ||
      url.protocol === "data:"
      ? route.continue()
      : route.abort();
  });
});
test("protected navigation, login, account menu, Google links and logout", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(
    page.getByRole("link", { name: "Continue with Google" }),
  ).toHaveAttribute("href", "/api/auth/google/start");
  await login(page);
  await page.goto("/account");
  await expect(
    page.getByRole("link", { name: "Link Google account" }),
  ).toHaveAttribute("href", "/api/auth/google/start?mode=link");
  expect(await page.content()).not.toContain("local-test-session-never-render");
  const cookie = (await page.context().cookies()).find(
    (c) => c.name === "access_token",
  );
  expect(cookie?.httpOnly).toBe(true);
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/generate");
  await expect(page).toHaveURL(/\/login/);
});
test("register mismatch and successful submission", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Email", { exact: true }).fill("new@example.test");
  await page.getByLabel("Password", { exact: true }).fill("local-password");
  await page.getByLabel("Confirm password").fill("different-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Passwords must match" }),
  ).toBeVisible();
  await page.getByLabel("Confirm password").fill("local-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/registered=1/);
});
test("generator submits unchanged contract in English and Khmer, renders and copies result", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await login(page);
  await page.goto("/generate");
  await page.getByLabel("Product Name").fill("Everyday canvas tote");
  await page.getByLabel("Category").fill("Accessories");
  await page
    .getByLabel("Features", { exact: true })
    .fill("Cotton canvas\nInside pocket");
  await page.getByLabel("Tone", { exact: true }).selectOption("friendly");
  for (const language of ["English", "Khmer"]) {
    await page.getByRole("radio", { name: language, exact: true }).check();
    const request = page.waitForRequest(
      (r) => r.url().endsWith("/api/generate") && r.method() === "POST",
    );
    await page
      .getByRole("button", { name: "Generate Description", exact: true })
      .click();
    expect((await request).postDataJSON()).toEqual({
      product_name: "Everyday canvas tote",
      category: "Accessories",
      features: ["Cotton canvas", "Inside pocket"],
      tone: "friendly",
      language,
    });
    await expect(page.locator(".description")).toHaveAttribute(
      "lang",
      language === "Khmer" ? "km" : "en",
    );
    await expect(
      page.getByText("1 credits used", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Copy Description" }).click();
    await expect(
      page.getByText("Copied to clipboard.", { exact: true }),
    ).toBeVisible();
  }
  await page.getByRole("link", { name: "View saved description" }).click();
  await expect(
    page.getByRole("heading", { name: "Saved description", exact: true }),
  ).toBeVisible();
});
test("catalog, QR pending, backend verification and payment statuses", async ({
  page,
}) => {
  await login(page);
  await page.goto("/pricing");
  await expect(
    page.getByRole("heading", { name: "starter", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("1.99")).toBeVisible();
  const purchase = page.waitForRequest(
    (r) => r.url().endsWith("/api/payments") && r.method() === "POST",
  );
  await page
    .getByRole("button", { name: "Buy Credits", exact: true })
    .first()
    .click();
  expect((await purchase).postDataJSON()).toEqual({ package_code: "starter" });
  await expect(
    page.getByRole("img", { name: "ABA PayWay payment QR code" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Payment successful" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Open ABA Mobile" }),
  ).toHaveAttribute("href", "abamobilebank://local-test-only");
  await page
    .getByRole("button", { name: "Verify payment", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Payment successful" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "ABA PayWay payment QR code" }),
  ).toHaveCount(0);
  await page.goto("/payments");
  for (const status of ["pending", "paid", "failed", "cancelled"])
    await expect(
      page.locator(".badge").filter({ hasText: new RegExp(`^${status}$`) }),
    ).toBeVisible();
});
test("mobile drawer keyboard dismissal, navigation and focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page);
  const trigger = page.getByRole("button", { name: "Open navigation" });
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "Generate", exact: true })
    .click();
  await expect(page).toHaveURL(/\/generate$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await noOverflow(page);
});
for (const width of [320, 375, 390, 768, 1024, 1440]) {
  test(`responsive audit at ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/login", "/register"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await noOverflow(page);
      if ([375, 768, 1440].includes(width))
        await page.screenshot({
          path: testInfo.outputPath(
            `${path === "/" ? "landing" : path.slice(1)}.png`,
          ),
          caret: "initial",
          fullPage: true,
        });
    }
    await login(page);
    for (const path of [
      "/generate",
      "/history",
      "/history/2",
      "/pricing",
      "/payments",
      "/account",
      "/payments/return",
    ]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(
        page.getByText(
          /Loading descriptions|Loading packages|Loading payments/,
        ),
      ).toHaveCount(0);
      await noOverflow(page);
      if ([375, 768, 1440].includes(width))
        await page.screenshot({
          path: testInfo.outputPath(
            path.slice(1).replaceAll("/", "-") + ".png",
          ),
          caret: "initial",
          fullPage: true,
        });
    }
    await page.goto("/pricing");
    await page
      .getByRole("button", { name: "Buy Credits", exact: true })
      .first()
      .click();
    const qr = page.getByRole("img", { name: "ABA PayWay payment QR code" });
    await expect(qr).toBeVisible();
    await noOverflow(page);
    const bounds = await qr.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    if ([375, 768, 1440].includes(width))
      await page.screenshot({
        path: testInfo.outputPath("checkout.png"),
        caret: "initial",
        fullPage: true,
      });
  });
}
test("SEO public metadata, private robots and sitemap", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/English & Khmer/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /English and Khmer/,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /^https:\/\/description\.example\/?$/,
  );
  expect(
    JSON.parse(
      await page.locator('script[type="application/ld+json"]').innerText(),
    )["@type"],
  ).toBe("SoftwareApplication");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("https://description.example/");
  expect(sitemap).not.toMatch(
    /dashboard|generate<|history|payments|account|localhost/,
  );
  await login(page);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
});
test("dark mode and reduced motion remain usable", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/");
  await page.screenshot({
    path: testInfo.outputPath("landing-dark.png"),
    caret: "initial",
    fullPage: true,
  });
  await login(page);
  await page.goto("/generate");
  await noOverflow(page);
  await page.screenshot({
    path: testInfo.outputPath("generator-dark.png"),
    caret: "initial",
    fullPage: true,
  });
});

for (const scheme of ["light", "dark"] as const) {
  test(`accessible public and app pages in ${scheme} mode`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    for (const path of ["/", "/login", "/register"]) {
      await page.goto(path);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        result.violations,
        `${path}: ${JSON.stringify(result.violations)}`,
      ).toEqual([]);
    }
    await login(page);
    for (const path of [
      "/generate",
      "/history",
      "/history/2",
      "/pricing",
      "/payments",
      "/account",
    ]) {
      await page.goto(path);
      await expect(
        page.getByText(
          /Loading descriptions|Loading packages|Loading payments/,
        ),
      ).toHaveCount(0);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        result.violations,
        `${path}: ${JSON.stringify(result.violations)}`,
      ).toEqual([]);
    }
  });
}

test("generation pending and safe error states; history empty and pagination", async ({
  page,
}) => {
  await login(page);
  await page.route("**/api/generate", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "private-provider-debug" }),
    });
  });
  await page.goto("/generate");
  await page.getByLabel("Product Name").fill("A product");
  await page
    .getByRole("button", { name: "Generate Description", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Generating…", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Finding the right words for your product…"),
  ).toBeVisible();
  await expect(page.locator('[data-slot="alert"]')).toBeVisible();
  expect(await page.content()).not.toContain("private-provider-debug");
  await expect(
    page.getByRole("button", { name: "Generate Description", exact: true }),
  ).toBeEnabled();
  await page.route("**/api/generations?*", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.goto("/history");
  await expect(
    page.getByRole("heading", { name: "No descriptions yet" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous" })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Next", exact: true }),
  ).toBeDisabled();
});
test("desktop sidebar stays accessible when collapsed", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page);
  await page.getByRole("button", { name: "Collapse sidebar" }).click();
  await expect(
    page.getByRole("button", { name: "Expand sidebar" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "History", exact: true })
    .click();
  await expect(page).toHaveURL(/\/history$/);
  await page.getByRole("button", { name: "Expand sidebar" }).click();
});

test("saved generation survives balance refresh failure without another generation request", async ({
  page,
}) => {
  await login(page);
  await page.goto("/generate");
  let generations = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/generate") && request.method() === "POST")
      generations++;
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 503, json: {} }),
  );
  await page.getByLabel("Product Name").fill("Canvas tote");
  await page
    .getByRole("button", { name: "Generate Description", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "View saved description" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Your description is saved, but the credit balance could not be refreshed.",
    ),
  ).toBeVisible();
  await page.unroute("**/api/auth/me");
  await page.getByRole("button", { name: "Refresh credit balance" }).click();
  await expect(
    page.getByText(
      "Your description is saved, but the credit balance could not be refreshed.",
    ),
  ).toHaveCount(0);
  expect(generations).toBe(1);
});
test("generator feature constraints and history page filters", async ({
  page,
}) => {
  await login(page);
  await page.goto("/generate");
  await page
    .getByLabel("Features", { exact: true })
    .fill(Array.from({ length: 21 }, (_, i) => `Feature ${i}`).join("\n"));
  await expect(page.getByText("21/20 features")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Generate Description", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Features", { exact: true }).fill("Cotton canvas");
  await expect(
    page.getByRole("button", { name: "Generate Description", exact: true }),
  ).toBeEnabled();
  await page.goto("/history");
  await page.getByLabel("Search this page").fill("canvas");
  await expect(
    page.getByRole("heading", { name: "Everyday canvas tote" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "កាបូបក្រណាត់" })).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await page.getByLabel("Language", { exact: true }).selectOption("Khmer");
  await expect(
    page.getByRole("heading", { name: "កាបូបក្រណាត់" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Everyday canvas tote" }),
  ).toHaveCount(0);
});

test("missing pages provide a usable recovery route", async ({ page }) => {
  await page.goto("/this-page-does-not-exist");
  await expect(
    page.getByRole("heading", { name: "Let’s get you back to your work." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to home" }).click();
  await expect(page).toHaveURL(/\/$/);
});
test("QR image failure keeps recovery and verification controls available", async ({
  page,
}) => {
  await login(page);
  await page.goto("/pricing");
  await page
    .getByRole("button", { name: "Buy Credits", exact: true })
    .first()
    .click();
  await page
    .getByRole("img", { name: "ABA PayWay payment QR code" })
    .evaluate((image) => image.dispatchEvent(new Event("error")));
  await expect(
    page.getByText(/The QR image could not be displayed/),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open ABA Mobile" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Verify payment", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: "Payment successful" }),
  ).toHaveCount(0);
});
