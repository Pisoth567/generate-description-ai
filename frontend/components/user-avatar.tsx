"use client";
import Image from "next/image";
import { useState } from "react";
import { avatarSource, emailInitial } from "@/lib/avatars";
import { useTranslation } from "./preferences";

export function UserAvatar({
  email,
  avatarId,
  size = "small",
}: {
  email: string;
  avatarId: string | null;
  size?: "small" | "large" | "option";
}) {
  const { t } = useTranslation();
  const source = avatarSource(avatarId);
  const [failed, setFailed] = useState<string | null>(null);
  const pixels = size === "large" ? 112 : size === "option" ? 64 : 32;
  return (
    <span
      className="inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-accent font-semibold text-accent-foreground"
      style={{ width: pixels, height: pixels, fontSize: pixels / 2.5 }}
    >
      {source && failed !== source ? (
        <Image
          src={source}
          alt={`${t("Profile avatar")}: ${email}`}
          width={pixels}
          height={pixels}
          unoptimized
          className="h-full w-full object-cover"
          onError={() => setFailed(source)}
        />
      ) : (
        <span role="img" aria-label={`${t("Initials avatar")}: ${email}`}>
          {emailInitial(email)}
        </span>
      )}
    </span>
  );
}
