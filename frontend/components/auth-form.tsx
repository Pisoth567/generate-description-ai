"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/client";
import { useTranslation } from "./preferences";
import { ErrorMessage } from "./ui";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import logo from "../app/no background.png";
import Image from "next/image";
import google_icon from "../public/google.png";

export function AuthForm({ register = false }: { register?: boolean }) {
  const { t } = useTranslation();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
    };
    if (register && body.password !== form.get("confirm")) {
      setError("Passwords must match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/api/auth/${register ? "register" : "login"}`, body);
      if (register) sessionStorage.setItem("verification_email", body.email);
      // A full navigation drops any previous private client state.
      window.location.assign(register ? "/verify-email" : "/generate");
    } catch (e) {
      if (e instanceof ApiError && e.code === "email_verification_required") {
        setPending(body.email);
        setError("Please verify your email before signing in.");
      } else
        setError(
          e instanceof ApiError && e.code.startsWith("email_")
            ? "Email delivery is unavailable. Please try again later."
            : "Please check your email and password.",
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main-content" className="auth">
      <div className="flex items-center justify-center">
        <Image className="w-30" src={logo} alt="logo"/>
      </div>
      <h1 className="text-center">{t(register ? "Create Account" : "Login")}</h1>
      {params.has("error") && (
        <ErrorMessage
          message={t("Something went wrong. Please try again later.")}
        />
      )}
      {params.has("verified") && (
        <p role="status">{t("Email verified. Please sign in.")}</p>
      )}
      <form className="form-stack" onSubmit={submit}>
        <label className="field">
          {t("Email")}
          <Input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </label>
        <label className="field">
          {t("Password")}
          <Input
            name="password"
            type="password"
            autoComplete={register ? "new-password" : "current-password"}
            minLength={register ? 8 : undefined}
            maxLength={128}
            required
          />
        </label>
        {register && (
          <label className="field">
            {t("Confirm Password")}
            <Input
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              maxLength={128}
            />
          </label>
        )}
        <ErrorMessage message={t(error)} />
        {pending && (
          <Link
            href="/verify-email"
            onClick={() =>
              sessionStorage.setItem("verification_email", pending)
            }
          >
            {t("Verify Email")}
          </Link>
        )}
        <Button disabled={busy}>
          {t(busy ? "Working…" : register ? "Create Account" : "Login")}
        </Button>
      </form>
      <p className="text-center">{t("or")}</p>
      <a className="button secondary w-full" href="/api/auth/google/start">
        <Image className="w-6" src={google_icon} alt="google icon"/>
        {t("Continue with Google")}
      </a>
          <p className="text-center text-sm text-muted-foreground">
            {t(register ? "Already have an account?" : "Don't have an account?")}{" "}
            <Link
              href={register ? "/login" : "/register"}
              className="font-bold text-primary underline-offset-4 hover:underline"
            >
              {t(register ? "Login" : "Create Account")}
            </Link>
          </p>
    </main>
  );
}
