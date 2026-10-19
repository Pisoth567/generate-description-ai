# Generate Description AI

Free, text-only product descriptions in English or Khmer. Next.js provides the bilingual UI and same-origin BFF; FastAPI handles verified accounts, Google identity, the OpenAI Responses API, and PostgreSQL history.

Read [Phase 2 architecture, configuration, migration safety and local checks](PHASE2_PRODUCT_SIMPLIFICATION.md) before running migrations. Existing Phase 1 security and records are preserved except for the explicitly retired schema described there.

## Local setup

Backend requires PostgreSQL and the configuration in `backend/.env.example`. Copy it to an ignored `.env` and configure server-only secrets locally; defaults do not supply working database or provider credentials.

```bash
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

```bash
cd frontend
npm ci
npm run dev
```

Set frontend server-only `BACKEND_URL=http://127.0.0.1:8000` in the ignored `.env.local`. See [frontend instructions](frontend/README.md) for a provider-free fixture UI. Normal application generation and registration use configured providers; automated checks use mocks.
