import { publicMetadata } from "@/lib/seo";
import { Suspense } from "react";
import { AuthLoading } from "@/components/auth-loading";
import { AuthForm } from "@/components/auth-form";
export const metadata = {
  ...publicMetadata(
    "Login",
    "/login",
    "Sign in to your Generate Description AI workspace.",
  ),
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <div className="min-h-screen flex items-center justify-center px-4">
    <div className="w-full max-w-2xl border rounded-2xl">
      <AuthForm register={false} />
    </div>
  </div>
    </Suspense>
  );
}
