"use client";
import Link from "next/link";
import { Brand } from "./brand";
import { BorderBeam } from "./ui/border-beam";
import { PreferenceControls, useTranslation } from "./preferences";
export function Landing() {
  const { t } = useTranslation();
  return (
    <>
      <header className="page-container public-header">
        <Brand />
        <nav>
          <Link href="/login">{t("Login")}</Link>
        </nav>
      </header>
      <main id="main-content" className="page-container">
        <section className="hero">
          <div>
            <h1>{t("AI Product Description Generator")}</h1>
            <p className="lead">
              {t(
                "Generate natural product descriptions from your product information in English or Khmer.",
              )}
            </p>
            <Link className="button mt-5" href="/register">
              {t("Create Account")}
            </Link>
          </div>
          <div className="hero-preview">
            <h2>{t("Your description")}</h2>
            <p>{t("Add your product details to get started.")}</p>
            <p lang="km">សរសេរការពិពណ៌នាផលិតផលជាភាសាខ្មែរ</p>
            <BorderBeam
              duration={12}
              size={100}
              colorFrom="#86c7b0"
              colorTo="#146657"
            />
          </div>
        </section>
        <section className="card-grid">
          {[
            "Fast text-based generation",
            "English + Khmer output",
            "Custom product categories",
            "Generation history",
            "Verified sign-in",
            "Free to use",
          ].map((label) => (
            <div className="card" key={label}>
              <h2>{t(label)}</h2>
            </div>
          ))}
        </section>
        <section className="section max-w-xl">
          <PreferenceControls />
        </section>
      </main>
    </>
  );
}
