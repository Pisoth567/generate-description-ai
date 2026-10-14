"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { api } from "@/lib/client";
import type { Package, PaymentCheckoutResponse } from "@/lib/types";
import { ErrorMessage, LoadingCards } from "./ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "./ui/dialog";
import { QRCheckout } from "./qr-checkout";
export function Pricing() {
  const [packages, setPackages] = useState<Package[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(""),
    [checkout, setCheckout] = useState<PaymentCheckoutResponse | null>(null),
    [retry, setRetry] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const purchaseInFlight = useRef(false);
  const buyTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    let active = true;
    api<Package[]>("/api/payments/packages")
      .then((data) => {
        if (active) setPackages(data);
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
  }, [retry]);
  async function buy(code: string, trigger?: HTMLButtonElement) {
    if (purchaseInFlight.current || checkout) return;
    purchaseInFlight.current = true;
    if (trigger) buyTrigger.current = trigger;
    setBusy(code);
    setError("");
    try {
      setCheckout(
        await api<PaymentCheckoutResponse>("/api/payments", {
          package_code: code,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      purchaseInFlight.current = false;
      setBusy("");
    }
  }
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">More room to create</p>
        <h1>Buy credits</h1>
        <p>
          Choose the right amount for your next batch of products. Pay with ABA
          when you’re ready.
        </p>
      </div>
      <ErrorMessage message={error} />
      {error && !packages.length && (
        <Button
          type="button"
          onClick={() => {
            setLoading(true);
            setError("");
            setRetry(retry + 1);
          }}
        >
          Try again
        </Button>
      )}
      {loading ? (
        <LoadingCards label="Loading packages…" />
      ) : (
        <div className="card-grid">
          {!packages.length && (
            <p className="card" role="status">
              No credit packages are available right now. Please check again
              later.
            </p>
          )}
          {packages.map((pack) => (
            <Card key={pack.code}>
              <CardContent className="flex h-full flex-col">
                <h2 className="capitalize">{pack.code}</h2>
                <p className="balance">
                  {pack.amount} <small>{pack.currency}</small>
                </p>
                <p className="mb-6 border-b pb-6 text-muted-foreground">
                  {pack.credits} credits for product descriptions
                  <br />
                  <span className="text-sm">
                    English and Khmer · Saved history
                  </span>
                </p>
                <Button
                  type="button"
                  disabled={!!busy}
                  onClick={(event) => buy(pack.code, event?.currentTarget)}
                >
                  {busy === pack.code ? "Preparing checkout…" : "Buy Credits"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Dialog
        open={checkout !== null}
        onOpenChange={(open) => {
          if (!open) setCheckout(null);
        }}
      >
        <DialogContent
          className="checkout-dialog flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-lg flex-col gap-0 overflow-hidden p-0"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            titleRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            buyTrigger.current?.focus();
          }}
        >
          <DialogHeader className="shrink-0 border-b px-5 py-4 pr-14 text-left">
            <DialogTitle ref={titleRef} tabIndex={-1}>
              Complete your payment
            </DialogTitle>
            <DialogDescription>
              Pay with ABA, then verify your payment here.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
            {checkout && (
              <QRCheckout key={checkout.payment.id} checkout={checkout} />
            )}
          </div>
          <DialogFooter className="shrink-0 border-t p-3">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="w-full">
                Close checkout
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <p className="muted">
        Credits are added only after the payment is confirmed. If checkout is
        interrupted, check the pending transaction in{" "}
        <Link href="/payments">Payments</Link> before starting another purchase.
      </p>
    </>
  );
}
