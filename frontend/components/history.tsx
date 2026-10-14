"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Search, ArrowLeft } from "lucide-react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { api } from "@/lib/client";
import type { Generation } from "@/lib/types";
import { CopyButton, date, ErrorMessage, LoadingCards, EmptyState } from "./ui";
export function History({ id }: { id?: string }) {
  const [items, setItems] = useState<Generation[]>([]),
    [skip, setSkip] = useState(0),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("all");
  const heading = useRef<HTMLHeadingElement>(null);
  const focusAfterLoad = useRef(false);
  const visibleItems = items.filter(
    (item) =>
      (language === "all" || item.language === language) &&
      `${item.product_name} ${item.category ?? ""}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  useEffect(() => {
    if (!loading && focusAfterLoad.current) {
      heading.current?.focus();
      focusAfterLoad.current = false;
    }
  }, [loading]);
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
  function load(offset: number) {
    focusAfterLoad.current = true;
    setLoading(true);
    setError("");
    setSkip(offset);
    setRetry(retry + 1);
  }
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">Your writing library</p>
        <h1 ref={heading} tabIndex={-1}>
          {id ? "Saved description" : "Generation history"}
        </h1>
        <p>
          {id
            ? "Review your description, then copy it wherever you sell."
            : "Every description, ready when you need it."}
        </p>
      </div>
      {id && (
        <Button asChild variant="ghost" className="mb-5">
          <Link href="/history">
            <ArrowLeft />
            Back to history
          </Link>
        </Button>
      )}
      {!id && (
        <div className="card mb-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_180px]">
            <div className="field">
              <Label htmlFor="history-search">Search this page</Label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-3 size-5 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="history-search"
                  type="search"
                  placeholder="Product name or category"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="field">
              <Label htmlFor="history-language">Language</Label>
              <select
                id="history-language"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
              >
                <option value="all">All languages</option>
                <option value="English">English</option>
                <option value="Khmer">Khmer</option>
              </select>
            </div>
          </div>
          <div className="row mt-3">
            <p className="text-sm muted !m-0">
              Filters apply to the current page of up to 20 descriptions.
            </p>
            {(query || language !== "all") && (
              <Button
                variant="ghost"
                onClick={() => {
                  setQuery("");
                  setLanguage("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>
      )}
      <ErrorMessage message={error} />
      {error && (
        <Button type="button" onClick={() => load(skip)}>
          Try again
        </Button>
      )}
      {loading ? (
        <LoadingCards label="Loading descriptions…" />
      ) : (
        !error && (
          <>
            {!items.length && (
              <Card>
                <EmptyState
                  title={
                    skip === 0
                      ? "No descriptions yet"
                      : "You’ve reached the end"
                  }
                >
                  <p>
                    {skip === 0
                      ? "Your generated descriptions will be saved here."
                      : "There are no more descriptions on this page. Go back to see your previous work."}
                  </p>
                  <Link className="button mt-3" href="/generate">
                    Generate your first description
                  </Link>
                </EmptyState>
              </Card>
            )}
            {!!items.length && !visibleItems.length && (
              <Card>
                <EmptyState title="No matches on this page">
                  <p>
                    Try another product name or language, or clear the filters.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-3"
                    onClick={() => {
                      setQuery("");
                      setLanguage("all");
                    }}
                  >
                    Clear filters
                  </Button>
                </EmptyState>
              </Card>
            )}
            {!id && !!items.length && (
              <p className="text-sm muted" role="status">
                Showing {visibleItems.length} of {items.length} descriptions on
                page {skip / 20 + 1}
              </p>
            )}
            {visibleItems.map((item) => (
              <article className="card history-item" key={item.id}>
                <h2>
                  {id ? (
                    item.product_name
                  ) : (
                    <Link href={`/history/${item.id}`}>
                      {item.product_name}
                    </Link>
                  )}
                </h2>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{item.language}</Badge>
                  <Badge variant="outline" className="capitalize">
                    {item.tone}
                  </Badge>
                  <span className="muted text-sm">
                    {item.category || "Uncategorized"}
                  </span>
                </div>
                <p>
                  <time dateTime={item.created_at}>
                    {date(item.created_at)}
                  </time>
                </p>
                <div
                  lang={item.language === "Khmer" ? "km" : "en"}
                  className={id ? "description" : "preview"}
                >
                  {id
                    ? item.generated_text
                    : item.generated_text.slice(0, 220) +
                      (item.generated_text.length > 220 ? "…" : "")}
                </div>
                {!id && (
                  <Link
                    className="mt-4 inline-flex min-h-11 items-center font-semibold text-primary"
                    href={`/history/${item.id}`}
                  >
                    View description →
                  </Link>
                )}
                {id && (
                  <>
                    <p>{item.tokens_used} tokens used</p>
                    <CopyButton text={item.generated_text} />
                  </>
                )}
              </article>
            ))}
            {!id && (
              <nav aria-label="History pagination" className="actions">
                <Button
                  type="button"
                  variant="outline"
                  disabled={skip === 0}
                  onClick={() => load(Math.max(0, skip - 20))}
                >
                  Previous
                </Button>
                <span>Page {skip / 20 + 1}</span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={items.length < 20}
                  onClick={() => load(skip + 20)}
                >
                  Next
                </Button>
              </nav>
            )}
          </>
        )
      )}
    </>
  );
}
