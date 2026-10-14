import { Brand } from "./brand";
import { Skeleton } from "./ui/skeleton";
export function AuthLoading() {
  return (
    <main id="main-content" className="auth card">
      <Brand />
      <div role="status" className="mt-8 space-y-6">
        <span className="sr-only">Loading sign-in form…</span>
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </main>
  );
}
