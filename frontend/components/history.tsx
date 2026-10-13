"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import type { Generation } from "@/lib/types";
import { CopyButton, date, ErrorMessage } from "./ui";
export function History({ id }: { id?: string }) {
 const [items, setItems] = useState<Generation[]>([]), [skip, setSkip] = useState(0), [error, setError] = useState(""), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0);
 useEffect(() => { let active = true; api<Generation[] | Generation>(id ? `/api/generations/${id}` : `/api/generations?skip=${skip}&limit=20`).then(data => { if (active) setItems(Array.isArray(data) ? data : [data]); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [id, skip, retry]);
 function load(offset: number) { setLoading(true); setError(""); setSkip(offset); setRetry(retry + 1); }
 return <><h1>{id ? "Saved description" : "Generation history"}</h1><ErrorMessage message={error}/>{error && <button type="button" onClick={() => load(skip)}>Try again</button>}{loading ? <p role="status">Loading descriptions…</p> : !error && <>{!items.length && <div className="card"><p>No descriptions yet.</p><Link href="/generate">Generate your first description</Link></div>}{items.map(item => <article className="card history-item" key={item.id}><h2>{id ? item.product_name : <Link href={`/history/${item.id}`}>{item.product_name}</Link>}</h2><p className="muted">{item.category || "Uncategorized"} · {item.language} · {item.tone}</p><p><time dateTime={item.created_at}>{date(item.created_at)}</time></p><div lang={item.language === "Khmer" ? "km" : "en"} className={id ? "description" : "preview"}>{id ? item.generated_text : item.generated_text.slice(0, 220) + (item.generated_text.length > 220 ? "…" : "")}</div>{id && <><p>{item.tokens_used} tokens used</p><CopyButton text={item.generated_text}/></>}</article>)}{!id && <div className="actions"><button type="button" className="secondary" disabled={skip === 0} onClick={() => load(Math.max(0, skip - 20))}>Previous</button><span>Page {skip / 20 + 1}</span><button type="button" className="secondary" disabled={items.length < 20} onClick={() => load(skip + 20)}>Next</button></div>}</>}{id && <Link href="/history">Back to history</Link>}</>;
}
