"use client";
import { useSearchParams } from "next/navigation";
import { useSession } from "./session";
export function Account() {
  const { user } = useSession();
  const params = useSearchParams();
  return <section className="card"><h1>Account</h1>
    <dl><dt>Email</dt><dd>{user.email}</dd><dt>Plan</dt><dd>{user.plan}</dd><dt>Credits</dt><dd>{user.credits}</dd></dl>
    {params.get("google") === "linked" && user.google_linked && <p role="status">Google account linked successfully.</p>}
    {params.has("error") && <p role="alert">{params.get("error") === "google_unavailable" ? "Google sign-in is not currently available." : "Google could not be linked. Choose the Google account with the same email as your account and try again."}</p>}
    {user.google_linked ? <p>Google account: Connected</p> : <a className="button secondary" href="/api/auth/google/start?mode=link">Link Google account</a>}
  </section>;
}
