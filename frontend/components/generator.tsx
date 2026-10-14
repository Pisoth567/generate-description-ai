"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import type { GenerationResult } from "@/lib/types";
import { useSession } from "./session";
import { CopyButton, ErrorMessage } from "./ui";
import { Sparkles, FileText, LoaderCircle, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { Skeleton } from "./ui/skeleton";
export function Generator() {
  const { user, refresh } = useSession();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<GenerationResult | null>(null);
  const [featuresText, setFeaturesText] = useState("");
  const [tone, setTone] = useState("professional");
  const [balanceError, setBalanceError] = useState("");
  const [refreshingBalance, setRefreshingBalance] = useState(false);
  const featureLines = featuresText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const featuresInvalid =
    featureLines.length > 20 || featureLines.some((line) => line.length > 300);
  const toneHelp: Record<string, string> = {
    professional: "Clear, confident, and informative.",
    friendly: "Warm, approachable, and conversational.",
    luxury: "Refined language for a premium feel.",
    simple: "Straightforward wording that gets to the point.",
  };
  async function refreshBalance() {
    setRefreshingBalance(true);
    try {
      await refresh();
      setBalanceError("");
    } catch {
      setBalanceError(
        "Your description is saved, but the credit balance could not be refreshed.",
      );
    } finally {
      setRefreshingBalance(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const values = new FormData(event.currentTarget);
    const productName = String(values.get("product_name")).trim();
    if (!productName) {
      setError("Enter a product name, not only spaces.");
      event.currentTarget
        .querySelector<HTMLInputElement>("#product-name")
        ?.focus();
      return;
    }
    const features = String(values.get("features"))
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (features.length > 20 || features.some((s) => s.length > 300)) {
      setError("Use up to 20 features, each no longer than 300 characters.");
      return;
    }
    setBalanceError("");
    setBusy(true);
    try {
      const data = await api<GenerationResult>("/api/generate", {
        product_name: productName,
        category: String(values.get("category")).trim() || null,
        features,
        tone: values.get("tone"),
        language: values.get("language"),
      });
      setResult(data);
      toast.success("Description saved to history");
      await refreshBalance();
    } catch (e) {
      setError((e as Error).message);
      toast.error("Could not complete generation");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">Create something compelling</p>
        <h1>Generate a description</h1>
        <p>Share the details. Choose your voice. Give your product a story.</p>
      </div>
      <div className="split">
        <Card>
          <CardContent>
            <h2>Product details</h2>
            <p className="muted text-sm mb-6">
              A little detail goes a long way. Required fields are marked *.
            </p>
            <form className="form-stack" onSubmit={submit} aria-busy={busy}>
              <div className="field">
                <Label htmlFor="product-name">Product Name *</Label>
                <Input
                  id="product-name"
                  name="product_name"
                  required
                  maxLength={200}
                  placeholder="e.g. Everyday canvas tote"
                />
              </div>
              <div className="field">
                <Label htmlFor="category">
                  Category <span className="muted font-normal">(optional)</span>
                </Label>
                <Input
                  id="category"
                  name="category"
                  maxLength={100}
                  placeholder="e.g. Bags & accessories"
                />
              </div>
              <div className="field">
                <div className="row">
                  <Label htmlFor="features">Features</Label>
                  <span
                    className={
                      featuresInvalid
                        ? "text-sm text-destructive"
                        : "text-sm text-muted-foreground"
                    }
                  >
                    {featureLines.length}/20 features
                  </span>
                </div>
                <Textarea
                  id="features"
                  name="features"
                  rows={5}
                  value={featuresText}
                  onChange={(event) => setFeaturesText(event.target.value)}
                  aria-invalid={featuresInvalid}
                  aria-describedby={
                    featuresInvalid
                      ? "features-help features-error"
                      : "features-help"
                  }
                  placeholder={
                    "Durable cotton canvas\nComfortable shoulder straps\nInside pocket for essentials"
                  }
                />
                <small id="features-help">
                  One feature per line. Up to 20 features, 300 characters each.
                </small>
                {featuresInvalid && (
                  <p
                    id="features-error"
                    role="status"
                    className="text-sm text-destructive"
                  >
                    Use up to 20 features, each no longer than 300 characters.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-5">
                <div className="field">
                  <Label htmlFor="tone">Tone</Label>
                  <select
                    id="tone"
                    name="tone"
                    value={tone}
                    onChange={(event) => setTone(event.target.value)}
                    aria-describedby="tone-help"
                  >
                    {["Professional", "Friendly", "Luxury", "Simple"].map(
                      (t) => (
                        <option key={t} value={t.toLowerCase()}>
                          {t}
                        </option>
                      ),
                    )}
                  </select>
                  <small id="tone-help">{toneHelp[tone]}</small>
                </div>
                <fieldset className="min-w-0">
                  <legend className="mb-2 text-sm font-medium">Language</legend>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: "English", subtitle: "Write in English" },
                      { value: "Khmer", subtitle: "ខ្មែរ" },
                    ].map(({ value, subtitle }) => (
                      <label key={value} className="language-option">
                        <input
                          type="radio"
                          name="language"
                          value={value}
                          aria-label={value}
                          defaultChecked={value === "English"}
                          className="size-4 accent-[var(--primary)]"
                        />
                        <span>
                          <span className="block text-sm font-semibold">
                            {value}
                          </span>
                          <span
                            className="block text-sm text-muted-foreground"
                            lang={value === "Khmer" ? "km" : "en"}
                          >
                            {subtitle}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
              <ErrorMessage message={error} />
              <Button
                type="submit"
                disabled={busy || featuresInvalid}
                className="w-full"
              >
                {busy ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles aria-hidden="true" />
                )}
                {busy ? "Generating…" : "Generate Description"}
              </Button>
              <p className="text-center text-sm muted !mt-0">
                {user.credits} credits available · Saved automatically to
                history
              </p>
            </form>
          </CardContent>
        </Card>
        <Card className="result-card lg:sticky lg:top-6" aria-busy={busy}>
          <CardContent>
            <div className="row">
              <h2 className="!mb-0">Your description</h2>
              <Badge variant="secondary">
                {busy ? "Writing" : result ? "Saved" : "Ready when you are"}
              </Badge>
            </div>
            <div aria-live="polite">
              {busy ? (
                <div role="status" className="space-y-5 py-10">
                  <p className="muted">
                    Finding the right words for your product…
                  </p>
                  {[100, 90, 95, 75, 85].map((width, i) => (
                    <Skeleton
                      key={i}
                      className="h-4"
                      style={{ width: `${width}%` }}
                    />
                  ))}
                </div>
              ) : result ? (
                <>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Badge variant="secondary">{result.language}</Badge>
                    <Badge variant="outline" className="capitalize">
                      {result.tone}
                    </Badge>
                  </div>
                  <div
                    className="description"
                    lang={result.language === "Khmer" ? "km" : "en"}
                  >
                    {result.description}
                  </div>
                  <div className="flex flex-wrap gap-2 border-t pt-4">
                    <Badge variant="outline">
                      {result.tokens_used} tokens used
                    </Badge>
                    <Badge variant="outline">
                      {result.credits_used} credits used
                    </Badge>
                    <Badge variant="secondary">
                      {result.credits_remaining} credits remaining at generation
                    </Badge>
                  </div>
                  <p className="text-sm muted mt-4">
                    Review product claims and details before publishing.
                  </p>
                  {balanceError && (
                    <Alert className="mt-4">
                      <AlertDescription>
                        <p>{balanceError}</p>
                        <Button
                          variant="outline"
                          disabled={refreshingBalance}
                          onClick={refreshBalance}
                        >
                          {refreshingBalance
                            ? "Refreshing…"
                            : "Refresh credit balance"}
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="actions">
                    <CopyButton
                      key={result.description}
                      text={result.description}
                    />
                    <Button asChild variant="ghost">
                      <Link href={`/history/${result.generation_id}`}>
                        View saved description
                        <ArrowUpRight />
                      </Link>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="result-empty">
                  <span className="mb-4 grid size-14 place-items-center rounded-xl bg-muted">
                    <FileText className="text-primary" aria-hidden="true" />
                  </span>
                  <h3>Your next description starts here</h3>
                  <p className="muted text-sm">
                    Add your product details and select Generate Description.
                    Your result will appear here, ready to review and copy.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
