import { VerifyEmail } from "@/components/verify-email";
export const metadata = {
  title: "Verify your email",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <VerifyEmail />;
}
