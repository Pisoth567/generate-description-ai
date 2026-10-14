"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import type { LoginRequest, RegisterRequest } from "@/lib/types";
import { ErrorMessage } from "./ui";
import { Brand } from "./brand";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
export function AuthForm({ register = false }: { register?: boolean }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const params = useSearchParams();
  const googleError = params.get("error");
  const googleMessage =
    googleError === "google_link_required"
      ? "An account with this email already exists. Sign in with your email and password first, then link Google from your account."
      : googleError === "google_unavailable"
        ? "Google sign-in is not currently available."
        : googleError === "google_failed"
          ? "Google sign-in could not be completed. Please try again."
          : "";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const body: LoginRequest | RegisterRequest = {
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
    };
    if (register && body.password !== form.get("confirm")) {
      setError("Passwords must match.");
      return;
    }
    setBusy(true);
    try {
      await api(`/api/auth/${register ? "register" : "login"}`, body);
      window.location.assign(register ? "/login?registered=1" : "/generate");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <main id="main-content" className="auth card">
      <Brand />
      <h1>{register ? "Create your account" : "Welcome back"}</h1>
      <p className="muted">
        {register
          ? "Better product descriptions start with a few details."
          : "Sign in to your product writing workspace."}
      </p>
      {params.has("registered") && !register && (
        <p role="status">Account created. Log in to get started.</p>
      )}
      {params.has("expired") && (
        <p role="status">Your session has expired. Please log in again.</p>
      )}
      <ErrorMessage message={googleMessage} />
      <form className="form-stack" onSubmit={submit} aria-busy={busy}>
        <div className="field">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            placeholder="you@example.com"
          />
        </div>
        <div className="field">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            minLength={register ? 8 : undefined}
            maxLength={128}
            required
            aria-describedby={register ? "password-help" : undefined}
          />
          {register && <small id="password-help">Use 8–128 characters.</small>}
        </div>
        {register && (
          <div className="field">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
            />
          </div>
        )}
        <ErrorMessage message={error} />
        <Button disabled={busy} type="submit">
          {busy ? "Please wait…" : register ? "Create account" : "Login"}
        </Button>
      </form>
      <div className="my-6 flex items-center gap-4">
        <Separator className="flex-1" />
        <span className="muted text-sm">or</span>
        <Separator className="flex-1" />
      </div>
      <Button asChild variant="outline" className="w-full">
        <a href="/api/auth/google/start">Continue with Google</a>
      </Button>
      <p className="mt-6 text-center text-sm muted">
        {register ? "Already have an account?" : "New here?"}{" "}
        <Link
          className="font-semibold text-primary"
          href={register ? "/login" : "/register"}
        >
          {register ? "Login" : "Register"}
        </Link>
      </p>
    </main>
  );
}
