"use client";
import { useSearchParams } from "next/navigation";
import { ErrorMessage } from "./ui";
import { useSession } from "./session";
import { PreferenceControls, useTranslation } from "./preferences";
import { api } from "@/lib/client";
import { date } from "./ui";
export function Account() {
  const params = useSearchParams();
  const { user, refresh } = useSession();
  const { t, locale } = useTranslation();
  return (
    <>
      <h1>{t("Profile")}</h1>
      <ErrorMessage
        message={
          params.has("error")
            ? t(
                "Google could not be linked. Please use the Google account with the same email and try again.",
              )
            : ""
        }
      />
      <section className="card max-w-3xl space-y-6">
        <dl className="account-details">
          <div>
            <dt>{t("Email")}</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>{t("Email status")}</dt>
            <dd>{t(user.email_verified_at ? "Verified" : "Not verified")}</dd>
          </div>
          <div>
            <dt>{t("Member since")}</dt>
            <dd>{date(user.created_at, locale)}</dd>
          </div>
          <div>
            <dt>{t("Connected accounts")}</dt>
            <dd>
              Google: {t(user.google_linked ? "Connected" : "Not connected")}
            </dd>
          </div>
        </dl>
        {!user.google_linked && (
          <a
            className="button secondary"
            href="/api/auth/google/start?mode=link"
          >
            {t("Link Google account")}
          </a>
        )}
        <PreferenceControls
          onLanguage={async (ui_language) => {
            await api("/api/auth/preferences", { ui_language });
            await refresh();
          }}
        />
      </section>
    </>
  );
}
