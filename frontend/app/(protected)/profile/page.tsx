import { Suspense } from "react";
import { Account } from "@/components/account";
export const metadata = { title: "Profile" };
export default function Page() {
  return (
    <Suspense>
      <Account />
    </Suspense>
  );
}
