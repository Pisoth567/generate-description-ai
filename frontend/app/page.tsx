import { Landing } from "@/components/landing";
import { publicMetadata, siteOrigin } from "@/lib/seo";
export const metadata = publicMetadata(
  "AI Product Descriptions in English & Khmer",
  "/",
);
export default function Home() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Generate Description AI",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "AI-powered product descriptions for e-commerce with English and Khmer support.",
    inLanguage: ["en", "km"],
    ...(siteOrigin() ? { url: siteOrigin() } : {}),
  };
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
      <Landing />
    </>
  );
}
