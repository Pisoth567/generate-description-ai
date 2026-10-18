"use client";
import { useTranslation } from "./preferences";
import { Toaster } from "sonner";
export function Notifications() {
  const { t } = useTranslation();
  return (
    <Toaster
      position="bottom-right"
      containerAriaLabel={t("Notifications")}
      closeButton
      toastOptions={{
        closeButtonAriaLabel: t("Close notification"),
        style: {
          background: "var(--card)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
        },
      }}
    />
  );
}
