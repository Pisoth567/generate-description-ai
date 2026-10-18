"use client";
import { useEffect, useState, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { useTranslation } from "./preferences";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ErrorMessage } from "./ui";
export function VerifyEmail() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const resendAt = useRef(0);
  const [cooldown, setCooldown] = useState(60);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    queueMicrotask(() =>
      setEmail(sessionStorage.getItem("verification_email") || ""),
    );
    resendAt.current = Date.now() + 60000;
    const timer = setInterval(() => setCooldown(Math.max(0, Math.ceil((resendAt.current - Date.now()) / 1000))), 1000);
    return () => clearInterval(timer);
  }, []);
  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/verify-email", { email, code });
      sessionStorage.removeItem("verification_email");
      router.replace("/login?verified=1");
    } catch {
      setError("Invalid or expired code. Request a new code if needed.");
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/resend-verification", { email });
      resendAt.current = Date.now() + 60000;
      setCooldown(60);
      setNotice("Code sent if verification is needed.");
    } catch {
      setError("Email delivery is not configured. Please try again later.");
    } finally {
      setBusy(false);
    }
  }
  const masked = email.replace(/^(.).*(@.*)$/, "$1*****$2");
  return (
    <main id="main-content" className="auth card">
      <h1>{t("Verify your email")}</h1>
      <p>{t("Enter the 6-digit code sent to your email.")}</p>
      <p className="break-all">{masked}</p>
      <form className="form-stack" onSubmit={verify}>
        <label>
          {t("Email")}
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          {t("Verification code")}
          <Input
            className="text-center text-2xl tracking-[0.3em]"
            aria-label={t("Verification code")}
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
          />
        </label>
        <ErrorMessage message={t(error)} />
        <Button disabled={busy || code.length !== 6}>
          {t("Verify Email")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy || cooldown > 0 || !email}
          onClick={resend}
        >
          {t("Resend code")}
          {cooldown > 0 ? ` (${cooldown})` : ""}
        </Button>
        <p role="status">{t(notice)}</p>
      </form>
    </main>
  );
}
