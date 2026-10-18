"use client";
import { useTranslation } from "@/components/preferences";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="page-container">
      <h1>{t("Service temporarily unavailable")}</h1>
      <p role="alert">{t("We could not load this page. Please try again.")}</p>
      <Button type="button" onClick={reset}>
        {t("Try again")}
      </Button>
    </div>
  );
}
