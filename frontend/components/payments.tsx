"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import type { Payment } from "@/lib/types";
import { useSession } from "./session";
import { date, ErrorMessage } from "./ui";
export function Payments() {
 const { refresh } = useSession();
 const [items, setItems] = useState<Payment[]>([]), [skip, setSkip] = useState(0), [error, setError] = useState(""), [loading, setLoading] = useState(true), [busy, setBusy] = useState<number | null>(null), [message, setMessage] = useState(""), [retry, setRetry] = useState(0);
 useEffect(() => { let active = true; api<Payment[]>(`/api/payments?skip=${skip}&limit=20`).then(data => { if (active) setItems(data); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [skip, retry]);
 function load(offset: number) { setError(""); setLoading(true); setSkip(offset); setRetry(retry + 1); }
 async function verify(id: number) { setBusy(id); setError(""); setMessage(""); try { const result = await api<Payment>(`/api/payments/${id}/verify`, {}); setItems(items => items.map(item => item.id === id ? result : item)); setMessage(result.status === "paid" ? "Payment successful." : `Payment status: ${result.status}.`); await refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); } }
 return <><h1>Payment history</h1><ErrorMessage message={error}/>{error && <button type="button" onClick={() => load(skip)}>Refresh payments</button>}<p role="status">{message}</p>{loading ? <p role="status">Loading payments…</p> : <>{!items.length && !error && <section className="card"><p>No payments yet.</p><Link href="/pricing">Browse credit packages</Link></section>}{items.map(item => <article className="card history-item" key={item.id}><div className="row"><h2 className="capitalize">{item.package_code}</h2><span className={`badge ${["pending", "paid", "failed", "cancelled"].includes(item.status) ? item.status : ""}`}>{item.status}</span></div><p>Transaction: {item.tran_id}</p><p>{item.amount} {item.currency} · {item.credits} credits</p><p>Created: {date(item.created_at)}</p>{item.paid_at && <p>Paid: {date(item.paid_at)}</p>}{item.status === "pending" && <button type="button" disabled={busy !== null} onClick={() => verify(item.id)}>{busy === item.id ? "Checking…" : "Check Payment Status"}</button>}</article>)}<div className="actions"><button type="button" className="secondary" disabled={skip === 0} onClick={() => load(Math.max(0, skip - 20))}>Previous</button><span>Page {skip / 20 + 1}</span><button type="button" className="secondary" disabled={items.length < 20} onClick={() => load(skip + 20)}>Next</button></div></>}</>;
}
export function PaymentReturn({ paymentId }: { paymentId: string | null }) {
 const { refresh } = useSession();
 const [payment, setPayment] = useState<Payment | null>(null), [error, setError] = useState(""), [checking, setChecking] = useState(!!paymentId);
 useEffect(() => {
  if (!paymentId) return;
  let active = true;
  api<Payment>(`/api/payments/${paymentId}/verify`, {}).then(async data => { if (active) { setPayment(data); await refresh(); } }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setChecking(false); });
  return () => { active = false; };
  // This verification runs once per return/payment ID, not on balance updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [paymentId]);
 return <><h1>{checking ? "Checking payment status…" : payment?.status === "paid" ? "Payment successful" : "Payment status"}</h1><ErrorMessage message={error}/>{payment && <p role="status">{payment.status === "paid" ? "Your payment has been verified by the backend." : `Current status: ${payment.status}. Credits are added only after payment is confirmed.`}</p>}{!paymentId && <p>We could not identify a checkout from this browser. Open your payment history to check pending transactions.</p>}<Link className="button" href="/payments">View payments and check status</Link></>;
}
