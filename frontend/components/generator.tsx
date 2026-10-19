"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import type { GenerationResult } from "@/lib/types";
import { useTranslation } from "./preferences";
import { CategoryCombobox } from "./category-combobox";
import { CopyButton, ErrorMessage } from "./ui";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
export function Generator() {
  const { t } = useTranslation();
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    if (!category) data.delete("category");
    try {
      setResult(
        await api<GenerationResult>("/api/generate", Object.fromEntries(data)),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h1>{t("Generate Description")}</h1>
      <p className="muted">{t("Saved automatically to History.")}</p>
      <div className="split">
        <form className="card form-stack" onSubmit={submit}>
          <label className="field">
            {t("Product Name")}
            <Input name="product_name" required maxLength={200} />
          </label>
          <CategoryCombobox value={category} onChange={setCategory} />
          <label className="field">
            {t("Product Details / Features")}
            <Textarea name="features" required maxLength={6000} rows={6} />
            <small>
              {t(
                "Add known features, specifications, benefits, materials, dimensions, or other details.",
              )}
            </small>
          </label>
          <label className="field">
            {t("Tone")}
            <select aria-label={t("Tone")} name="tone">
              {["professional", "friendly", "luxury", "simple"].map((value) => (
                <option key={value} value={value}>
                  {t(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            {t("Output Language")}
            <select aria-label={t("Output Language")} name="language">
              <option value="English">{t("English")}</option>
              <option value="Khmer">{t("Khmer")}</option>
            </select>
          </label>
          <ErrorMessage message={t(error)} />
          <Button disabled={busy}>
            {t(busy ? "Generating…" : "Generate Description")}
          </Button>
        </form>
        <section className="card min-h-80" aria-busy={busy}>
          <div className="row">
            <h2>{t("Your description")}</h2>
            {result && <CopyButton text={result.description} />}
          </div>
          <div aria-live="polite">
            {busy ? (
              <p role="status">{t("Generating…")}</p>
            ) : result ? (
              <>
                <div
                  className="description"
                  lang={result.language === "Khmer" ? "km" : "en"}
                >
                  {result.description}
                </div>
                <Link href={`/history/${result.generation_id}`}>
                  {t("View saved description")}
                </Link>
              </>
            ) : (
              <p>{t("Add your product details to get started.")}</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
