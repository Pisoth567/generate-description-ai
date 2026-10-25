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
  // The mock account is shared across tests. Authenticated profile preferences
  // override localStorage, so initialize the account as well as the browser.
  const response = await page.request.post("/api/auth/preferences", {
    headers: { origin: "http://127.0.0.1:3100" },
    data: { ui_language: "en" },
  });
  expect(response.ok()).toBe(true);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
}

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) =>
    ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort(),
  );
});

async function watchAccessibility(page: Page) {
  const warnings: string[] = [];
  const record = (text: string) => {
    if (/aria-hidden|hydrat|server rendered|didn.t match/i.test(text))
      warnings.push(text);
  };
  page.on("console", (message) => record(message.text()));
  page.on("pageerror", (error) => warnings.push(error.message));
  // Chromium's blocked aria-hidden warnings can arrive through the browser log.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Log.enable");
  cdp.on("Log.entryAdded", ({ entry }) => record(entry.text));
  await page.addInitScript(() => {
    const hiddenFocus: string[] = [];
    Object.assign(window, { hiddenFocus });
    const check = () => {
      const focused = document.activeElement;
      if (focused?.closest('[aria-hidden="true"], [inert]'))
        hiddenFocus.push(focused.outerHTML);
    };
    document.addEventListener("focusin", check);
    new MutationObserver(check).observe(document, {
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-hidden", "inert"],
    });
  });
  return async () => {
    expect(warnings).toEqual([]);
    expect(
      await page.evaluate(() => Reflect.get(window, "hiddenFocus")),
    ).toEqual([]);
  };
}

for (const menuName of ["Navigation language", "Profile menu"]) {
  test(`Generator hydrates while ${menuName} is open`, async ({ page }) => {
    const checkAccessibility = await watchAccessibility(page);
    await login(page);
    let release!: () => void;
    let held = false;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    // Delay the real Generator chunk, preserving its contents. The shell can
    // hydrate independently, so its menu opens before the page hydrates.
    await page.route("**/_next/static/chunks/*.js", async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      if (body.includes('"[project]/components/generator.tsx [app-client]')) {
        held = true;
        await delayed;
      }
      await route.fulfill({ response, body });
    });
    await page.goto("/generate", { waitUntil: "commit" });
    try {
      await expect(
        page.getByRole("button", { name: "Switch to dark mode" }),
      ).toBeEnabled();
      await expect.poll(() => held).toBe(true);
      await page.getByLabel(menuName, { exact: true }).click();
      await expect(page.getByRole("menu")).toBeVisible();
      // Let menu mount effects finish before releasing the page hydration.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }),
      );
    } finally {
      release();
    }
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { name: "Generate Description" }),
    ).toBeVisible();
    await checkAccessibility();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(page.getByLabel(menuName, { exact: true })).toBeFocused();
    await page.getByRole("combobox", { name: "Category", exact: true }).click();
    await expect(
      page.getByPlaceholder("Search or enter a category"),
    ).toBeFocused();
    await checkAccessibility();
  });
}

for (const locale of ["en", "km"]) {
  for (const theme of ["light", "dark"]) {
    test(`Generator keyboard and focus: ${locale}, ${theme}`, async ({
      page,
    }) => {
      const checkAccessibility = await watchAccessibility(page);
      await login(page);
      if (locale === "km") {
        await page.getByLabel("Navigation language").click();
        await page.getByRole("menuitemradio", { name: "ខ្មែរ" }).click();
        await expect(page.locator("html")).toHaveAttribute("lang", "km");
      }
      await page.evaluate(
        ({ locale, theme }) => {
          localStorage.setItem("ui_language", locale);
          localStorage.setItem("theme", theme);
        },
        { locale, theme },
      );
      await page.setViewportSize({
        width: theme === "light" ? 1440 : 375,
        height: 900,
      });
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveClass(new RegExp(theme));
      const category = page.getByRole("combobox", {
        name: locale === "en" ? "Category" : "ប្រភេទ",
        exact: true,
      });
      const search = page.locator("[cmdk-input]");
      await category.focus();
      await page.keyboard.press("Enter");
      await expect(search).toBeFocused();
      await search.fill(locale === "en" ? "Electronics" : "អេឡិចត្រូនិក");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await expect(page.locator('input[name="category"]')).toHaveValue(
        "Electronics",
      );
      await expect(category).toBeFocused();
      await page.keyboard.press("Space");
      await expect(search).toBeFocused();
      await search.fill("Handmade Khmer Products");
      await page.keyboard.press("ArrowDown");
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.keyboard.press("Enter");
      await expect(category).toBeFocused();
      await expect(category).toContainText("Handmade Khmer Products");
      await page.keyboard.press("Enter");
      await expect(search).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(category).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(page.locator('textarea[name="features"]')).toBeFocused();
      await category.click();
      await page.locator('input[name="product_name"]').click();
      await expect(search).toHaveCount(0);
      await expect(page.locator('input[name="product_name"]')).toBeFocused();
      for (const label of locale === "en"
        ? ["Navigation language", "Profile menu"]
        : ["ភាសាក្នុងម៉ឺនុយ", "ម៉ឺនុយប្រវត្តិរូប"]) {
        const trigger = page.getByLabel(label, { exact: true });
        await trigger.focus();
        await page.keyboard.press("Enter");
        await expect(page.getByRole("menu")).toBeVisible();
        await page.keyboard.press("ArrowDown");
        expect(
          await page
            .getByRole("menu")
            .evaluate((menu) => menu.contains(document.activeElement)),
        ).toBe(true);
        await page.keyboard.press("Escape");
        await expect(trigger).toBeFocused();
      }
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await checkAccessibility();
    });
  }
}
