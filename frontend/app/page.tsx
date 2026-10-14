import Link from "next/link";
import {
  ArrowRight,
  Check,
  Languages,
  FileText,
  SlidersHorizontal,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BorderBeam } from "@/components/ui/border-beam";
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
      <div className="public-divider">
        <header className="page-container public-header">
          <Brand />
          <nav aria-label="Main navigation">
            <a className="desktop-link" href="#how-it-works">
              How it works
            </a>
            <a className="desktop-link" href="#pricing">
              Pricing
            </a>
            <Link href="/login">Login</Link>
            <Button asChild>
              <Link href="/register">
                Get started
                <ArrowRight className="hidden sm:block" />
              </Link>
            </Button>
          </nav>
        </header>
      </div>
      <main id="main-content" className="page-container">
        <section className="hero">
          <div>
            <Badge variant="secondary" className="mb-6 gap-2 px-3 py-1">
              <Languages size={14} aria-hidden="true" />
              Made for English & Khmer
            </Badge>
            <h1>
              Your products.
              <br />
              Better words.
              <br />
              <span className="text-primary">Less effort.</span>
            </h1>
            <p className="lead mt-6">
              Turn product details into clear, compelling descriptions with AI.
              Find the right voice for your store, in English or Khmer.
            </p>
            <div className="actions">
              <Button asChild>
                <Link href="/register">
                  Start Generating
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <a href="#how-it-works">See how it works</a>
              </Button>
            </div>
            <p className="text-sm muted">
              Your tone. Your language. All your descriptions in one place.
            </p>
          </div>
          <div className="hero-preview">
            <div className="row border-b pb-4">
              <span className="flex items-center gap-2 font-semibold">
                <Sparkles
                  size={18}
                  className="text-primary"
                  aria-hidden="true"
                />
                From details to description
              </span>
              <Badge variant="outline">Example</Badge>
            </div>
            <div className="preview-block">
              <p className="eyebrow">Product details</p>
              <h3>Everyday canvas tote</h3>
              <p className="text-sm muted">
                Cotton canvas · Shoulder straps · Inside pocket
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Friendly</Badge>
                <Badge variant="outline">English</Badge>
              </div>
            </div>
            <div className="p-2 pt-5">
              <p className="text-sm font-semibold text-primary">
                A little more room for your everyday.
              </p>
              <p className="text-sm muted">
                Meet your everyday carry. Made from cotton canvas with
                comfortable shoulder straps and an inside pocket for the little
                things, this tote keeps your essentials close.
              </p>
              <p lang="km" className="mt-4 border-t pt-4 text-base">
                សរសេរការពិពណ៌នាផលិតផលជាភាសាខ្មែរ
              </p>
              <p className="text-xs muted">
                Illustrative copy · You review every result before publishing.
              </p>
            </div>
            <BorderBeam
              duration={12}
              size={100}
              colorFrom="#86c7b0"
              colorTo="#146657"
            />
          </div>
        </section>
        <section className="section border-t" aria-labelledby="benefits">
          <p className="eyebrow">A simpler writing workflow</p>
          <h2 className="section-title" id="benefits">
            More creating. Less staring at a blank page.
          </h2>
          <div className="card-grid">
            {[
              {
                icon: SlidersHorizontal,
                title: "Sounds like your brand",
                text: "Choose a professional, friendly, luxury, or simple tone to suit your product.",
              },
              {
                icon: Languages,
                title: "English or Khmer",
                text: "Write for the people you sell to. Pick your language before you generate.",
              },
              {
                icon: FileText,
                title: "Good words, kept close",
                text: "Your descriptions are saved automatically. Revisit, review, and copy them from history.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <Card key={title}>
                <CardContent>
                  <Icon className="feature-icon" size={25} aria-hidden="true" />
                  <h3>{title}</h3>
                  <p className="muted text-sm">{text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
        <section id="how-it-works" className="section border-t">
          <p className="eyebrow">How it works</p>
          <h2 className="section-title">
            A few details. A useful first draft.
          </h2>
          <div className="card-grid">
            {[
              {
                title: "Tell us about your product",
                text: "Add a name, category, and the features that make it worth a closer look.",
              },
              {
                title: "Choose your voice",
                text: "Select a tone and choose English or Khmer. Generate when you’re ready.",
              },
              {
                title: "Review, copy, and use",
                text: "Check your description for accuracy, copy it to your store, and find it again in history.",
              },
            ].map(({ title, text }, i) => (
              <div key={title} className="py-3">
                <span className="mb-4 grid size-10 place-items-center rounded-full bg-accent font-semibold text-primary">
                  {i + 1}
                </span>
                <h3>{title}</h3>
                <p className="muted">{text}</p>
              </div>
            ))}
          </div>
        </section>
        <section id="pricing" className="section border-t">
          <div className="row">
            <div>
              <p className="eyebrow">Credits for your workflow</p>
              <h2 className="section-title">Create at your own pace.</h2>
              <p className="muted max-w-xl">
                Buy credits from the available packages in your workspace. See
                current prices and credit amounts before you check out.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link href="/pricing">
                View credit packages
                <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            {[
              "English and Khmer generation",
              "Saved description history",
              "ABA PayWay QR checkout",
            ].map((text) => (
              <span key={text} className="flex items-center gap-2">
                <Check size={17} className="text-primary" aria-hidden="true" />
                {text}
              </span>
            ))}
          </div>
          <p className="muted text-sm mt-4">
            Sign in to view the current catalog. Credits are added after payment
            verification.
          </p>
        </section>
        <section className="section border-t">
          <div className="mx-auto max-w-2xl text-center">
            <ShieldCheck
              className="mx-auto mb-4 text-primary"
              size={28}
              aria-hidden="true"
            />
            <h2 className="section-title">
              A workspace built around your work.
            </h2>
            <p className="muted">
              Sign in with email or Google. Keep your descriptions in your
              account, see your credit balance, and check payment status before
              making another purchase.
            </p>
            <div className="mt-10">
              <h2 className="section-title">
                Give your next product the right words.
              </h2>
              <Button asChild className="mt-4">
                <Link href="/register">
                  Start Generating
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <footer className="footer">
        <div className="page-container row">
          <Brand />
          <p className="text-sm muted">
            Product descriptions in English & Khmer.
          </p>
          <nav aria-label="Footer" className="flex gap-5 text-sm">
            <Link href="/login">Login</Link>
            <Link href="/pricing">Pricing</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
