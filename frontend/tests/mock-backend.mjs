// Local-only fixtures. No requests leave this process, and no real keys are needed.
import http from "node:http";
const user = {
  id: 1,
  email: "designer@example.test",
  plan: "free",
  credits: 100,
  is_active: true,
  google_linked: false,
  email_verified_at: "2026-01-01T00:00:00Z",
  ui_language: "en",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};
const description =
  "A thoughtful everyday essential.\n\nComfortable to carry, with room for the things you need.";
const khmer =
  "កាបូបសម្រាប់ប្រើប្រាស់ប្រចាំថ្ងៃ។\n\nផលិតពីក្រណាត់កប្បាស មានហោប៉ៅខាងក្នុង និងងាយស្រួលយកតាមខ្លួន។";
const generations = [
  {
    id: 1,
    product_name: "Everyday canvas tote",
    category: "Accessories",
    generated_text: description,
    tone: "friendly",
    language: "English",
    tokens_used: 84,
    created_at: "2026-01-01T10:30:00Z",
  },
  {
    id: 2,
    product_name: "កាបូបក្រណាត់",
    category: "Bags",
    generated_text: khmer,
    tone: "professional",
    language: "Khmer",
    tokens_used: 120,
    created_at: "2026-01-02T10:30:00Z",
  },
];
const packages = [
  { code: "starter", amount: "1.99", currency: "USD", credits: 100 },
  { code: "value", amount: "4.99", currency: "USD", credits: 300 },
  { code: "pro", amount: "9.99", currency: "USD", credits: 700 },
];
const payment = {
  id: 42,
  tran_id: "local-test-transaction",
  package_code: "starter",
  amount: "1.99",
  currency: "USD",
  credits: 100,
  status: "pending",
  created_at: "2026-01-01T10:30:00Z",
  paid_at: null,
};
// A valid non-payable PNG fixture: never a live banking QR.
const qr =
  "data:image/png;base64,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";

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:4311");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks);
  let body = {};
  if (req.headers["content-type"]?.startsWith("multipart/form-data")) {
    const form = await new Response(raw, {
      headers: { "content-type": req.headers["content-type"] },
    }).formData();
    body = Object.fromEntries(form);
  } else body = raw.length ? JSON.parse(raw.toString("utf8")) : {};
  const send = (data, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  if (url.pathname === "/health") return send({ ok: true });
  if (
    url.pathname === "/api/auth/verify-email" ||
    url.pathname === "/api/auth/resend-verification"
  )
    return send({ ok: true });
  if (
    url.pathname === "/api/auth/login" &&
    body.email === "unverified@example.test"
  )
    return send({ detail: { code: "email_verification_required" } }, 403);
  if (url.pathname === "/api/auth/login")
    return send({
      access_token: "local-test-session-never-render",
      expires_in: 3600,
    });
  if (url.pathname === "/api/auth/register") return send(user, 201);
  if (!req.headers.authorization) return send({}, 401);
  if (url.pathname === "/api/auth/preferences") {
    user.ui_language = body.ui_language;
    return send(user);
  }
  if (url.pathname === "/api/auth/me") return send(user);
  if (url.pathname === "/api/generations")
    return send(
      generations.slice(
        Number(url.searchParams.get("skip") || 0),
        Number(url.searchParams.get("limit") || 20),
      ),
    );
  if (url.pathname.startsWith("/api/generations/"))
    return send(
      generations.find((g) => g.id === Number(url.pathname.split("/").pop())) ||
        generations[0],
    );
  if (url.pathname === "/api/generate")
    return send({
      generation_id: 1,
      description: body.language === "Khmer" ? khmer : description,
      language: body.language,
      tone: body.tone,
      tokens_used: 84,
    });
  if (url.pathname === "/api/payments/packages") return send(packages);
  if (url.pathname === "/api/payments" && req.method === "POST")
    return send(
      {
        payment: {
          ...payment,
          ...packages.find((p) => p.code === body.package_code),
          package_code: body.package_code,
        },
        checkout: {
          type: "aba_qr",
          qr_image: qr,
          aba_deeplink: "abamobilebank://local-test-only",
          app_store_url: null,
          play_store_url: null,
        },
      },
      201,
    );
  if (url.pathname === "/api/payments")
    return send([
      payment,
      { ...payment, id: 43, status: "paid", paid_at: payment.created_at },
      { ...payment, id: 44, status: "failed" },
      { ...payment, id: 45, status: "cancelled" },
    ]);
  if (url.pathname.endsWith("/verify"))
    return send({ ...payment, status: "paid", paid_at: payment.created_at });
  return send({}, 404);
});
server.listen(4311, "127.0.0.1");
