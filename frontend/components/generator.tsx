"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import type { GenerationResult } from "@/lib/types";
import { useSession } from "./session";
import { CopyButton, ErrorMessage } from "./ui";
export function Generator() {
 const { user, refresh } = useSession();
 const [busy, setBusy] = useState(false), [error, setError] = useState(""), [result, setResult] = useState<GenerationResult | null>(null);
 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); setError("");
  const values = new FormData(event.currentTarget);
  const features = String(values.get("features")).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (features.length > 20 || features.some(s => s.length > 300)) { setError("Use up to 20 features, each no longer than 300 characters."); return; }
  setBusy(true);
  try { const data = await api<GenerationResult>("/api/generate", { product_name: String(values.get("product_name")).trim(), category: String(values.get("category")).trim() || null, features, tone: values.get("tone"), language: values.get("language") }); setResult(data); await refresh(); }
  catch (e) { setError((e as Error).message); } finally { setBusy(false); }
 }
 return <><h1>Generate a description</h1><p>{user.credits} credits available · English and Khmer</p><div className="split"><form className="card" onSubmit={submit}><label>Product Name<input name="product_name" required maxLength={200}/></label><label>Category<input name="category" maxLength={100}/></label><label>Features<textarea name="features" rows={6} placeholder="One feature per line" aria-describedby="features-help"/></label><small id="features-help">Up to 20 features, 300 characters each.</small><label>Tone<select name="tone">{["Professional", "Friendly", "Luxury", "Simple"].map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)}</select></label><label>Language<select name="language"><option>English</option><option>Khmer</option></select></label><button type="submit" disabled={busy}>{busy ? "Generating…" : "Generate Description"}</button><ErrorMessage message={error}/></form><section className="card" aria-live="polite"><h2>Your description</h2>{result ? <><div className="description" lang={result.language === "Khmer" ? "km" : "en"}>{result.description}</div><p>{result.tokens_used} tokens · {result.credits_used} credits used · {result.credits_remaining} credits remaining at generation</p><div className="actions"><CopyButton text={result.description}/><Link href={`/history/${result.generation_id}`}>View saved description</Link></div></> : <p className="muted">Your generated description will appear here.</p>}</section></div></>;
}
