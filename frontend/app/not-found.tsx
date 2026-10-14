import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
export default function NotFound() {
  return (
    <main id="main-content" className="page-container py-10">
      <Brand />
      <div className="mx-auto max-w-lg py-16 text-center">
        <FileQuestion
          className="mx-auto mb-6 size-12 text-primary"
          aria-hidden="true"
        />
        <p className="eyebrow">Page not found</p>
        <h1>Let’s get you back to your work.</h1>
        <p className="muted">
          This page may have moved, or the link may be incomplete.
        </p>
        <div className="actions justify-center">
          <Button asChild>
            <Link href="/generate">Open workspace</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft />
              Back to home
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
