import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const exports = {};
vm.runInNewContext(
  ts.transpileModule(readFileSync("lib/avatars.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  { exports },
);

test("allowlist matches shipped JPGs and rejects unsafe image sources", () => {
  assert.deepEqual(
    Array.from(exports.AVATAR_IDS).sort(),
    readdirSync("public/avatars")
      .filter((name) => name.endsWith(".jpg"))
      .map((name) => name.slice(0, -4))
      .sort(),
  );
  for (const id of exports.AVATAR_IDS)
    assert.equal(exports.avatarSource(id), `/avatars/${id}.jpg`);
  for (const id of [
    null,
    undefined,
    "",
    "avatar-99",
    "../../secret",
    "https://example.com/x.jpg",
    "/avatars/avatar-01.jpg",
  ]) {
    assert.equal(exports.avatarSource(id), null);
  }
});

test("initial uses email local part without inventing a name", () => {
  assert.equal(exports.emailInitial("pisoth887@gmail.com"), "P");
  assert.equal(exports.emailInitial("designer@example.com"), "D");
  assert.equal(exports.emailInitial("_s@example.com"), "S");
  for (const email of ["@example.com", "", null, undefined, "...", 42])
    assert.equal(exports.emailInitial(email), "?");
});
