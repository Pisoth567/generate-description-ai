"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import type { LoginRequest, RegisterRequest } from "@/lib/types";
import { ErrorMessage } from "./ui";
export function AuthForm({ register = false }: { register?: boolean }) {
 const [error, setError] = useState(""), [busy, setBusy] = useState(false);
 const params = useSearchParams();
 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); setError("");
  const form = new FormData(event.currentTarget);
  const body: LoginRequest | RegisterRequest = { email: String(form.get("email")).trim(), password: String(form.get("password")) };
  if (register && body.password !== form.get("confirm")) { setError("Passwords must match."); return; }
  setBusy(true);
  try { await api(`/api/auth/${register ? "register" : "login"}`, body); window.location.assign(register ? "/login?registered=1" : "/dashboard"); }
  catch (e) { setError((e as Error).message); setBusy(false); }
 }
 return <main className="auth card"><Link href="/" className="brand">Generate Description AI</Link><h1>{register ? "Create your account" : "Welcome back"}</h1>{params.has("registered") && !register && <p role="status">Account created. Log in to get started.</p>}{params.has("expired") && <p role="status">Your session has expired. Please log in again.</p>}<form onSubmit={submit}><label>Email<input name="email" type="email" autoComplete="email" required maxLength={254}/></label><label>Password<input name="password" type="password" autoComplete={register ? "new-password" : "current-password"} minLength={register ? 8 : undefined} maxLength={128} required/></label>{register && <><p className="muted">Use 8–128 characters.</p><label>Confirm password<input name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={128} required/></label></>}<ErrorMessage message={error}/><button disabled={busy} type="submit">{busy ? "Please wait…" : register ? "Create account" : "Login"}</button></form><p>{register ? "Already have an account?" : "New here?"} <Link href={register ? "/login" : "/register"}>{register ? "Login" : "Register"}</Link></p></main>;
}
