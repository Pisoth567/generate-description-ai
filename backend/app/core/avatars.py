"""IDs of the shipped frontend/public/avatars JPG assets; never URLs or paths."""

ALLOWED_AVATAR_IDS = frozenset(f"avatar-{number:02d}" for number in range(1, 13))
