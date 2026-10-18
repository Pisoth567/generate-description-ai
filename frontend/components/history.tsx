"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import type { Generation } from "@/lib/types";
import { useTranslation } from "./preferences";
import { CopyButton, date, ErrorMessage, LoadingCards } from "./ui";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
export function History({ id }: { id?: string }) {
  const { t, locale } = useTranslation();
  const [items, setItems] = useState<Generation[]>([]);
  const [skip, setSkip] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("all");
  const heading = useRef<HTMLHeadingElement>(null);
  const focus = useRef(false);
  useEffect(() => {
    let active = true;
    api<Generation[] | Generation>(
      id ? `/api/generations/${id}` : `/api/generations?skip=${skip}&limit=20`,
    )
      .then((data) => {
        if (active) setItems(Array.isArray(data) ? data : [data]);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, skip, retry]);
  useEffect(() => {
    if (!loading && focus.current) {
      heading.current?.focus();
      focus.current = false;
    }
  }, [loading]);
  function load(offset: number) {
    setLoading(true);
    setError("");
    setSkip(offset);
    setRetry(retry + 1);
    focus.current = true;
  }
  const visible = items.filter(
    (item) =>
      (language === "all" || language === item.language) &&
      `${item.product_name} ${item.category || ""}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <>
      <h1 ref={heading} tabIndex={-1}>
        {t(id ? "Saved description" : "Generation history")}
      </h1>
      {id ? (
        <Link className="button secondary mb-5" href="/history">
          {t("Back to history")}
        </Link>
      ) : (
        <div className="card grid gap-4 sm:grid-cols-2">
          <label className="field">
            {t("Search this page")}
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="field">
            {t("Language")}
            <select
              aria-label={t("Language")}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="all">{t("All languages")}</option>
              <option value="English">{t("English")}</option>
              <option value="Khmer">{t("Khmer")}</option>
            </select>
          </label>
          <p className="muted text-sm">
            {t("Filters apply to the current page.")}
          </p>
          <Button
            variant="ghost"
            onClick={() => {
              setQuery("");
              setLanguage("all");
            }}
          >
            {t("Clear filters")}
          </Button>
        </div>
      )}
      <ErrorMessage message={t(error)} />
      {error && <Button onClick={() => load(skip)}>{t("Try again")}</Button>}
      {loading ? (
        <LoadingCards label={t("Loading descriptions…")} />
      ) : (
        !error && (
          <>
            {!visible.length && (
              <div className="card mt-5">
                <h2>
                  {t(
                    items.length
                      ? "No matching descriptions"
                      : "No descriptions yet",
                  )}
                </h2>
                <Link href="/generate">{t("Generate Description")}</Link>
              </div>
            )}
            {visible.map((item) => (
              <article className="card history-item" key={item.id}>
                <div className="row items-start">
                  <h2 className="min-w-0 flex-1">
                    {id ? (
                      item.product_name
                    ) : (
                      <Link href={`/history/${item.id}`}>
                        {item.product_name}
                      </Link>
                    )}
                  </h2>
                  <CopyButton text={item.generated_text} />
                </div>
                <p className="muted">
                  {t(item.category || "")} · {t(item.language)} · {t(item.tone)}
                </p>
                <time dateTime={item.created_at}>
                  {date(item.created_at, locale)}
                </time>
                <div
                  lang={item.language === "Khmer" ? "km" : "en"}
                  className={id ? "description" : "preview mt-4"}
                >
                  {id
                    ? item.generated_text
                    : item.generated_text.slice(0, 220) +
                      (item.generated_text.length > 220 ? "…" : "")}
                </div>
                {!id && (
                  <Link
                    className="inline-flex min-h-11 items-center"
                    href={`/history/${item.id}`}
                  >
                    {t("View saved description")}
                  </Link>
                )}
              </article>
            ))}
            {!id && (
              <nav aria-label={t("History")} className="actions">
                <Button
                  variant="outline"
                  disabled={skip === 0}
                  onClick={() => load(Math.max(0, skip - 20))}
                >
                  {t("Previous")}
                </Button>
                <span>{skip / 20 + 1}</span>
                <Button
                  variant="outline"
                  disabled={items.length < 20}
                  onClick={() => load(skip + 20)}
                >
                  {t("Next")}
                </Button>
              </nav>
            )}
          </>
        )
      )}
    </>
  );
}
