import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const pendingMessage =
  "Payment has not been confirmed yet. Complete the payment and try again.";
const unavailableMessage =
  "Payment verification is temporarily unavailable. Please try again.";
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("designer@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("local-test-password");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/generate$/);
}
async function openCheckout(page: Page) {
  await page.goto("/pricing");
  // Next development controls are not product UI and can cover mobile actions.
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("img", { name: "ABA PayWay payment QR code" }),
  ).toHaveCount(0);
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/payments") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Buy Credits", exact: true })
    .first()
    .click();
  const checkout = await (await response).json();
  await expect(
    page.getByRole("dialog", { name: "Complete your payment" }),
  ).toBeVisible();
  return checkout;
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
for (const status of ["pending", "paid", "503"]) {
  test(`dialog verification ${status} preserves backend authority`, async ({
    page,
  }) => {
    await login(page);
    const checkout = await openCheckout(page);
    let refreshes = 0,
      purchases = 0;
    page.on("request", (request) => {
      if (request.url().endsWith("/api/auth/me")) refreshes++;
      if (
        request.url().endsWith("/api/payments") &&
        request.method() === "POST"
      )
        purchases++;
    });
    await page.route("**/api/payments/42/verify", (route) =>
      status === "503"
        ? route.fulfill({
            status: 503,
            json: { detail: "private-provider-error" },
          })
        : route.fulfill({ json: { ...checkout.payment, status } }),
    );
    const longEmail = `${"long-account-name-".repeat(7)}@example.test`;
    if (status === "paid")
      await page.route("**/api/auth/me", (route) =>
        route.fulfill({
          json: {
            id: 1,
            email: longEmail,
            credits: 200,
            plan: "free",
            google_linked: false,
            is_active: true,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        }),
      );
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "starter package" }),
    ).toBeVisible();
    await expect(dialog.getByText("1.99 USD", { exact: true })).toBeVisible();
    await expect(
      dialog.getByText("100 credits", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("link", { name: "Open ABA Mobile" }),
    ).toBeVisible();
    await dialog
      .getByRole("button", { name: "Verify payment", exact: true })
      .click();
    if (status === "paid") {
      await expect(
        dialog.getByRole("heading", { name: "Payment successful" }),
      ).toBeVisible();
      await expect(page.locator("[data-sonner-toast]")).toContainText(
        "Payment confirmed. Your credits have been added.",
      );
      await expect.poll(() => refreshes).toBe(1);
      await dialog.getByRole("link", { name: "Start generating" }).click();
      await expect(page).toHaveURL(/\/generate$/);
      await expect(
        page.getByRole("link", { name: "200 credits available. Buy credits." }),
      ).toBeVisible();
      await page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: "Account", exact: true })
        .click();
      await page.setViewportSize({ width: 375, height: 812 });
      await expect(page.getByText(longEmail, { exact: true })).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    } else {
      await expect(page.locator("[data-sonner-toast]")).toContainText(
        status === "pending" ? pendingMessage : unavailableMessage,
      );
      await expect(dialog).toBeVisible();
      await expect(dialog.locator(".badge.pending")).toHaveText("pending");
      await expect(
        dialog.getByRole("img", { name: "ABA PayWay payment QR code" }),
      ).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Verify payment", exact: true }),
      ).toBeEnabled();
      expect(refreshes).toBe(0);
      expect(await page.content()).not.toContain("private-provider-error");
      await dialog.getByRole("button", { name: "Close checkout" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Buy Credits", exact: true }).first(),
      ).toBeFocused();
      await expect(
        page.getByRole("link", { name: "100 credits available. Buy credits." }),
      ).toBeVisible();
    }
    expect(purchases).toBe(0);
    expect(await page.content()).not.toContain(
      "local-test-session-never-render",
    );
  });
}
test("repeated purchase clicks create one request and closing discards QR", async ({
  page,
}) => {
  await login(page);
  await page.goto("/pricing");
  let purchases = 0;
  await page.route("**/api/payments", async (route) => {
    if (route.request().method() === "POST") {
      purchases++;
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
    await route.continue();
  });
  const buy = page
    .getByRole("button", { name: "Buy Credits", exact: true })
    .first();
  await buy.evaluate((button) => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(
    page.getByRole("button", { name: "Preparing checkout…" }),
  ).toBeDisabled();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(purchases).toBe(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("img", { name: "ABA PayWay payment QR code" }),
  ).toHaveCount(0);
  await expect(buy).toBeFocused();
  await expect(page).toHaveURL(/\/pricing$/);
  expect(purchases).toBe(1);
});
test("dashboard bookmarks redirect; navigation and account expose the new workspace", async ({
  page,
}) => {
  await login(page);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/generate$/);
  await expect(
    page.getByRole("link", { name: "Dashboard", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('a[href="/dashboard"]')).toHaveCount(0);
  await page.goto("/account");
  await expect(
    page.getByRole("heading", { name: "Available Credits", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Current Plan", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("designer@example.test", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Link Google account" }),
  ).toHaveAttribute("href", "/api/auth/google/start?mode=link");
  await expect(
    page.getByRole("link", { name: "Generate description", exact: true }),
  ).toHaveAttribute("href", "/generate");
  await page.getByRole("link", { name: "Buy credits", exact: true }).click();
  await expect(page).toHaveURL(/\/pricing$/);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page
      .getByRole("navigation", { name: "Mobile navigation" })
      .getByRole("link"),
  ).toHaveText(["Generate", "History", "Pricing", "Payments", "Account"]);
});
for (const width of [320, 375, 390, 768, 1440]) {
  test(`checkout and account responsive accessibility at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 812 });
    await login(page);
    await page.goto("/account");
    await page.addStyleTag({
      content: "nextjs-portal { display: none !important; }",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("account.png"),
      fullPage: true,
      caret: "initial",
    });
    await openCheckout(page);
    const dialog = page.getByRole("dialog");
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(812);
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    const qr = dialog.getByRole("img", { name: "ABA PayWay payment QR code" });
    await qr.scrollIntoViewIfNeeded();
    const qrBox = await qr.boundingBox();
    expect(qrBox!.x + qrBox!.width).toBeLessThanOrEqual(width);
    await expect(
      dialog.getByRole("button", { name: "Close", exact: true }),
    ).toBeInViewport();
    await expect(
      dialog.getByRole("button", { name: "Close checkout" }),
    ).toBeInViewport();
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(scan.violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath("checkout-dialog.png"),
      caret: "initial",
    });
    await dialog.getByRole("button", { name: "Close checkout" }).click();
    await expect(dialog).not.toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("pricing.png"),
      fullPage: true,
      caret: "initial",
    });
  });
}
