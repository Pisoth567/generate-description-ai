import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { backend, BackendError } from "./backend";
import { cookieOptions } from "./session";
import type { User } from "./types";
function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
function safeUser(user: User): User {
  return {
    id: user.id,
    email: user.email,
    is_active: user.is_active,
    google_linked: user.google_linked === true,
    avatar_id: user.avatar_id ?? null,
    email_verified_at: user.email_verified_at,
    ui_language: user.ui_language,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}
export async function proxy(request: Request, path: string) {
  const jar = await cookies();
  try {
    if (request.method === "POST" || request.method === "PATCH") {
      const origin = request.headers.get("origin");
      let source: URL;
      try {
        source = new URL(origin ?? "");
      } catch {
        throw new BackendError(403);
      }
      const target = new URL(request.url);
      // Next's internal request URL can normalize 127.0.0.1 to localhost.
      // The browser-controlled Host header preserves the actual requested host.
      if (
        source.host !== request.headers.get("host") ||
        source.protocol !== target.protocol ||
        request.headers.get("sec-fetch-site") === "cross-site"
      )
        throw new BackendError(403);
      if (path === "/api/auth/logout") {
        jar.set("access_token", "", { ...cookieOptions, maxAge: 0 });
        return json({ ok: true });
      }
    }
    const publicRoute =
      path === "/api/auth/login" ||
      path === "/api/auth/register" ||
      path === "/api/auth/verify-email" ||
      path === "/api/auth/resend-verification";
    const token = jar.get("access_token")?.value;
    if (!publicRoute && !token) throw new BackendError(401);
    let body: unknown;
    if (request.method === "POST" || request.method === "PATCH") {
      const bytes = await limitedBody(request, 65536);
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        throw new BackendError(400);
      try {
        body = JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        throw new BackendError(400);
      }
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw new BackendError(422);
    }
    if (path === "/api/auth/login") {
      const result = await backend<{
        access_token: string;
        expires_in: number;
      }>(path, undefined, body);
      if (
        typeof result.access_token !== "string" ||
        !Number.isInteger(result.expires_in) ||
        result.expires_in <= 0
      )
        throw new BackendError(502);
      jar.set("access_token", result.access_token, {
        ...cookieOptions,
        maxAge: result.expires_in,
      });
      return json({ ok: true });
    }
    let target = path;
    if (request.method === "GET" && path === "/api/generations") {
      const params = new URL(request.url).searchParams;
      const skip = params.get("skip") ?? "0",
        limit = params.get("limit") ?? "20";
      if (
        !/^\d+$/.test(skip) ||
        !/^\d+$/.test(limit) ||
        Number(limit) < 1 ||
        Number(limit) > 100 ||
        !Number.isSafeInteger(Number(skip))
      )
        throw new BackendError(422);
      target += `?skip=${skip}&limit=${limit}`;
    }
    const data = await backend<unknown>(
      target,
      publicRoute ? undefined : token,
      body,
      request.method === "PATCH" ? "PATCH" : undefined,
    );
    if (
      path === "/api/auth/me" ||
      path === "/api/auth/register" ||
      path === "/api/profile/avatar"
    )
      return json(
        safeUser(data as User),
        path.endsWith("register") ? 201 : 200,
      );
    return json(data);
  } catch (error) {
    const failure =
      error instanceof BackendError ? error : new BackendError(502, path);
    if (failure.status === 401)
      jar.set("access_token", "", { ...cookieOptions, maxAge: 0 });
    return json(
      { error: { message: failure.message, code: failure.code } },
      failure.status,
    );
  }
}

async function limitedBody(
  request: Request,
  max: number,
): Promise<ArrayBuffer> {
  const reader = request.body?.getReader();
  if (!reader) throw new BackendError(400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new BackendError(413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result.buffer;
}
