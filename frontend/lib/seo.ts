import type { Metadata } from "next";
// A deployment must explicitly configure its public origin. Never infer it from requests.
export function siteOrigin(): string | undefined {
  try {
    const url = new URL(process.env.SITE_URL || "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hostname === "localhost" ||
      url.hostname.endsWith(".localhost") ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]"
    )
      return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}
export const productDescription =
  "Create AI-powered product descriptions for e-commerce in English and Khmer. Choose your tone, save your work, and manage your credits in one workspace.";
export function publicMetadata(
  title: string,
  path: string,
  description = productDescription,
): Metadata {
  const origin = siteOrigin();
  return {
    title,
    description,
    ...(origin ? { alternates: { canonical: `${origin}${path}` } } : {}),
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Generate Description AI",
      ...(origin ? { url: `${origin}${path}` } : {}),
    },
    twitter: { card: "summary", title, description },
  };
}
