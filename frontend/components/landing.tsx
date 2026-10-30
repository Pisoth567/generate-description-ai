"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  History,
  Languages,
  Menu,
  ShieldCheck,
  Sparkles,
  Tags,
  X,
} from "lucide-react";
import { Brand } from "./brand";
import { LanguageControl, ThemeControl, useTranslation } from "./preferences";
import "./landing.css";
import { MarqueeDemo } from "./ui/marquee-demo";

const features = [
  {
    icon: Languages,
    title: "English + Khmer output",
    description: "Write in the language your customers feel at home with.",
  },
  {
    icon: Tags,
    title: "Custom product categories",
    description: "Choose a category or add one that fits your product.",
  },
  {
    icon: History,
    title: "Description history",
    description: "Return to your saved descriptions whenever you need them.",
  },
  {
    icon: ShieldCheck,
    title: "Verified accounts",
    description: "Keep your work in your own verified account.",
  },
];
const steps = [
  {
    title: "Add product information",
    description:
      "Start with a name, category, and the details that make your product useful.",
  },
  {
    title: "Choose tone and language",
    description:
      "Find the right voice, then choose English or Khmer for your description.",
  },
  {
    title: "Generate and copy your description",
    description:
      "Review your text and copy it into your store or next social post.",
  },
];
const keepLanguageLocal = async () => {};

// These are illustrative samples, independent of the interface language.
const exampleDescriptions = {
  en: "Enjoy clear, immersive sound with comfortable wireless headphones designed for everyday listening. From your morning commute to your favourite playlist, make every moment sound better.",
  km: "រីករាយជាមួយសំឡេងច្បាស់ល្អ និងកាសឥតខ្សែដែលពាក់បានស្រួល សម្រាប់ការស្ដាប់ប្រចាំថ្ងៃ។ មិនថាពេលធ្វើដំណើរទៅធ្វើការ ឬស្ដាប់បទចម្រៀងដែលអ្នកចូលចិត្ត កាសនេះនឹងធ្វើឱ្យការស្ដាប់របស់អ្នកកាន់តែរីករាយ។",
};

function GeneratorPreview() {
  const { t } = useTranslation();
  const [outputLanguage, setOutputLanguage] = useState<"en" | "km">("en");
  return (
    <section className="landing-demo" aria-labelledby="demo-title">
      <div className="landing-demo-bar">
        <span className="landing-window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <h2 id="demo-title">{t("Product Description")}</h2>
        <span className="landing-example">{t("Example")}</span>
      </div>
      <div className="landing-demo-body">
        <dl className="landing-demo-fields">
          <div className="landing-demo-wide">
            <dt>{t("Product Name")}</dt>
            <dd>{t("Wireless Headphones")}</dd>
          </div>
          <div>
            <dt>{t("Category")}</dt>
            <dd>{t("Electronics")}</dd>
          </div>
          <div>
            <dt>{t("Tone")}</dt>
            <dd>{t("professional")}</dd>
          </div>
          <div className="landing-demo-wide">
            <dt>
              <label htmlFor="demo-output-language">
                {t("Output Language")}
              </label>
            </dt>
            <dd className="landing-demo-language">
              <Languages size={16} aria-hidden="true" />
              <select
                id="demo-output-language"
                value={outputLanguage}
                onChange={(event) =>
                  setOutputLanguage(event.target.value as "en" | "km")
                }
              >
                <option value="en">{t("English")}</option>
                <option value="km">{t("Khmer")}</option>
              </select>
            </dd>
          </div>
        </dl>
        <div className="landing-demo-result">
          <div className="landing-result-label">
            <Sparkles size={16} aria-hidden="true" />
            {t("Your description")}
          </div>
          <p lang={outputLanguage} aria-live="polite">
            {exampleDescriptions[outputLanguage]}
          </p>
        </div>
        <p className="landing-demo-note">
          <Check size={14} aria-hidden="true" />
          {t("A little information. A clear description.")}
        </p>
      </div>
    </section>
  );
}

