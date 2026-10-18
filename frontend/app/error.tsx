"use client";
import { useTranslation } from "@/components/preferences";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/brand";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useTranslation();
  return (
    <main id="main-content" className="page-container py-10">
      <Brand />
      <div className="card mx-auto mt-12 max-w-lg">
        <p className="eyebrow">{t("Let’s try that again")}</p>
        <h1>{t("This page couldn’t load.")}</h1>
        <p className="muted" role="alert">
          {t("Please check your connection and try again.")}
        </p>
        <div className="actions">
          <Button onClick={reset}>{t("Try again")}</Button>
          <Button asChild variant="outline">
            <Link href="/">{t("Back to home")}</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
