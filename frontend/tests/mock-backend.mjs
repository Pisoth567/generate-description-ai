// Local-only fixtures. No requests leave this process, and no real keys are needed.
import http from "node:http";
const user = {
  id: 1,
  email: "designer@example.test",
  is_active: true,
  google_linked: false,
  avatar_id: null,
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
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:4311");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks);
  let body = {};
  body = raw.length ? JSON.parse(raw.toString("utf8")) : {};
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
  if (url.pathname === "/api/profile/avatar" && req.method === "PATCH") {
    user.avatar_id = body.avatar_id;
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
  return send({}, 404);
});
server.listen(4311, "127.0.0.1");
