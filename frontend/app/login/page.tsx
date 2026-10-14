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
      <AuthForm register={false} />
    </Suspense>
  );
}
