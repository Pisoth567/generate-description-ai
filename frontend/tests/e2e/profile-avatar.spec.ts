import { test, expect } from "@playwright/test";
import { readdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) =>
    ["localhost", "127.0.0.1"].includes(new URL(route.request().url()).hostname)
      ? route.continue()
      : route.abort(),
  );
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("designer@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("local-test-password");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/generate$/);
  await page.request.post("/api/auth/preferences", {
    headers: { origin: "http://127.0.0.1:3100" },
    data: { ui_language: "en" },
  });
  await page.request.patch("/api/profile/avatar", {
    headers: { origin: "http://127.0.0.1:3100" },
    data: { avatar_id: null },
  });
  await page.goto("/profile");
});

test("avatar selection, persistence, safe failure, reset, fallback, focus and shared logout", async ({
  page,
}) => {
  // Radix hides background content from the accessibility tree while modal.
  const card = page.getByRole("region", {
    name: "Profile",
    exact: true,
    includeHidden: true,
  });
  await expect(
    card.getByText("designer@example.test", { exact: true }),
  ).toBeVisible();
  await expect(card.getByText("Verified", { exact: true })).toBeVisible();
  await expect(card.getByText("Member since")).toBeVisible();
  await expect(card.getByText("Jan 1, 2026")).toBeVisible();
  await expect(
    card.getByRole("img", { name: "Initials avatar: designer@example.test" }),
  ).toHaveText("D");
  await expect(card.getByText("Google Connected", { exact: true })).toHaveCount(
    0,
  );
  const change = page.getByRole("button", {
    name: "Change avatar",
    exact: true,
  });
  await change.click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: /^Select avatar \d+$/ }),
  ).toHaveCount(
    readdirSync("public/avatars").filter((name) => name.endsWith(".jpg"))
      .length,
  );
  expect(
    await dialog
      .locator("img")
      .evaluateAll((images) =>
        images
          .map((image) => new URL((image as HTMLImageElement).src).pathname)
          .sort(),
      ),
  ).toEqual(
    readdirSync("public/avatars")
      .filter((name) => name.endsWith(".jpg"))
      .map((name) => `/avatars/${name}`)
      .sort(),
  );
  await expect
    .poll(() =>
      dialog
        .locator("img")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  await dialog
    .getByRole("button", { name: "Select avatar 4", exact: true })
    .focus();
  await page.keyboard.press("Space");
  await expect(
    dialog.getByRole("button", { name: "Select avatar 4", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(change).toBeFocused();
  await expect(card.locator("img")).toHaveAttribute(
    "src",
    /^(?:http:\/\/127\.0\.0\.1:3100)?\/avatars\/avatar-04\.jpg$/,
  );
  await expect(
    page.getByRole("button", { name: "Profile menu" }).locator("img"),
  ).toHaveAttribute(
    "src",
    /^(?:http:\/\/127\.0\.0\.1:3100)?\/avatars\/avatar-04\.jpg$/,
  );
  await expect(page.getByText("Avatar updated successfully.")).toBeVisible();
  await page.reload();
  await expect(card.locator("img")).toHaveAttribute(
    "src",
    /^(?:http:\/\/127\.0\.0\.1:3100)?\/avatars\/avatar-04\.jpg$/,
  );
  await change.click();
  await dialog
    .getByRole("button", { name: "Select avatar 5", exact: true })
    .click();
  await page.route("**/api/profile/avatar", (route) =>
    route.fulfill({ status: 500, json: { detail: "private-provider-detail" } }),
  );
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Could not update your avatar. Please try again.",
  );
  await expect(page.getByText("private-provider-detail")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Select avatar 5", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(card.locator("img").first()).toHaveAttribute(
    "src",
    /^(?:http:\/\/127\.0\.0\.1:3100)?\/avatars\/avatar-04\.jpg$/,
  );
  await page.keyboard.press("Escape");
  await expect(change).toBeFocused();
  await page.unroute("**/api/profile/avatar");
  await page.route("**/avatars/avatar-04.jpg", (route) => route.abort());
  await page.reload();
  await expect(
    card.getByRole("img", { name: "Initials avatar: designer@example.test" }),
  ).toBeVisible();
  await change.click();
  await dialog.getByRole("button", { name: "Use initials" }).click();
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Profile menu" }).getByRole("img"),
  ).toHaveText("D");
  await page.reload();
  await expect(card.getByRole("img")).toHaveText("D");
  await card.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    (await page.context().cookies()).some(
      (cookie) => cookie.name === "access_token",
    ),
  ).toBe(false);
  expect((await page.request.get("/api/auth/me")).status()).toBe(401);
});

test("English and Khmer, both themes, all requested widths and accessible dialog", async ({
  page,
}) => {
  test.setTimeout(180000);
  for (const locale of ["en", "km"] as const) {
    if (locale === "km") {
      await page.getByRole("button", { name: "Navigation language" }).click();
      await page.getByRole("menuitemradio", { name: "ខ្មែរ" }).click();
      await expect(page.locator("html")).toHaveAttribute("lang", "km");
    }
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => {
        localStorage.setItem("theme", value);
      }, theme);
      await page.reload();
      await expect(page.locator("html")).toHaveClass(new RegExp(theme));
      for (const width of [320, 375, 390, 768, 1024, 1200, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page
          .getByRole("button", {
            name: locale === "en" ? "Change avatar" : "ប្ដូររូបតំណាង",
            exact: true,
          })
          .click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(dialog).toHaveCSS("opacity", "1");
        const box = await dialog.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        expect(
          await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
        ).toBe(true);
        await expect(
          dialog.getByRole("button", {
            name: locale === "en" ? "Save" : "រក្សាទុក",
            exact: true,
          }),
        ).toBeVisible();
        if (width === 320 || width === 1440) {
          await page.screenshot({
            path: test
              .info()
              .outputPath(`picker-${locale}-${theme}-${width}.png`),
          });
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
        }
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        if (width === 320 || width === 1440)
          await page.screenshot({
            path: test
              .info()
              .outputPath(`profile-${locale}-${theme}-${width}.png`),
          });
      }
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
  }
  await page.getByRole("button", { name: "ភាសាក្នុងម៉ឺនុយ" }).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();
});

test("connected and unverified status reflect safe returned profile", async ({
  page,
}) => {
  await page.route("**/api/profile/avatar", async (route) => {
    const response = await route.fetch();
    const user = await response.json();
    await route.fulfill({
      json: { ...user, google_linked: true, email_verified_at: null },
    });
  });
  await page.getByRole("button", { name: "Change avatar" }).click();
  await page.getByRole("button", { name: "Use initials" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByText("Google Connected", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Not verified", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Link Google account" }),
  ).toHaveCount(0);
});
