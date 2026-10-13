"use client";
import Link from "next/link";
import { useSession } from "./session";
export function Dashboard() { const { user } = useSession(); return <><p className="eyebrow">YOUR WORKSPACE</p><h1>Dashboard</h1><p>Create your next product description.</p><div className="grid"><section className="card"><h2>Account</h2><p>{user.email}</p><p>Plan: <strong className="capitalize">{user.plan}</strong></p></section><section className="card"><h2>Available credits</h2><p className="balance">{user.credits}</p><Link href="/pricing">Buy Credits</Link></section></div><div className="actions"><Link className="button" href="/generate">Generate</Link><Link className="button secondary" href="/history">View History</Link></div></>; }
