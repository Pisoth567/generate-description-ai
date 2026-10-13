import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { backend, BackendError } from "./backend";
import { cookieOptions } from "./session";
import type { PaymentCheckoutResponse, User } from "./types";
function json(data: unknown, status = 200) { return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }); }
function safeUser(user: User): User { return { id: user.id, email: user.email, plan: user.plan, credits: user.credits, is_active: user.is_active, created_at: user.created_at, updated_at: user.updated_at }; }
export async function proxy(request: Request, path: string) {
  const jar = await cookies();
  try {
    if (request.method === "POST") {
      const origin = request.headers.get("origin");
      let source: URL;
      try { source = new URL(origin ?? ""); } catch { throw new BackendError(403); }
      const target = new URL(request.url);
      // Next's internal request URL can normalize 127.0.0.1 to localhost.
      // The browser-controlled Host header preserves the actual requested host.
      if (source.host !== request.headers.get("host") || source.protocol !== target.protocol || request.headers.get("sec-fetch-site") === "cross-site") throw new BackendError(403);
      if (path === "/api/auth/logout") {
        jar.set("access_token", "", { ...cookieOptions, maxAge: 0 });
        jar.set("pending_payment", "", { ...cookieOptions, maxAge: 0 });
        return json({ ok: true });
      }
    }
    const publicRoute = path === "/api/auth/login" || path === "/api/auth/register";
    const token = jar.get("access_token")?.value;
    if (!publicRoute && !token) throw new BackendError(401);
    let body: unknown;
    if (request.method === "POST") {
      if (path.endsWith("/verify")) body = {};
      else {
        if (!request.headers.get("content-type")?.startsWith("application/json")) throw new BackendError(400);
        try { body = await request.json(); } catch { throw new BackendError(400); }
        if (!body || typeof body !== "object" || Array.isArray(body)) throw new BackendError(422);
        if (path === "/api/payments") {
          const value = body as Record<string, unknown>;
          if (Object.keys(value).length !== 1 || typeof value.package_code !== "string") throw new BackendError(422);
          body = { package_code: value.package_code };
        }
      }
    }
    if (path === "/api/auth/login") {
      const result = await backend<{ access_token: string; expires_in: number }>(path, undefined, body);
      if (typeof result.access_token !== "string" || !Number.isInteger(result.expires_in) || result.expires_in <= 0) throw new BackendError(502);
      jar.set("access_token", result.access_token, { ...cookieOptions, maxAge: result.expires_in });
      jar.set("pending_payment", "", { ...cookieOptions, maxAge: 0 });
      return json({ ok: true });
    }
    let target = path;
    if (request.method === "GET" && (path === "/api/generations" || path === "/api/payments")) {
      const params = new URL(request.url).searchParams;
      const skip = params.get("skip") ?? "0", limit = params.get("limit") ?? "20";
      if (!/^\d+$/.test(skip) || !/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 100 || !Number.isSafeInteger(Number(skip))) throw new BackendError(422);
      target += `?skip=${skip}&limit=${limit}`;
    }
    const data = await backend<unknown>(target, publicRoute ? undefined : token, body);
    if (path === "/api/auth/me" || path === "/api/auth/register") return json(safeUser(data as User), path.endsWith("register") ? 201 : 200);
    if (path === "/api/payments" && request.method === "POST") {
      const checkout = data as PaymentCheckoutResponse;
      const allowed = process.env.PAYWAY_CHECKOUT_ORIGIN ?? "https://checkout-sandbox.payway.com.kh";
      let url: URL;
      try { url = new URL(checkout.checkout_url); } catch { throw new BackendError(502, path); }
      if (!["https://checkout-sandbox.payway.com.kh", "https://checkout.payway.com.kh"].includes(allowed) || url.origin !== allowed || url.username || url.password || url.hash || !Number.isSafeInteger(checkout.payment_id) || checkout.payment_id <= 0 || !checkout.fields || Object.values(checkout.fields).some(v => typeof v !== "string")) throw new BackendError(502, path);
      jar.set("pending_payment", String(checkout.payment_id), { ...cookieOptions, maxAge: 86400 });
      return json(checkout, 201);
    }
    return json(data);
  } catch (error) {
    const failure = error instanceof BackendError ? error : new BackendError(502, path);
    if (failure.status === 401) jar.set("access_token", "", { ...cookieOptions, maxAge: 0 });
    return json({ error: { message: failure.message } }, failure.status);
  }
}
