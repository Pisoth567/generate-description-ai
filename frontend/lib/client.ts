import { errorMessage } from "./errors";
export class ApiError extends Error {
  constructor(
    message: string,
    public code = "",
  ) {
    super(message);
  }
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      ...(body === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
  } catch {
    throw new Error(
      "Could not connect. Please check your connection and try again.",
    );
  }
  if (!response.ok) {
    // A full navigation discards all private client state after session expiry.
    if (response.status === 401 && !path.includes("/auth/login"))
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login?expired=1");
    const failure = await response.json().catch(() => ({}));
    throw new ApiError(
      errorMessage(response.status, path),
      failure?.error?.code || "",
    );
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(
      "The service returned an invalid response. Please try again.",
    );
  }
}
