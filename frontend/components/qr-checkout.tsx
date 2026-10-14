"use client";
import { useState } from "react";
import Link from "next/link";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Alert, AlertDescription } from "./ui/alert";
import { toast } from "sonner";
import { api } from "@/lib/client";
import type { Payment, PaymentCheckoutResponse } from "@/lib/types";
import { useSession } from "./session";
import { ErrorMessage } from "./ui";

export function QRCheckout({
  checkout,
}: {
  checkout: PaymentCheckoutResponse;
}) {
  const { refresh } = useSession();
  const [payment, setPayment] = useState(checkout.payment);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  async function verify() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<Payment>(
        `/api/payments/${payment.id}/verify`,
        {},
      );
      setPayment(result);
      if (result.status === "paid") {
        toast.success("Payment confirmed. Your credits have been added.");
        await refresh();
      } else if (result.status === "pending") {
        const pendingMessage =
          "Payment has not been confirmed yet. Complete the payment and try again.";
        setMessage(pendingMessage);
        toast.info(pendingMessage);
      }
    } catch (e) {
      setError((e as Error).message);
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="checkout-content" aria-label="ABA QR checkout">
      <div className="row">
        <h2 className="capitalize">{payment.package_code} package</h2>
        <Badge
          variant="outline"
          className={`badge ${["pending", "paid", "failed", "cancelled"].includes(payment.status) ? payment.status : ""}`}
        >
          {payment.status}
        </Badge>
      </div>
      <dl className="my-5 grid grid-cols-2 gap-4 rounded-lg bg-muted p-4">
        <div>
          <dt className="text-sm text-muted-foreground">Amount due</dt>
          <dd className="font-semibold">
            {payment.amount} {payment.currency}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Credit package</dt>
          <dd className="font-semibold">{payment.credits} credits</dd>
        </div>
      </dl>
      <ErrorMessage message={error} />
      <p role="status">{message}</p>
      {payment.status === "paid" ? (
        <>
          <h3 className="mt-6 text-xl text-primary">Payment successful</h3>
          <p>{payment.credits} credits added.</p>
          <Link className="button" href="/generate">
            Start generating
          </Link>
          {error && (
            <Button
              type="button"
              onClick={async () => {
                try {
                  await refresh();
                  setError("");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Refresh credit balance
            </Button>
          )}
        </>
      ) : payment.status === "pending" ? (
        <>
          <Alert>
            <AlertDescription>
              Payment pending. Scan this QR code with ABA Mobile, then verify
              your payment below.
            </AlertDescription>
          </Alert>
          {/* Only the backend-validated PNG data URL is rendered; no provider HTML. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            onError={() => setImageFailed(true)}
            src={checkout.checkout.qr_image}
            alt="ABA PayWay payment QR code"
            style={{
              display: imageFailed ? "none" : "block",
              width: "100%",
              maxWidth: 280,
              height: "auto",
            }}
          />
          {imageFailed && (
            <Alert variant="destructive">
              <AlertDescription>
                The QR image could not be displayed. You can open ABA Mobile
                using the button below, or check this payment in your payment
                history.
              </AlertDescription>
            </Alert>
          )}
          <ol className="checkout-steps" aria-label="How to complete payment">
            <li>
              <span aria-hidden="true">1</span>Scan or open ABA
            </li>
            <li>
              <span aria-hidden="true">2</span>Approve in ABA
            </li>
            <li>
              <span aria-hidden="true">3</span>Return here and verify
            </li>
          </ol>
          <div className="actions">
            {checkout.checkout.aba_deeplink && (
              <a
                className="button secondary"
                href={checkout.checkout.aba_deeplink}
              >
                Open ABA Mobile
              </a>
            )}
            <Button type="button" disabled={busy} onClick={verify}>
              {busy ? "Verifying…" : "Verify payment"}
            </Button>
          </div>
          <p className="muted">
            Credits are added only after payment is verified. Closing this
            dialog discards the QR; it does not cancel the payment.
          </p>
        </>
      ) : (
        <p role="status">
          {payment.status === "cancelled"
            ? "This payment was cancelled."
            : payment.status === "failed"
              ? "This payment failed."
              : "Payment is awaiting confirmation."}
        </p>
      )}
      <p>
        <Link href="/payments">Back to Payments</Link>
      </p>
    </section>
  );
}
