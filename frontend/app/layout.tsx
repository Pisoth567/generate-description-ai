import type { Metadata } from "next";
import { Notifications } from "@/components/notifications";
import { productDescription, siteOrigin } from "@/lib/seo";
import { Koh_Santepheap } from "next/font/google";
import "./globals.css";
import { PreferencesProvider, SkipLink } from "@/components/preferences";

const origin = siteOrigin();

const kohSantepheap = Koh_Santepheap({
  subsets: ["latin", "khmer"],
  weight: ["100", "300", "400", "700", "900"],
  variable: "--font-koh-santepheap",
  display: "swap",
});

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
      <body className={`${kohSantepheap.variable} font-sans`}>
        <PreferencesProvider>
          <SkipLink />
          {children}
          <Notifications />
        </PreferencesProvider>
      </body>
    </html>
  );
}
