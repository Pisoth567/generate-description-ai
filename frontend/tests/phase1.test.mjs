import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server.js";
function fixture(token = "server-only-test-jwt") {
  const calls = [],
    writes = [];
  class BackendError extends Error {
    constructor(status, path = "", code = "") {
      super("Safe error");
      this.path = path;
      this.status = status;
      this.code = code;
    }
  }
  const exports = {};
  const dependencies = {
    "server-only": {},
    "next/server": { NextResponse },
    "next/headers": {
      cookies: async () => ({
        get: () => (token ? { value: token } : undefined),
        set: (...args) => writes.push(args),
      }),
    },
    "./session": {
      cookieOptions: { httpOnly: true, sameSite: "lax", path: "/" },
    },
    "./backend": {
      BackendError,
      backend: async (path, token, body) => {
        calls.push({ path, token, body });
        return path.endsWith("/login")
          ? { access_token: "must-not-reach-browser", expires_in: 3600 }
          : { ok: true };
      },
    },
  };
  vm.runInNewContext(
    ts.transpileModule(readFileSync("lib/bff.ts", "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      URL,
      Uint8Array,
      TextDecoder,
      Response,
      FormData,
      require: (name) => dependencies[name],
    },
  );
  return { ...exports, calls, writes };
}
function request(path, body, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000" + path, {
    method: "POST",
    headers: {
      origin,
      host: "localhost:3000",
      ...(body instanceof FormData
        ? {}
        : { "content-type": "application/json" }),
    },
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}
test("verification and resend remain public without granting a session", async () => {
  for (const path of [
    "/api/auth/verify-email",
    "/api/auth/resend-verification",
  ]) {
    const f = fixture(null);
    const response = await f.proxy(
      request(path, { email: "test@example.com", code: "123456" }),
      path,
    );
    assert.equal(response.status, 200);
    assert.equal(f.calls[0].token, undefined);
    assert.equal(f.writes.length, 0);
    assert.doesNotMatch(await response.text(), /123456|access_token/);
  }
});
test("multipart forwards image and text with server-only authorization", async () => {
  const f = fixture();
  const data = new FormData();
  data.set("product_name", "Product");
  data.set("features", "One\nTwo");
  data.set(
    "image",
    new Blob(["test-image"], { type: "image/png" }),
    "test.png",
  );
  const response = await f.proxy(
    request("/api/generate", data),
    "/api/generate",
  );
  assert.equal(response.status, 200);
  assert.equal(f.calls[0].token, "server-only-test-jwt");
  assert.equal(f.calls[0].body.get("features"), "One\r\nTwo");
  assert.equal(await f.calls[0].body.get("image").text(), "test-image");
  assert.doesNotMatch(
    await response.text(),
    /server-only-test-jwt|access_token/,
  );
});
test("actual body size bound rejects without contacting backend", async () => {
  const f = fixture();
  const response = await f.proxy(
    request("/api/generate", { features: "x".repeat(6 * 1024 * 1024 + 1) }),
    "/api/generate",
  );
  assert.equal(response.status, 413);
  assert.equal(f.calls.length, 0);
});
test("cross-origin mutation and unauthenticated generation are denied", async () => {
  const f = fixture();
  assert.equal(
    (
      await f.proxy(
        request("/api/generate", {}, "https://evil.example"),
        "/api/generate",
      )
    ).status,
    403,
  );
  assert.equal(f.calls.length, 0);
  const anon = fixture(null);
  assert.equal(
    (await anon.proxy(request("/api/generate", {}), "/api/generate")).status,
    401,
  );
  assert.equal(anon.calls.length, 0);
});
test("login JWT only enters HttpOnly cookie", async () => {
  const f = fixture(null);
  const response = await f.proxy(
    request("/api/auth/login", {
      email: "test@example.com",
      password: "test-only-password",
    }),
    "/api/auth/login",
  );
  assert.equal(response.status, 200);
  assert.equal(f.writes[0][2].httpOnly, true);
  assert.equal(f.writes[0][2].sameSite, "lax");
  assert.doesNotMatch(
    await response.text(),
    /must-not-reach-browser|access_token/,
  );
});

test("malformed multipart is a safe client error and never reaches backend", async () => {
  const f = fixture();
  const malformed = new Request("http://localhost:3000/api/generate", {
    method: "POST",
    headers: { origin: "http://localhost:3000", host: "localhost:3000", "content-type": "multipart/form-data" },
    body: "invalid multipart",
  });
  const response = await f.proxy(malformed, "/api/generate");
  assert.equal(response.status, 400);
  assert.equal(f.calls.length, 0);
});
