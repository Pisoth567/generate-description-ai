"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { toast } from "sonner";
import { api } from "@/lib/client";
import type { Payment } from "@/lib/types";
import { useSession } from "./session";
import { date, ErrorMessage, LoadingCards } from "./ui";
export function Payments() {
  const { refresh } = useSession();
  const [items, setItems] = useState<Payment[]>([]),
    [skip, setSkip] = useState(0),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState<number | null>(null),
    [message, setMessage] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    api<Payment[]>(`/api/payments?skip=${skip}&limit=20`)
      .then((data) => {
        if (active) setItems(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [skip, retry]);
  function load(offset: number) {
    setError("");
    setLoading(true);
    setSkip(offset);
    setRetry(retry + 1);
  }
  async function verify(id: number) {
    setBusy(id);
    setError("");
    setMessage("");
    try {
      const result = await api<Payment>(`/api/payments/${id}/verify`, {});
      setItems((items) =>
        items.map((item) => (item.id === id ? result : item)),
      );
      setMessage(
        result.status === "paid"
          ? "Payment successful."
          : result.status === "pending"
            ? "Payment has not been confirmed yet. Complete the payment and try again."
            : `Payment status: ${result.status}.`,
      );
      if (result.status === "paid") {
        toast.success("Payment confirmed. Your credits have been added.");
        await refresh();
      } else if (result.status === "pending") {
        toast.info(
          "Payment has not been confirmed yet. Complete the payment and try again.",
        );
      }
    } catch (e) {
      setError((e as Error).message);
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">Billing</p>
        <h1>Payment history</h1>
        <p>Track your credit purchases and check pending payments.</p>
      </div>
      <ErrorMessage message={error} />
      {error && (
        <Button type="button" onClick={() => load(skip)}>
          Refresh payments
        </Button>
      )}
      <p role="status">{message}</p>
      {loading ? (
        <LoadingCards label="Loading payments…" />
      ) : (
        <>
          {!items.length && !error && (
            <Card>
              <CardContent className="empty-state">
                <h2>No payments yet</h2>
                <p className="muted">Your credit purchases will appear here.</p>
                <Link className="button mt-3" href="/pricing">
                  Browse credit packages
                </Link>
              </CardContent>
            </Card>
          )}
          {items.map((item) => (
            <article className="card history-item" key={item.id}>
              <div className="row">
                <h2 className="capitalize">{item.package_code}</h2>
                <Badge
                  variant="outline"
                  className={`badge ${["pending", "paid", "failed", "cancelled"].includes(item.status) ? item.status : ""}`}
                >
                  {item.status}
                </Badge>
              </div>
              <p>Transaction: {item.tran_id}</p>
              <p>
                {item.amount} {item.currency} · {item.credits} credits
              </p>
              <p>Created: {date(item.created_at)}</p>
              {item.paid_at && <p>Paid: {date(item.paid_at)}</p>}
              {item.status === "pending" && (
                <>
                  <p className="muted">
                    Use the QR in your open checkout. If that session was lost,
                    verify here first. If you have not paid, you may start a new
                    payment from <Link href="/pricing">Pricing</Link>; the old
                    QR cannot be restored.
                  </p>
                  <Button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => verify(item.id)}
                  >
                    {busy === item.id ? "Checking…" : "Verify payment"}
                  </Button>
                </>
              )}
            </article>
          ))}
          <div className="actions">
            <Button
              type="button"
              variant="outline"
              disabled={skip === 0}
              onClick={() => load(Math.max(0, skip - 20))}
            >
              Previous
            </Button>
            <span>Page {skip / 20 + 1}</span>
            <Button
              type="button"
              variant="outline"
              disabled={items.length < 20}
              onClick={() => load(skip + 20)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </>
  );
}
export function PaymentReturn({ paymentId }: { paymentId: string | null }) {
  const { refresh } = useSession();
  const [payment, setPayment] = useState<Payment | null>(null),
    [error, setError] = useState(""),
    [checking, setChecking] = useState(!!paymentId);
  useEffect(() => {
    if (!paymentId) return;
    let active = true;
    api<Payment>(`/api/payments/${paymentId}/verify`, {})
      .then(async (data) => {
        if (active) {
          setPayment(data);
          await refresh();
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
    // This verification runs once per return/payment ID, not on balance updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId]);
  return (
    <>
      <h1>
        {checking
          ? "Checking payment status…"
          : payment?.status === "paid"
            ? "Payment successful"
            : "Payment status"}
      </h1>
      <ErrorMessage message={error} />
      {payment && (
        <p role="status">
          {payment.status === "paid"
            ? "Your payment has been verified by the backend."
            : `Current status: ${payment.status}. Credits are added only after payment is confirmed.`}
        </p>
      )}
      {!paymentId && (
        <p>
          We could not identify a checkout from this browser. Open your payment
          history to check pending transactions.
        </p>
      )}
      <Link className="button" href="/payments">
        View payments and check status
      </Link>
    </>
  );
}