export function Landing() {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1200px)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMenuOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

  return (
    <div className="landing-page">
      <header ref={headerRef} className="landing-nav page-container">
        <Brand />
        <div className="landing-nav-controls">
          <LanguageControl onLanguage={keepLanguageLocal} />
          <ThemeControl />
        </div>
        <button
          ref={menuButtonRef}
          type="button"
          className="landing-menu-toggle"
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="landing-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <nav
          id="landing-navigation"
          className={
            menuOpen ? "landing-navigation is-open" : "landing-navigation"
          }
          aria-label={t("Main navigation")}
        >
          <ul className="landing-nav-links">
            {[
              ["features", "Features"],
              ["how-it-works", "How it works"],
              ["about", "About"],
            ].map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} onClick={() => setMenuOpen(false)}>
                  {t(label)}
                </a>
              </li>
            ))}
          </ul>
          <div className="landing-nav-actions" onClick={() => setMenuOpen(false)}>
            <Link href="/register">{t("Register")}</Link>
            <Link className="button" href="/login">
              {t("Sign In")}
            </Link>
          </div>
        </nav>
      </header>
      <main id="main-content" tabIndex={-1}>
        <div className="landing-hero-background">
          <span className="landing-particle particle-one" aria-hidden="true" />
          <span className="landing-particle particle-two" aria-hidden="true" />
          <section
            className="landing-hero page-container"
            aria-labelledby="landing-title"
          >
            <div className="landing-hero-copy">
              <p className="landing-pill">
                <Sparkles size={15} aria-hidden="true" />
                {t("AI Product Description Generator")}
              </p>
              <h1 id="landing-title">
                {t("Write better product descriptions")}{" "}
                <span>{t("in English or Khmer")}</span>
              </h1>
              <p className="landing-lead">
                {t(
                  "Turn your product information into clear, natural descriptions for online stores, social media, and product listings.",
                )}
              </p>
              <div className="landing-hero-actions">
                <Link className="button" href="/register">
                  {t("Start generating")}
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <a className="button secondary" href="#how-it-works">
                  {t("See how it works")}
                </a>
              </div>
              <p className="landing-free">
                <Check size={16} aria-hidden="true" />
                {t("Free to use")}
                <span aria-hidden="true">·</span>
                {t("Made for your words")}
              </p>
            </div>
            <GeneratorPreview />
          </section>
        </div>
        <section
          id="features"
          className="landing-section page-container"
          aria-labelledby="features-title"
        >
          <p className="landing-kicker">{t("Features")}</p>
          <h2 id="features-title">
            {t("Everything you need to find the right words")}
          </h2>
          <div className="landing-feature-grid">
            {features.map(({ icon: Icon, title, description }) => (
              <article className="landing-feature" key={title}>
                <span className="landing-icon">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <h3>{t(title)}</h3>
                <p>{t(description)}</p>
              </article>
            ))}
          </div>
        </section>
        <section
          id="how-it-works"
          className="landing-section landing-steps-section page-container"
          aria-labelledby="steps-title"
        >
          <p className="landing-kicker">{t("How it works")}</p>
          <h2 id="steps-title">
            {t("From product details to a finished description")}
          </h2>
          <ol className="landing-steps">
            {steps.map(({ title, description }, index) => (
              <li key={title}>
                <span className="landing-step-number" aria-hidden="true">
                  0{index + 1}
                </span>
                <h3>{t(title)}</h3>
                <p>{t(description)}</p>
              </li>
            ))}
          </ol>
        </section>
        <h1 className="text-center mt-8">Project Members</h1>
        <section
          id="about"
          className="landing-final page-container"
          aria-labelledby="final-title"
        >
          <MarqueeDemo />
        </section>
      </main>
      <footer className="landing-footer page-container">
        <span>Generate Description AI</span>
        <span>{t("Made for your words")}</span>
      </footer>
    </div>
  );
}
