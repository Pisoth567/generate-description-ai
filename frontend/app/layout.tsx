import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: { default: "Generate Description AI", template: "%s | Generate Description AI" }, description: "Create product descriptions in English and Khmer." };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
