"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, Check, Link2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { ErrorMessage } from "./ui";
import { useSession } from "./session";
import { useTranslation } from "./preferences";
import { api } from "@/lib/client";
import { AVATAR_IDS } from "@/lib/avatars";
import type { User } from "@/lib/types";
import { UserAvatar } from "./user-avatar";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";

export function Account() {
  const params = useSearchParams();
  const { user, setUser, logout, loggingOut } = useSession();
  const { t, locale } = useTranslation();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(user.avatar_id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setSaving(true);
    setError("");
    try {
      const updated = await api<User>(
        "/api/profile/avatar",
        { avatar_id: selected },
        "PATCH",
      );
      setUser(updated);
      setOpen(false);
      toast.success(t("Avatar updated successfully."));
    } catch {
      setError("Could not update your avatar. Please try again.");
    } finally {
      setSaving(false);
    }
  }
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
      <section
        className="max-w-5xl overflow-hidden rounded-3xl border bg-card shadow-sm"
        aria-label={t("Profile")}
      >
        <div className="h-3 bg-primary/30" />
        <div className="flex flex-col items-center gap-6 p-6 sm:flex-row sm:gap-8 sm:p-10">
          <div className="flex shrink-0 flex-col items-center gap-4">
            <UserAvatar
              email={user.email}
              avatarId={user.avatar_id}
              size="large"
            />
            <Dialog
              open={open}
              onOpenChange={(value) => {
                setOpen(value);
                if (value) {
                  setSelected(user.avatar_id);
                  setError("");
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" disabled={saving}>
                  {t("Change avatar")}
                </Button>
              </DialogTrigger>
              <DialogContent
                closeLabel={t("Close")}
                className="max-h-[90dvh] overflow-y-auto p-4 sm:p-6"
              >
                <DialogHeader>
                  <DialogTitle className="pr-6 leading-relaxed">
                    {t("Choose your avatar")}
                  </DialogTitle>
                  <DialogDescription>
                    {t("Choose a built-in avatar or use your initial.")}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {AVATAR_IDS.map((id, index) => (
                    <button
                      key={id}
                      type="button"
                      disabled={saving}
                      aria-label={`${t("Select avatar")} ${index + 1}`}
                      aria-pressed={selected === id}
                      onClick={() => setSelected(id)}
                      className={`relative flex min-h-20 items-center justify-center rounded-xl border-2 p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${selected === id ? "border-primary bg-accent" : "border-transparent hover:bg-muted"}`}
                    >
                      <UserAvatar
                        email={user.email}
                        avatarId={id}
                        size="option"
                      />
                      {selected === id && (
                        <Check
                          aria-hidden="true"
                          className="absolute right-0 bottom-0 size-6 rounded-full bg-primary p-1 text-primary-foreground"
                        />
                      )}
                    </button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  aria-pressed={selected === null}
                  disabled={saving}
                  onClick={() => setSelected(null)}
                >
                  {selected === null && <Check aria-hidden="true" />}
                  {t("Use initials")}
                </Button>
                <ErrorMessage message={t(error)} />
                <DialogFooter>
                  <Button disabled={saving} onClick={save}>
                    {t(saving ? "Working…" : "Save")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="min-w-0 space-y-4 text-center sm:text-left">
            <p className="break-all text-lg font-semibold leading-relaxed sm:text-2xl">
              {user.email}
            </p>
            <div className="flex flex-wrap justify-center gap-3 sm:justify-start">
              <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-2 text-sm text-accent-foreground">
                {user.email_verified_at && (
                  <BadgeCheck size={18} aria-hidden="true" />
                )}
                {t(user.email_verified_at ? "Verified" : "Not verified")}
              </span>
              {user.google_linked && (
                <span className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm">
                  <Link2 size={16} aria-hidden="true" />
                  {t("Google Connected")}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-6 border-t bg-muted/30 p-6 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <dl className="space-y-2">
            <dt className="text-sm text-muted-foreground">
              {t("Member since")}
            </dt>
            <dd>
              {new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeZone: "UTC",
              }).format(new Date(user.created_at))}
            </dd>
          </dl>
          <Button
            variant="outline"
            disabled={loggingOut}
            onClick={logout}
            className="w-full sm:w-auto"
          >
            <LogOut aria-hidden="true" />
            {t(loggingOut ? "Working…" : "Log out")}
          </Button>
        </div>
      </section>
    </>
  );
}
