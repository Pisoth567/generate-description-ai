"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="container"><h1>Service temporarily unavailable</h1><p role="alert">We could not load this page. Please try again.</p><button type="button" onClick={reset}>Try again</button></main>; }
