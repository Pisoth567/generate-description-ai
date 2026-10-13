"use client";
import { useState } from "react";
export function ErrorMessage({ message }: { message: string }) { return message ? <p className="error" role="alert">{message}</p> : null; }
export function CopyButton({ text }: { text: string }) {
 const [message, setMessage] = useState("");
 return <><button type="button" className="secondary" onClick={async () => { try { await navigator.clipboard.writeText(text); setMessage("Copied to clipboard."); } catch { setMessage("Copy unavailable. Select the description and copy it manually."); } }}>Copy Description</button><span role="status">{message}</span></>;
}
export function date(value: string) { return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value)) + " UTC"; }
