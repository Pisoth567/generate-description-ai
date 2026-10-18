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
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <Preferences.Provider
        value={{ locale, setLocale: change, t: (s) => translate(locale, s) }}
      >
        {children}
      </Preferences.Provider>
    </ThemeProvider>
  );
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
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
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
      <label className="field">
        {t("Theme")}
        <select
          disabled={!mounted}
          aria-label={t("Theme")}
          value={mounted ? theme : "system"}
          onChange={(e) => setTheme(e.target.value)}
        >
          <option value="light">{t("Light")}</option>
          <option value="dark">{t("Dark")}</option>
          <option value="system">{t("System")}</option>
        </select>
      </label>
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
  return (
    <select
      className="!w-auto max-w-32"
      disabled={!mounted}
      aria-label={t("Navigation theme")}
      value={mounted ? theme : "system"}
      onChange={(e) => setTheme(e.target.value)}
    >
      <option value="light">{t("Light")}</option>
      <option value="dark">{t("Dark")}</option>
      <option value="system">{t("System")}</option>
    </select>
  );
}

export function LanguageControl({
  onLanguage,
}: {
  onLanguage: (locale: "en" | "km") => Promise<void>;
}) {
  const { locale, setLocale, t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <select
        className="!w-auto max-w-24"
        aria-label={t("Navigation language")}
        value={locale}
        disabled={busy}
        onChange={async (event) => {
          const value = event.target.value as "en" | "km";
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
        }}
      >
        <option value="en">English</option>
        <option value="km">ខ្មែរ</option>
      </select>
      {error && <p role="alert">{t(error)}</p>}
    </div>
  );
}
export function SkipLink() {
  const { t } = useTranslation();
  return (
    <a href="#main-content" className="skip-link">
      {t("Skip to content")}
    </a>
  );
}
