import { Suspense } from "react";
import { Account } from "@/components/account";
export default function Page() {
  return <Suspense fallback={<p role="status">Loading account…</p>}><Account /></Suspense>;
}
