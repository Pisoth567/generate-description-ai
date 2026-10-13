import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import { SessionShell } from "@/components/session";
export const instant = false;
async function Guard({ children }: { children: React.ReactNode }) { const user = await requireUser(); return <SessionShell initialUser={user}>{children}</SessionShell>; }
export default function Layout({ children }: { children: React.ReactNode }) { return <Suspense fallback={<p className="container" role="status">Checking your session…</p>}><Guard>{children}</Guard></Suspense>; }
