#!/usr/bin/env bash
# Only an isolated local test database; never source deployment credentials.
export DATABASE_URL='postgresql+psycopg://pisoth@127.0.0.1:55439/phase2_test'
export JWT_SECRET_KEY='isolated-test-key-not-for-real-authentication-123456'
export EMAIL_VERIFICATION_SECRET='isolated-test-email-key-not-for-production-123456'
export EMAIL_PROVIDER=''
export SMTP_HOST=''
export SMTP_USERNAME=''
export SMTP_PASSWORD=''
export OPENAI_API_KEY=''
export OPENAI_MODEL=''
export GOOGLE_CLIENT_ID=''
export PHASE1_ISOLATED_DATABASE=1
exec "$@"
