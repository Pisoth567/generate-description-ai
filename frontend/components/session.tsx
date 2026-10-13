"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "@/lib/types";
import { api } from "@/lib/client";
import { ErrorMessage } from "./ui";
const Session = createContext<{ user: User; refresh: () => Promise<void> } | null>(null);
export function useSession() { const session = useContext(Session); if (!session) throw new Error("Session unavailable"); return session; }
export function SessionShell({ initialUser, children }: { initialUser: User; children: ReactNode }) {
 const [user, setUser] = useState(initialUser), [error, setError] = useState(""), [busy, setBusy] = useState(false);
 const pathname = usePathname();
 const router = useRouter();
 async function refresh() { setUser(await api<User>("/api/auth/me")); }
 return <Session.Provider value={{ user, refresh }}><header><Link href="/dashboard" className="brand">Generate Description AI</Link><nav aria-label="Main navigation">{["Dashboard", "Generate", "History", "Pricing", "Payments"].map(label => <Link key={label} href={`/${label.toLowerCase()}`} aria-current={pathname === `/${label.toLowerCase()}` ? "page" : undefined}>{label}</Link>)}<button className="secondary" disabled={busy} type="button" onClick={async () => { setBusy(true); try { await api("/api/auth/logout", {}); router.replace("/login"); router.refresh(); } catch (e) { setError((e as Error).message); setBusy(false); } }}>{busy ? "Logging out…" : "Logout"}</button></nav></header><main className="container"><div className="account-line"><span>{user.email}</span><strong>{user.credits} credits</strong></div><ErrorMessage message={error}/>{children}</main></Session.Provider>;
}
