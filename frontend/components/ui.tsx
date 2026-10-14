"use client";
import { useState } from "react";
import { Check, Copy, AlertCircle, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Alert, AlertDescription } from "./ui/alert";
import { Skeleton } from "./ui/skeleton";
export function ErrorMessage({ message }: { message: string }) {
  return message ? (
    <Alert variant="destructive" className="my-4" tabIndex={-1}>
      <AlertCircle aria-hidden="true" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  ) : null;
}
export function CopyButton({ text }: { text: string }) {
  const [message, setMessage] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setMessage("Copied to clipboard.");
            toast.success("Description copied");
          } catch {
            setMessage(
              "Copy unavailable. Select the description and copy it manually.",
            );
            toast.error("Copy unavailable");
          }
        }}
      >
        {message === "Copied to clipboard." ? (
          <Check aria-hidden="true" />
        ) : (
          <Copy aria-hidden="true" />
        )}
        Copy Description
      </Button>
      <span className="text-sm text-muted-foreground" role="status">
        {message}
      </span>
    </div>
  );
}
export function LoadingCards({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="card-grid">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((i) => (
        <div className="card space-y-4" key={i} aria-hidden="true">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <FileText
        className="mb-4 text-muted-foreground"
        size={30}
        aria-hidden="true"
      />
      <h2>{title}</h2>
      <div className="muted">{children}</div>
    </div>
  );
}
export function date(value: string) {
  return (
    new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(value)) + " UTC"
  );
}
