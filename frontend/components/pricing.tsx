"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import type { Package, PaymentCheckoutResponse } from "@/lib/types";
import { ErrorMessage } from "./ui";
function Checkout({ checkout }: { checkout: PaymentCheckoutResponse }) {
 const form = useRef<HTMLFormElement>(null);
 useEffect(() => { const url = new URL(checkout.checkout_url); if (url.protocol === "https:" && ["checkout-sandbox.payway.com.kh", "checkout.payway.com.kh"].includes(url.host) && !url.username && !url.password) HTMLFormElement.prototype.submit.call(form.current); }, [checkout]);
 return <section className="card"><h2>You are being redirected to ABA PayWay</h2><p role="status">Complete checkout on PayWay, then check your payment status.</p><form ref={form} action={checkout.checkout_url} method="POST">{Object.entries(checkout.fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value}/>)}<button type="submit">Continue to ABA PayWay</button></form><Link href="/payments">View payment history</Link></section>;
}
export function Pricing() {
 const [packages, setPackages] = useState<Package[]>([]), [error, setError] = useState(""), [loading, setLoading] = useState(true), [busy, setBusy] = useState(""), [checkout, setCheckout] = useState<PaymentCheckoutResponse | null>(null), [retry, setRetry] = useState(0);
 useEffect(() => { let active = true; api<Package[]>("/api/payments/packages").then(data => { if (active) setPackages(data); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [retry]);
 async function buy(code: string) { setBusy(code); setError(""); try { setCheckout(await api<PaymentCheckoutResponse>("/api/payments", { package_code: code })); } catch (e) { setError((e as Error).message); setBusy(""); } }
 return <><h1>Buy credits</h1><p>Choose a package. Prices and credits come from the current package catalog.</p><ErrorMessage message={error}/>{error && !packages.length && <button type="button" onClick={() => { setLoading(true); setError(""); setRetry(retry + 1); }}>Try again</button>}{checkout ? <Checkout checkout={checkout}/> : loading ? <p role="status">Loading packages…</p> : <div className="grid">{packages.map(pack => <section className="card" key={pack.code}><h2 className="capitalize">{pack.code}</h2><p className="balance">{pack.amount} <small>{pack.currency}</small></p><p>{pack.credits} credits</p><button type="button" disabled={!!busy} onClick={() => buy(pack.code)}>{busy === pack.code ? "Preparing checkout…" : "Buy Credits"}</button></section>)}</div>}<p className="muted">Credits are added only after the backend confirms payment. If checkout is interrupted, check the pending transaction in <Link href="/payments">Payments</Link> before starting another purchase.</p></>;
}
