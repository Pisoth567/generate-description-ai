import "server-only";
import { errorMessage } from "./errors";
export class BackendError extends Error {
  constructor(
    public status: number,
    path = "",
    public code = "",
  ) {
    super(errorMessage(status, path));
  }
}
export async function backend<T>(
  path: string,
  token?: string,
  body?: unknown,
): Promise<T> {
  try {
    const base = process.env.BACKEND_URL;
    if (!base) throw new BackendError(502, path);
    const response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      method: body === undefined ? "GET" : "POST",
      cache: "no-store",
      redirect: "error",
      headers: {
        Accept: "application/json",
        ...(body === undefined || body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined
        ? {}
        : { body: body instanceof FormData ? body : JSON.stringify(body) }),
      signal: AbortSignal.timeout(90000),
    });
    if (!response.ok) {
      let code = "";
      try {
        const failure = await response.json();
        const candidate = failure?.detail?.code;
        if (
          [
            "email_verification_required",
            "invalid_verification_code",
            "email_configuration_required",
            "email_delivery_unavailable",
            "invalid_image",
            "image_too_large",
            "image_model_unavailable",
          ].includes(candidate)
        )
          code = candidate;
      } catch {}
      throw new BackendError(response.status, path, code);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof BackendError) throw error;
    throw new BackendError(502, path);
  }
}
