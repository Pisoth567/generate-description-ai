import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { backend, BackendError } from "./backend";
import { cookieOptions } from "./session";
import type { User } from "./types";

const names = ["state", "verifier", "nonce", "mode", "session"] as const;
const cookieName = (name: string) => `${process.env.NODE_ENV === "production" ? "__Host-" : ""}google_oauth_${name}`;
const digest = (value: string) => createHash("sha256").update(value).digest("base64url");
function equal(a: string, b: string) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function config() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) throw new Error("Unavailable");
  const url = new URL(redirectUri);
  if (url.pathname !== "/api/auth/google/callback" || url.search || url.hash || url.username || url.password ||
      (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) throw new Error("Unavailable");
  return { clientId, clientSecret, redirectUri, origin: url.origin };
}
function redirect(request: Request, path: string, origin?: string) {
  // Only fixed application paths are supplied; provider error text is never reflected.
  const response = NextResponse.redirect(new URL(path, origin ?? new URL(request.url).origin), 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
function clear(response: NextResponse) {
  for (const name of names) response.cookies.set(cookieName(name), "", { ...cookieOptions, maxAge: 0 });
  return response;
}

export async function startGoogle(request: Request) {
  const mode = new URL(request.url).searchParams.get("mode") ?? "login";
  if (mode !== "login" && mode !== "link") return clear(redirect(request, "/login?error=google_failed"));
  let settings: ReturnType<typeof config>;
  try { settings = config(); }
  catch { return clear(redirect(request, mode === "link" ? "/account?error=google_unavailable" : "/login?error=google_unavailable")); }
  const jar = await cookies();
  const token = jar.get("access_token")?.value;
  if (mode === "link") {
    try {
      if (!token) throw new Error("Session required");
      await backend<User>("/api/auth/me", token);
    } catch { return clear(redirect(request, "/login?expired=1", settings.origin)); }
  }
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: settings.clientId, redirect_uri: settings.redirectUri,
    response_type: "code", scope: "openid email", state, nonce,
    code_challenge: digest(verifier), code_challenge_method: "S256", prompt: "select_account" }).toString();
  const response = redirect(request, url.toString(), settings.origin);
  const values = { state, verifier, nonce, mode, session: mode === "link" ? digest(token!) : "login" };
  for (const name of names) response.cookies.set(cookieName(name), values[name], { ...cookieOptions, maxAge: 600 });
  return response;
}

export async function callbackGoogle(request: Request) {
  const jar = await cookies();
  const read = (name: string) => jar.get(cookieName(name))?.value;
  const mode = read("mode");
  let origin: string | undefined;
  const failed = () => clear(redirect(request, mode === "link" ? "/account?error=google_failed" : "/login?error=google_failed", origin));
  try {
    const settings = config();
    origin = settings.origin;
    const params = new URL(request.url).searchParams;
    const code = params.get("code"), state = params.get("state");
    const storedState = read("state"), verifier = read("verifier"), nonce = read("nonce");
    if (params.has("error") || !code || code.length > 8192 || !state || !storedState || !equal(state, storedState) ||
        params.getAll("code").length !== 1 || params.getAll("state").length !== 1 ||
        !verifier || !nonce || (mode !== "login" && mode !== "link")) return failed();
    const token = jar.get("access_token")?.value;
    if (mode === "link" && (!token || !equal(read("session") ?? "", digest(token)))) return failed();
    const exchange = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: settings.clientId,
        client_secret: settings.clientSecret, redirect_uri: settings.redirectUri, code_verifier: verifier }),
    });
    if (!exchange.ok) return failed();
    const result = await exchange.json() as { id_token?: unknown };
    if (typeof result.id_token !== "string" || !result.id_token || result.id_token.length > 16384) return failed();
    const body = { id_token: result.id_token, nonce };
    if (mode === "link") {
      const linked = await backend<{ linked: boolean }>("/api/auth/google/link", token, body);
      if (linked.linked !== true) return failed();
      return clear(redirect(request, "/account?google=linked", origin));
    }
    const login = await backend<{ access_token: string; expires_in: number }>("/api/auth/google", undefined, body);
    if (typeof login.access_token !== "string" || !login.access_token || !Number.isInteger(login.expires_in) || login.expires_in <= 0) return failed();
    const response = clear(redirect(request, "/generate", origin));
    response.cookies.set("access_token", login.access_token, { ...cookieOptions, maxAge: login.expires_in });
    response.cookies.set("pending_payment", "", { ...cookieOptions, maxAge: 0 });
    return response;
  } catch (error) {
    if (mode === "login" && error instanceof BackendError && error.status === 409)
      return clear(redirect(request, "/login?error=google_link_required", origin));
    if (!origin || (error instanceof BackendError && error.status === 503))
      return clear(redirect(request, mode === "link" ? "/account?error=google_unavailable" : "/login?error=google_unavailable", origin));
    return failed();
  }
}
