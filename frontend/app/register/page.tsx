import { publicMetadata } from "@/lib/seo";
import { Suspense } from "react";
import { AuthLoading } from "@/components/auth-loading";
import { AuthForm } from "@/components/auth-form";
export const metadata = {
  ...publicMetadata(
    "Create an account",
    "/register",
    "Create an account to write product descriptions in English and Khmer.",
  ),
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <Suspense fallback={<AuthLoading />}>
     <div className="min-h-screen flex items-center justify-center px-4">
    <div className="w-full max-w-2xl border rounded-2xl">
      <AuthForm register={true} />
    </div>
  </div>
    </Suspense>
  );
}
