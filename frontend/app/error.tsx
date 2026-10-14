"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/brand";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="page-container py-10">
      <Brand />
      <div className="card mx-auto mt-12 max-w-lg">
        <p className="eyebrow">Let’s try that again</p>
        <h1>This page couldn’t load.</h1>
        <p className="muted" role="alert">
          Please check your connection and try again. If you were checking a
          payment, review its status before making another purchase.
        </p>
        <div className="actions">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
