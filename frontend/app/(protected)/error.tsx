"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="page-container">
      <h1>Service temporarily unavailable</h1>
      <p role="alert">We could not load this page. Please try again.</p>
      <Button type="button" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
