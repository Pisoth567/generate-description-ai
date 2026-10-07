# AI Product Description Generator

Monorepo with a Next.js frontend and a modular FastAPI backend.

## Run the backend

Requires Python 3.10 or newer.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open http://127.0.0.1:8000, http://127.0.0.1:8000/health, or the interactive
API documentation at http://127.0.0.1:8000/docs.

Defaults work without an environment file. Available configuration is documented
in `backend/.env.example`; environment variables override an optional
`backend/.env`. Never commit real credentials. CORS allows
`http://localhost:3000` by default, configurable with `FRONTEND_URL`.

```bash
curl -X POST http://127.0.0.1:8000/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"product_name":"Wireless Headphones","category":"Electronics","features":["Bluetooth 5.3","Noise cancellation","30-hour battery"],"tone":"professional","language":"English"}'
```

The mock returns deterministic English copy based on the product, optional
category, and required features list (which may be empty). Tone and language
default to `professional` and `English` and are echoed as metadata; the mock does
not translate or adapt tone. Invalid requests return HTTP 422.

Routes live in `app/api`, validation models in `app/schemas`, configuration in
`app/core`, and the replaceable mock generator in `app/services`. There are no
AI-provider, database, authentication, credit-limit, or payment integrations yet.

## Docker

From the repository root:

```bash
docker build -t generate-description-api backend
docker run --rm -p 8000:8000 generate-description-api
```

The container runs Uvicorn as a non-root user without development reload.
