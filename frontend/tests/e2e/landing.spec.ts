import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

for (const locale of ["en", "km"]) {
  for (const theme of ["light", "dark"]) {
    test(`landing ${locale} ${theme}: responsive, accessible and static`, async ({
      page,
    }) => {
      await page.addInitScript(
        ({ locale, theme }) => {
          localStorage.setItem("ui_language", locale);
          localStorage.setItem("theme", theme);
        },
        { locale, theme },
      );
      const apiRequests: string[] = [];
      page.on("request", (request) => {
        if (request.url().includes("/api/")) apiRequests.push(request.url());
      });
      await page.goto("/");
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveClass(new RegExp(theme));
      await expect(page.locator(".landing-nav")).toHaveCSS(
        "position",
        "sticky",
      );
      await expect(page.locator(".landing-nav")).toHaveCSS("z-index", "50");
      await page.evaluate(() => document.fonts.ready);
      for (const width of [320, 375, 390, 768, 1024, 1199, 1200, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await expect(page.getByRole("heading", {
          level: 1,
          name: locale === "en"
            ? "Write better product descriptions in English or Khmer"
            : "សរសេរការពិពណ៌នាផលិតផលឱ្យកាន់តែល្អ ជាភាសាអង់គ្លេស ឬខ្មែរ",
          exact: true,
        })).toBeVisible();
        await expect(page.locator(".landing-demo")).toBeVisible();
        await expect(page.locator(".landing-nav .language-toggle")).toBeVisible();
        await expect(page.locator(".landing-nav .theme-toggle")).toBeVisible();
        await expect(page.locator("#landing-navigation .language-toggle, #landing-navigation .theme-toggle")).toHaveCount(0);
        await expect(page.locator(".landing-nav")).toHaveCSS("top", "0px");
        expect(await page.locator(".landing-nav").evaluate(header => {
          const bounds = header.getBoundingClientRect();
          const controls = Array.from(header.querySelectorAll(".brand, .language-toggle, .theme-toggle, .landing-menu-toggle"))
            .map(el => el.getBoundingClientRect()).filter(rect => rect.width > 0);
          return controls.every(rect => rect.left >= bounds.left && rect.right <= bounds.right && rect.top >= bounds.top && rect.bottom <= bounds.bottom);
        })).toBe(true);
        if (width >= 1200) {
          await expect(page.locator(".landing-menu-toggle")).toBeHidden();
          await expect(page.locator(".landing-nav-links")).toBeVisible();
          await expect(page.locator(".landing-nav-actions")).toBeVisible();
        }
        if (width < 1200) {
          await expect(page.locator("#landing-navigation")).toBeHidden();
          await page.locator(".landing-menu-toggle").click();
          await expect(page.locator("#landing-navigation")).toBeVisible();
          await expect(page.locator("#landing-navigation")).toHaveCSS("opacity", "1");
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
        }
        expect((await new AxeBuilder({ page }).include(".landing-nav").analyze()).violations).toEqual(
          [],
        );
        if (width < 1200) {
          await page.locator(".landing-menu-toggle").click();
          await expect(page.locator("#landing-navigation")).toBeHidden();
        }
        await page.screenshot({
          path: `test-results/landing-${locale}-${theme}-${width}.png`,
          fullPage: true,
        });
      }
      await page.locator("#demo-output-language").selectOption("km");
      await expect(page.locator(".landing-demo-result p")).toHaveAttribute(
        "lang",
        "km",
      );
      await expect(page.locator(".landing-demo-result p")).toContainText(
        "រីករាយ",
      );
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await page.locator("#demo-output-language").selectOption("en");
      expect(apiRequests).toEqual([]);
      await expect(page.locator(".landing-demo-result p")).toHaveAttribute(
        "lang",
        "en",
      );
    });
  }
}

test("landing navigation, persistent light/dark theme and reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("legacy-theme-seeded")) {
      localStorage.setItem("theme", "system");
      sessionStorage.setItem("legacy-theme-seeded", "true");
    }
  });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.locator(".landing-menu-toggle").click();
  await expect(page.locator("html")).toHaveClass(/light/);
  await expect(page.locator("html")).not.toHaveClass(/system/);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("theme")))
    .toBe("light");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("theme")))
    .toBe("dark");
  await page.getByLabel("Navigation language").click();
  await page.getByRole("menuitemradio", { name: "ខ្មែរ" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "km");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.locator(".landing-menu-toggle").click();
  await page.getByLabel("ភាសាក្នុងម៉ឺនុយ").click();
  await page.getByRole("menuitemradio", { name: "English" }).click();
  await page.locator(".landing-menu-toggle").click();
  await page.getByRole("button", { name: "Switch to light mode" }).focus();
  await page.keyboard.press("Escape");
  await expect(page.locator(".landing-menu-toggle")).toBeFocused();
  await expect(page.locator("#landing-navigation")).toBeHidden();
  await page.getByRole("link", { name: "See how it works" }).click();
  await expect(page).toHaveURL(/#how-it-works$/);
  expect(
    await page.evaluate(() => {
      const header = document.querySelector(".landing-nav");
      const section = document.querySelector("#how-it-works");
      return Boolean(
        header &&
        section &&
        section.getBoundingClientRect().top >=
          header.getBoundingClientRect().bottom,
      );
    }),
  ).toBe(true);
  await page.getByRole("link", { name: "Start generating" }).click();
  await expect(page).toHaveURL(/\/register$/);
  await page.goto("/");
  await page.locator(".landing-menu-toggle").click();
  await page.getByRole("link", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});


test("compact header keyboard, dismissal, sticky stacking and exact breakpoint", async ({ page }) => {
  await page.setViewportSize({ width: 1199, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Open navigation menu" });
  const panel = page.locator("#landing-navigation");
  await expect(toggle).toHaveAttribute("aria-controls", "landing-navigation");
  await toggle.focus();
  await page.keyboard.press("Enter");
  const close = page.getByRole("button", { name: "Close navigation menu" });
  await expect(close).toHaveAttribute("aria-expanded", "true");
  await expect(panel).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(panel.getByRole("link", { name: "Features", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveCSS("outline-style", "solid");
  await expect(panel).toBeHidden();
  await toggle.click();
  await page.mouse.click(5, 500);
  await expect(panel).toBeHidden();
  await toggle.click();
  await page.setViewportSize({ width: 1200, height: 900 });
  await expect(page.locator(".landing-menu-toggle")).toBeHidden();
  await expect(page.locator(".landing-menu-toggle")).toHaveAttribute("aria-expanded", "false");
  await page.setViewportSize({ width: 1199, height: 900 });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toBeHidden();
  for (const id of ["features", "how-it-works", "about"]) {
    await toggle.click();
    await panel.locator(`a[href="#${id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect(panel).toBeHidden();
  }
  await expect(page.locator(".landing-nav")).toHaveCSS("position", "sticky");
  expect(await page.locator(".landing-nav").evaluate(el => el.getBoundingClientRect().top)).toBe(0);
  await toggle.click();
  expect(await panel.evaluate(el => {
    const rect = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(rect.x + 20, rect.y + 20));
  })).toBe(true);
  await expect(panel).toHaveCSS("transition-duration", "0s");
});
