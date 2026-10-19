# Staging configuration reference

No deployment is part of Phase 2. Applying `render.yaml` may create billable infrastructure and requires a separate operational decision. Automatic deployment remains off. Do not add automatic database migrations to startup.

Backend: configure the database URL, JWT signing secret, frontend HTTPS origin, OpenAI key/model, Google client ID, dedicated email-verification secret, sender and SMTP settings from `backend/.env.example`. Keep every secret in the server secret store. SMTP requires certificate-verified STARTTLS or implicit TLS; use provider-issued credentials, never a personal mailbox password.

Frontend: configure server-only `BACKEND_URL`, Google client ID/secret and exact redirect URI. Set `SITE_URL` to the public HTTPS origin. Never expose backend secrets through NEXT_PUBLIC variables. Google authorized redirects must match the frontend callback exactly. See [Google authentication](GOOGLE_AUTH.md).

Before deploying the Phase 2 revision, stop application traffic, export and verify a database backup, inspect the migration, and follow the explicit manual commands in [Phase 2](PHASE2_PRODUCT_SIMPLIFICATION.md). The cleanup migration loses retired historical data; downgrade recreates schema only. It preserves users and generations.

Review `/health`, authenticated history ownership, registration/verification/login, Google sign-in, UI language and theme in an approved staging review. Provider checks must be separately authorized; automated verification uses mocks. Restore a verified backup to a separate database for recovery and assess it before changing the application connection.
