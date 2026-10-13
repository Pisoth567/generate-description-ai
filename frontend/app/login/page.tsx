import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
export default function Page() { return <Suspense fallback={<p role="status">Loading…</p>}><AuthForm register={false}/></Suspense>; }
