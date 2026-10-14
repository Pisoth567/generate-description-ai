import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import { SessionShell } from "@/components/session";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const instant = false;
async function Guard({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <SessionShell initialUser={user}>{children}</SessionShell>;
}
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <p className="page-container" role="status">
          Checking your session…
        </p>
      }
    >
      <Guard>{children}</Guard>
    </Suspense>
  );
}
