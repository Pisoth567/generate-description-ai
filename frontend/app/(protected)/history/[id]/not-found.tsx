"use client";
import { useTranslation } from "@/components/preferences";
import Link from "next/link";
export default function NotFound() {
  const { t } = useTranslation();
  return (
    <>
      <h1>{t("Description not found")}</h1>
      <Link href="/history">{t("Back to history")}</Link>
    </>
  );
}
