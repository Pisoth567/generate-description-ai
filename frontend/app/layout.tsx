import type { Metadata } from "next";
import { Notifications } from "@/components/notifications";
import { productDescription, siteOrigin } from "@/lib/seo";
import "./globals.css";
import { PreferencesProvider, SkipLink } from "@/components/preferences";
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
    <html lang="en" suppressHydrationWarning>
      <body>
        <PreferencesProvider>
          <SkipLink />
          {children}
          <Notifications />
        </PreferencesProvider>
      </body>
    </html>
  );
}
