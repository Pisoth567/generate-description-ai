import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server.js";

function load(file, dependencies) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    URL,
    Number,
    Uint8Array,
    TextDecoder,
    Response,
    FormData,
    process: { env: {} },
    require: (name) => {
      if (!(name in dependencies))
        throw new Error(`Unexpected dependency ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}
const payment = {
  id: 42,
  tran_id: "trusted-id",
  package_code: "starter",
  amount: "1.99",
  currency: "USD",
  credits: 100,
  status: "pending",
};
const checkout = {
  payment,
  checkout: {
    type: "aba_qr",
    qr_image: "data:image/png;base64,iVBORw0KGgo=",
    aba_deeplink: "abamobilebank://ababank.com?qr=test",
    app_store_url: null,
    play_store_url: null,
  },
};
function component(file, name, props, api) {
  const states = [];
  let cursor = 0;
  let effects = [];
  let refreshes = 0;
  const toasts = [];
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const modules = {
    react: {
      useState: (initial) => {
        const index = cursor++;
        if (!(index in states)) states[index] = initial;
        return [
          states[index],
          (value) => {
            states[index] =
              typeof value === "function" ? value(states[index]) : value;
          },
        ];
      },
      useRef: (initial) => {
        const index = cursor++;
        if (!(index in states)) states[index] = { current: initial };
        return states[index];
      },
      useEffect: (effect) => {
        effects.push(effect);
      },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "next/link": { default: "a" },
    "@/lib/client": { api },
    "./ui/button": { Button: "button" },
    "./ui/badge": { Badge: "span" },
    "./ui/card": { Card: "section", CardContent: "div" },
    "./ui/alert": { Alert: "aside", AlertDescription: "p" },
    sonner: {
      toast: Object.fromEntries(
        ["success", "info", "error"].map((kind) => [
          kind,
          (message) => toasts.push({ kind, message }),
        ]),
      ),
    },
    "./ui/dialog": {
      Dialog: "dialog",
      DialogContent: "dialog-content",
      DialogHeader: "header",
      DialogTitle: "h2",
      DialogDescription: "p",
      DialogFooter: "footer",
      DialogClose: "dialog-close",
    },
    "./ui": { ErrorMessage: "error", LoadingCards: "loading" },
    "./session": {
      useSession: () => ({
        refresh: async () => {
          refreshes++;
          await api("/api/auth/me");
        },
      }),
    },
    "./qr-checkout": { QRCheckout: "qr-checkout" },
  };
  const exported = load(file, modules);
  return {
    render: () => {
      cursor = 0;
      return exported[name](props);
    },
    effects: async () => {
      const pending = effects;
      effects = [];
      pending.forEach((fn) => fn());
      await new Promise((resolve) => setImmediate(resolve));
    },
    refreshes: () => refreshes,
    toasts: () => toasts,
  };
}
function nodes(tree) {
  return !tree || typeof tree !== "object"
    ? []
    : Array.isArray(tree)
      ? tree.flatMap(nodes)
      : [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  return tree == null || typeof tree === "boolean"
    ? ""
    : typeof tree !== "object"
      ? String(tree)
      : Array.isArray(tree)
        ? tree.map(text).join(" ")
        : text(tree.props?.children);
}
function button(tree, label) {
  return nodes(tree).find(
    (node) => node.type === "button" && text(node) === label,
  );
}

test("Pricing posts only package code to BFF and displays received QR checkout", async () => {
  const calls = [];
  const f = component(
    "components/pricing.tsx",
    "Pricing",
    {},
    async (path, body) => {
      calls.push({ path, body });
      return body
        ? checkout
        : [{ code: "starter", amount: "1.99", currency: "USD", credits: 100 }];
    },
  );
  assert.equal(
    nodes(f.render()).some((node) => node.type === "qr-checkout"),
    false,
  );
  await f.effects();
  await button(f.render(), "Buy Credits").props.onClick();
  assert.equal(
    nodes(f.render()).find((node) => node.type === "dialog").props.open,
    true,
  );
  assert.equal(calls[1].path, "/api/payments");
  assert.equal(JSON.stringify(calls[1].body), '{"package_code":"starter"}');
  assert.equal(
    nodes(f.render()).find((node) => node.type === "qr-checkout").props
      .checkout,
    checkout,
  );
  assert.equal(
    nodes(f.render()).some((node) => node.type === "form"),
    false,
  );
});

test("QR checkout renders sanitized image and explicit deep link; creation is pending", () => {
  const f = component(
    "components/qr-checkout.tsx",
    "QRCheckout",
    { checkout },
    () => {
      throw new Error("No request before click");
    },
  );
  const tree = f.render();
  assert.equal(
    nodes(tree).find((n) => n.type === "img").props.src,
    checkout.checkout.qr_image,
  );
  assert.ok(nodes(tree).find((n) => n.type === "img").props.alt);
  assert.equal(
    nodes(tree).find((n) => text(n) === "Open ABA Mobile").props.href,
    checkout.checkout.aba_deeplink,
  );
  assert.match(text(tree), /pending/);
  assert.doesNotMatch(
    text(tree),
    /Payment successful|credits added|qr_image|qrString/,
  );
  assert.equal(f.refreshes(), 0);
});

for (const status of ["pending", "paid", "failed", "cancelled", "503"]) {
  test(`manual verification handles ${status} without new purchase`, async () => {
    const calls = [];
    const errors = load("lib/errors.ts", {});
    const f = component(
      "components/qr-checkout.tsx",
      "QRCheckout",
      { checkout },
      async (path, body) => {
        calls.push({ path, body });
        if (status === "503") throw new Error(errors.errorMessage(503, path));
        return { ...payment, status };
      },
    );
    await button(f.render(), "Verify payment").props.onClick();
    const tree = f.render();
    assert.equal(calls[0].path, "/api/payments/42/verify");
    assert.equal(JSON.stringify(calls[0].body), "{}");
    assert.equal(
      calls.some((c) => c.path === "/api/payments"),
      false,
    );
    assert.equal(f.refreshes(), status === "paid" ? 1 : 0);
    if (status === "paid") {
      assert.equal(calls[1].path, "/api/auth/me");
      assert.match(text(tree), /100\s+credits added/);
      assert.ok(
        f
          .toasts()
          .some(
            (t) =>
              t.kind === "success" &&
              t.message === "Payment confirmed. Your credits have been added.",
          ),
      );
    } else if (status === "pending") {
      assert.match(text(tree), /Payment has not been confirmed yet/);
      assert.ok(
        f
          .toasts()
          .some(
            (t) =>
              t.kind === "info" &&
              t.message ===
                "Payment has not been confirmed yet. Complete the payment and try again.",
          ),
      );
    } else if (status === "503") {
      assert.ok(
        f
          .toasts()
          .some(
            (t) =>
              t.kind === "error" &&
              t.message ===
                "Payment verification is temporarily unavailable. Please try again.",
          ),
      );
      assert.equal(
        nodes(tree).find((n) => n.type === "error").props.message,
        "Payment verification is temporarily unavailable. Please try again.",
      );
    } else
      assert.match(
        text(tree),
        new RegExp(
          `This payment ${status === "failed" ? "failed" : "was cancelled"}`,
        ),
      );
    assert.equal(
      nodes(tree).some((n) => n.type === "img"),
      status === "pending" || status === "503",
    );
  });
}

test("BFF keeps JWT server-side, returns no-store QR payload, rejects client overrides", async () => {
  const calls = [];
  const writes = [];
  class BackendError extends Error {
    constructor(status) {
      super("safe error");
      this.status = status;
    }
  }
  const { proxy } = load("lib/bff.ts", {
    "server-only": {},
    "next/server": { NextResponse },
    "next/headers": {
      cookies: async () => ({
        get: (name) =>
          name === "access_token" ? { value: "private-jwt" } : undefined,
        set: (...args) => writes.push(args),
      }),
    },
    "./backend": {
      BackendError,
      backend: async (...args) => {
        calls.push(args);
        return checkout;
      },
    },
    "./session": {
      cookieOptions: { httpOnly: true, sameSite: "lax", path: "/" },
    },
  });
  const request = (body) =>
    new Request("http://localhost:3000/api/payments", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        host: "localhost:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  const response = await proxy(
    request({ package_code: "starter" }),
    "/api/payments",
  );
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const raw = await response.text();
  assert.doesNotMatch(raw, /private-jwt|access_token|Bearer/);
  assert.equal(JSON.parse(raw).checkout.type, "aba_qr");
  assert.equal(calls[0][1], "private-jwt");
  assert.equal(writes[0][2].httpOnly, true);
  for (const override of ["amount", "credits", "currency", "tran_id"])
    assert.equal(
      (
        await proxy(
          request({ package_code: "starter", [override]: "untrusted" }),
          "/api/payments",
        )
      ).status,
      422,
    );
  assert.equal(calls.length, 1);
  for (const file of [
    "components/pricing.tsx",
    "components/qr-checkout.tsx",
    "lib/client.ts",
  ])
    assert.doesNotMatch(
      readFileSync(file, "utf8"),
      /localStorage|Bearer|access_token|dangerouslySetInnerHTML/,
    );
});

test("Pricing ignores repeated Buy calls while the purchase request is pending", async () => {
  let resolvePurchase;
  let purchases = 0;
  const f = component(
    "components/pricing.tsx",
    "Pricing",
    {},
    async (path, body) => {
      if (body) {
        purchases++;
        return new Promise((resolve) => {
          resolvePurchase = resolve;
        });
      }
      return [
        { code: "starter", amount: "1.99", currency: "USD", credits: 100 },
      ];
    },
  );
  f.render();
  await f.effects();
  const buy = button(f.render(), "Buy Credits").props.onClick;
  const first = buy();
  await buy();
  assert.equal(purchases, 1);
  assert.equal(button(f.render(), "Preparing checkout…").props.disabled, true);
  resolvePurchase(checkout);
  await first;
  assert.equal(
    nodes(f.render()).find((node) => node.type === "dialog").props.open,
    true,
  );
  nodes(f.render())
    .find((node) => node.type === "dialog")
    .props.onOpenChange(false);
  assert.equal(
    nodes(f.render()).some((node) => node.type === "qr-checkout"),
    false,
  );
  assert.equal(purchases, 1);
});
