import "server-only";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { backend, BackendError } from "./backend";
import type { User } from "./types";
export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
export async function requireUser(): Promise<User> {
  await connection();
  const token = (await cookies()).get("access_token")?.value;
  if (!token) redirect("/login");
  try {
    return await backend<User>("/api/auth/me", token);
  } catch (error) {
    if (
      error instanceof BackendError &&
      (error.status === 401 || error.status === 403)
    )
      redirect("/login?expired=1");
    throw error;
  }
}
