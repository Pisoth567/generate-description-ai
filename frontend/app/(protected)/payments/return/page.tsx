export const metadata = { title: "Payment status" };
export const instant = false;
import { cookies } from "next/headers";
import { PaymentReturn } from "@/components/payments";
export default async function Page() {
  const value = (await cookies()).get("pending_payment")?.value;
  return (
    <PaymentReturn
      paymentId={value && /^[1-9]\d*$/.test(value) ? value : null}
    />
  );
}
