import type { Metadata } from "next";
import { Notifications } from "@/components/notifications";
import { productDescription, siteOrigin } from "@/lib/seo";
import "./globals.css";
const origin = siteOrigin();
export const metadata: Metadata = {
  ...(origin ? { metadataBase: new URL(origin) } : {}),
  title: {
    default: "Generate Description AI",
    template: "%s | Generate Description AI",
  },
  description: productDescription,
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {children}
        <Notifications />
      </body>
    </html>
  );
}
