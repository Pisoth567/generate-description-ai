"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useSyncExternalStore,
  useRef,
  type ReactNode,
} from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { translate } from "@/lib/translations";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
const Preferences = createContext({
  locale: "en" as "en" | "km",
  setLocale: (() => {}) as (locale: "en" | "km") => void,
  t: (s: string) => s,
});
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const explicitLocale = useRef(false);
  const [locale, setLocale] = useState<"en" | "km">("en");
  useEffect(() => {
    const stored = localStorage.getItem("ui_language");
    queueMicrotask(() => {
      if (!explicitLocale.current && stored === "km") setLocale(stored);
    });
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const change = useCallback((value: "en" | "km") => {
    explicitLocale.current = true;
    setLocale(value);
    localStorage.setItem("ui_language", value);
  }, []);
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      themes={["light", "dark"]}
      disableTransitionOnChange
    >
      <ThemePreferenceGuard />
      <Preferences.Provider
        value={{ locale, setLocale: change, t: (s) => translate(locale, s) }}
      >
        {children}
      </Preferences.Provider>
    </ThemeProvider>
  );
}

function ThemePreferenceGuard() {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    queueMicrotask(() => document.documentElement.classList.remove("system"));
    if (theme && theme !== "light" && theme !== "dark") {
      setTheme("light");
    }
  }, [setTheme, theme]);

  return null;
}
export function useTranslation() {
  return useContext(Preferences);
}
export function PreferenceControls({
  onLanguage,
}: {
  onLanguage?: (locale: "en" | "km") => Promise<void>;
}) {
  const { locale, setLocale, t } = useTranslation();
  const [error, setError] = useState("");
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="field">
        {t("Application language")}
        <select
          aria-label={t("Application language")}
          value={locale}
          onChange={async (e) => {
            const value = e.target.value as "en" | "km";
            try {
              await onLanguage?.(value);
              setLocale(value);
              setError("");
            } catch {
              setError(t("Something went wrong. Please try again later."));
            }
          }}
        >
          <option value="en">English</option>
          <option value="km">ខ្មែរ</option>
        </select>
      </label>
      <div className="field">
        <span>{t("Theme")}</span>
        <ThemeControl />
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function ThemeControl() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  // Match the server icon and label on the first hydration render. The stored
  // next-themes value is only available in the browser.
  const currentTheme = mounted && theme === "dark" ? "dark" : "light";
  const label = t(
    currentTheme === "light" ? "Switch to dark mode" : "Switch to light mode",
  );

  return (
    <AnimatedThemeToggler
      className="theme-toggle"
      disabled={!mounted}
      aria-label={label}
      title={label}
      theme={currentTheme}
      onThemeChange={setTheme}
    />
  );
}

export function LanguageControl({
  onLanguage,
  menuContainer,
}: {
  onLanguage: (locale: "en" | "km") => Promise<void>;
  menuContainer?: HTMLElement | null;
}) {
  const { locale, setLocale, t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function changeLanguage(value: "en" | "km") {
    if (value === locale) return;
    setBusy(true);
    try {
      await onLanguage(value);
      setLocale(value);
      setError("");
    } catch {
      setError("Something went wrong. Please try again later.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* Header menus must not hide page segments that may still be hydrating. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="language-toggle"
            aria-label={t("Navigation language")}
            title={t(locale === "en" ? "English" : "Khmer")}
            disabled={busy}
          >
            <span aria-hidden="true" className="language-flag">
              {locale === "en" ? "🇬🇧" : "🇰🇭"}
            </span>
            <ChevronDown aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          container={menuContainer}
          align="end"
          className="min-w-36"
        >
          <DropdownMenuRadioGroup
            value={locale}
            onValueChange={(value) => void changeLanguage(value as "en" | "km")}
          >
            <DropdownMenuRadioItem value="en">
              <span aria-hidden="true" className="language-flag">
                🇬🇧
              </span>
              English
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="km">
              <span aria-hidden="true" className="language-flag">
                🇰🇭
              </span>
              ខ្មែរ
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {error && <p role="alert">{t(error)}</p>}
    </div>
  );
}
export function SkipLink() {
  const { t } = useTranslation();
  return (
    <nav aria-label={t("Skip to content")}>
      <a href="#main-content" className="skip-link">
        {t("Skip to content")}
      </a>
    </nav>
  );
}
