export const AVATAR_IDS = Array.from(
  { length: 12 },
  (_, i) => `avatar-${String(i + 1).padStart(2, "0")}`,
);
export function avatarSource(id: string | null | undefined): string | null {
  return id && AVATAR_IDS.includes(id) ? `/avatars/${id}.jpg` : null;
}
export function emailInitial(email: string | null | undefined): string {
  if (typeof email !== "string") return "?";
  const local = email.split("@")[0];
  return (
    Array.from(local)
      .find((char) => /[\p{L}\p{N}]/u.test(char))
      ?.toUpperCase() ?? "?"
  );
}
