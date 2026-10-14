"use client";
import { Toaster } from "sonner";
export function Notifications() {
  return (
    <Toaster
      position="bottom-right"
      closeButton
      toastOptions={{
        style: {
          background: "var(--card)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
        },
      }}
    />
  );
}
