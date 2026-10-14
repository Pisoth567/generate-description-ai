import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";
function seo(origin) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync("lib/seo.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    { exports, URL, process: { env: { SITE_URL: origin } } },
  );
  return exports;
}
test("SEO never falls back to localhost and rejects credentials/non-HTTPS origins", () => {
  for (const value of [
    "",
    "invalid",
    "http://example.com",
    "https://localhost:3000",
    "https://127.0.0.1",
    "https://[::1]",
    "https://user:password@example.com",
  ]) {
    const loaded = seo(value);
    assert.equal(loaded.siteOrigin(), undefined);
    assert.equal(loaded.publicMetadata("Home", "/").alternates, undefined);
  }
});
test("SEO builds explicit canonical URLs from the configured public origin", () => {
  const loaded = seo("https://shop.example/path?query=value");
  assert.equal(loaded.siteOrigin(), "https://shop.example");
  const metadata = loaded.publicMetadata("Login", "/login");
  assert.equal(metadata.alternates.canonical, "https://shop.example/login");
  assert.equal(metadata.openGraph.url, "https://shop.example/login");
  assert.equal(metadata.twitter.card, "summary");
});
