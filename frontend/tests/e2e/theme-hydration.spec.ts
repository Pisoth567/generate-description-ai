import { test, expect } from "@playwright/test";

for (const initialTheme of ["light", "dark"] as const) {
  test(`stored ${initialTheme} theme hydrates consistently on landing and Profile`, async ({
    page,
  }) => {
    const hydrationErrors: string[] = [];
    const record = (message: string) => {
      if (/hydrat|server rendered|didn't match/i.test(message))
        hydrationErrors.push(message);
    };
    page.on("pageerror", (error) => record(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning")
        record(message.text());
    });
    await page.route("**/*", (route) =>
      ["localhost", "127.0.0.1"].includes(
        new URL(route.request().url()).hostname,
      )
        ? route.continue()
        : route.abort(),
    );
    await page.addInitScript((theme) => {
      if (!localStorage.getItem("theme")) localStorage.setItem("theme", theme);
    }, initialTheme);
    await page.emulateMedia({
      colorScheme: initialTheme === "light" ? "dark" : "light",
    });

    async function checkTheme(theme: "light" | "dark") {
      await expect(page.locator("html")).toHaveClass(
        new RegExp(`\\b${theme}\\b`),
      );
      await expect(page.locator("html")).not.toHaveClass(/system/);
      const toggle = page.getByRole("button", {
        name: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
        exact: true,
      });
      await expect(toggle).toBeEnabled();
      await expect(
        toggle.locator(theme === "dark" ? ".lucide-sun" : ".lucide-moon"),
      ).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => localStorage.getItem("theme")))
        .toBe(theme);
      expect(hydrationErrors).toEqual([]);
      return toggle;
    }

    await page.goto("/");
    await checkTheme(initialTheme);
    await page.reload();
    const toggle = await checkTheme(initialTheme);
    await toggle.click();
    const changedTheme = initialTheme === "light" ? "dark" : "light";
    await checkTheme(changedTheme);
    // Wait for the Magic UI view transition before navigating away.
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-magicui-theme-vt",
      "active",
    );
    await page.goto("/login");
    await page
      .getByLabel("Email", { exact: true })
      .fill("designer@example.test");
    await page
      .getByLabel("Password", { exact: true })
      .fill("local-test-password");
    await page.getByRole("button", { name: "Login", exact: true }).click();
    await expect(page).toHaveURL(/\/generate$/);
    await page.request.post("/api/auth/preferences", {
      headers: { origin: "http://127.0.0.1:3100" },
      data: { ui_language: "en" },
    });
    await page.goto("/profile");
    await checkTheme(changedTheme);
    await page.reload();
    await checkTheme(changedTheme);
    expect(hydrationErrors).toEqual([]);
  });
}
