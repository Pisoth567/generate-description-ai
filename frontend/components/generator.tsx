"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { api, ApiError } from "@/lib/client";
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
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const previewRef = useRef("");
  useEffect(() => () => URL.revokeObjectURL(previewRef.current), []);
  function choose(file: File | null) {
    setError("");
    URL.revokeObjectURL(previewRef.current);
    previewRef.current = "";
    setPreview("");
    if (
      file &&
      (!["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 5 * 1024 * 1024)
    ) {
      setError("Choose a valid JPG, PNG, or WebP image under 5 MiB.");
      setImage(null);
      if (input.current) input.current.value = "";
      return;
    }
    setImage(file);
    if (file) {
      previewRef.current = URL.createObjectURL(file);
      setPreview(previewRef.current);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    data.delete("image");
    if (image) data.set("image", image);
    if (!category) data.delete("category");
    try {
      setResult(await api<GenerationResult>("/api/generate", data));
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === "image_model_unavailable"
          ? "The image could not be processed by the configured AI model."
          : e instanceof ApiError &&
              ["invalid_image", "image_too_large"].includes(e.code)
            ? "Choose a valid JPG, PNG, or WebP image under 5 MiB."
            : (e as Error).message,
      );
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
          <div
            className="field rounded-lg border border-dashed p-4"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              choose(e.dataTransfer.files[0] || null);
            }}
          >
            <label htmlFor="image">{t("Product Image (optional)")}</label>
            <Input
              ref={input}
              id="image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => choose(e.target.files?.[0] || null)}
            />
            <small>
              {t("JPG / PNG / WebP · up to 5 MiB. Images are not saved.")}
            </small>
            {preview && (
              <>
                <Image
                  unoptimized
                  width={400}
                  height={240}
                  src={preview}
                  alt={t("Product image preview")}
                  className="max-h-52 max-w-full rounded object-contain"
                  onError={() => {
                    choose(null);
                    setError(
                      "Choose a valid JPG, PNG, or WebP image under 5 MiB.",
                    );
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    choose(null);
                    if (input.current) input.current.value = "";
                  }}
                >
                  {t("Remove image")}
                </Button>
              </>
            )}
          </div>
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
