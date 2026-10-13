import { errorMessage } from "./errors";
export async function api<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try { response = await fetch(path, { method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store", ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) }); }
  catch { throw new Error("Could not connect. Please check your connection and try again."); }
  if (!response.ok) {
    // A full navigation discards all private client state after session expiry.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (response.status === 401 && !path.includes("/auth/login")) window.location.assign("/login?expired=1");
    throw new Error(errorMessage(response.status, path));
  }
  try { return await response.json() as T; } catch { throw new Error("The service returned an invalid response. Please try again."); }
}
