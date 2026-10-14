"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Link2,
  UserRound,
  Coins,
  Layers,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "./session";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ErrorMessage } from "./ui";
export function Account() {
  const { user } = useSession();
  const params = useSearchParams();
  const linked = params.get("google") === "linked" && user.google_linked;
  useEffect(() => {
    if (linked) toast.success("Google account linked", { id: "google-linked" });
  }, [linked]);
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">Personal settings</p>
        <h1>Account</h1>
        <p>Manage your account, plan, credits, and sign-in methods.</p>
      </div>
      <div className="max-w-3xl space-y-6">
        <section
          aria-label="Account overview"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <Card>
            <CardContent>
              <div className="row">
                <h2 className="!mb-0 text-base">Available Credits</h2>
                <Coins size={20} className="text-primary" aria-hidden="true" />
              </div>
              <p className="balance">{user.credits}</p>
              <p className="text-sm muted">
                Your current balance for product descriptions.
              </p>
              <Button asChild variant="outline" className="mt-3 w-full">
                <Link href="/pricing">Buy credits</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="row">
                <h2 className="!mb-0 text-base">Current Plan</h2>
                <Layers size={20} className="text-primary" aria-hidden="true" />
              </div>
              <p className="my-4 text-3xl font-semibold capitalize">
                {user.plan}
              </p>
              <p className="text-sm muted">
                Create in English or Khmer. Find your saved descriptions in{" "}
                <Link href="/history" className="text-primary underline">
                  History
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        </section>
        <Card>
          <CardContent>
            <div className="mb-6 flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-full bg-accent">
                <UserRound aria-hidden="true" />
              </span>
              <h2 className="!mb-0">Profile</h2>
            </div>
            <dl className="account-details !grid-cols-1">
              <div>
                <dt>Email</dt>
                <dd>{user.email}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="row">
              <h2>Connected accounts</h2>
              <Badge variant={user.google_linked ? "secondary" : "outline"}>
                {user.google_linked ? "Connected" : "Not connected"}
              </Badge>
            </div>
            <p className="muted">
              Use your Google account as another way to sign in.
            </p>
            {linked && (
              <p role="status" className="text-primary">
                Google account linked successfully.
              </p>
            )}
            <ErrorMessage
              message={
                params.has("error")
                  ? params.get("error") === "google_unavailable"
                    ? "Google sign-in is not currently available."
                    : "Google could not be linked. Choose the Google account with the same email as your account and try again."
                  : ""
              }
            />
            {user.google_linked ? (
              <p className="mt-5 flex items-center gap-2">
                <CheckCircle2
                  className="text-primary"
                  size={18}
                  aria-hidden="true"
                />
                Google account: Connected
              </p>
            ) : (
              <Button asChild variant="outline" className="mt-3">
                <a href="/api/auth/google/start?mode=link">
                  <Link2 />
                  Link Google account
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
        <div className="row rounded-xl border bg-card p-5">
          <div>
            <h2 className="!mb-1">Ready to write?</h2>
            <p className="muted text-sm !m-0">
              Turn your next product’s details into a description.
            </p>
          </div>
          <Button asChild>
            <Link href="/generate">
              <Sparkles aria-hidden="true" />
              Generate description
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}
