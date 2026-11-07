# Local Node.js backend

This is the first self-hostable backend runtime for Marketing Genius. It reuses the existing, tested Worker request handlers through a small Cloudflare-KV-compatible adapter backed by SQLite. That preserves the current API routes and business rules while removing the Cloudflare Workers/KV runtime dependency for a local installation.

## Requirements

- Node.js 24 or newer (uses the built-in `node:sqlite` module).
- No npm package installation is required for the local API runtime.
- Copy `.env.example` values into your process environment. Never commit real credentials.

## Run locally

From the repository root:

```sh
cp backend/local/.env.example .env
# Edit .env and set a private owner password and long random SESSION_SECRET.
set -a && . ./.env && set +a
node backend/local/server.mjs
```

The API listens on `http://127.0.0.1:8787` by default and stores data in `./data/marketing-genius.sqlite`. Keep the data directory backed up. For local frontend testing, set the app's API URL to the local API address and set `APP_ORIGIN` to the exact frontend origin.

## Docker

Build from the repository root:

```sh
docker build -f backend/local/Dockerfile -t marketing-genius-local .
docker run --name marketing-genius -p 8787:8787 \
  -v mgcc-data:/app/data \
  --env APP_LOGIN_PASSWORD='replace-me' \
  --env SESSION_SECRET='replace-with-a-long-random-secret' \
  --env APP_ORIGIN='http://localhost:4173' \
  marketing-genius-local
``

Use a reverse proxy with HTTPS before exposing this service outside the local machine. Do not expose the SQLite database file over the web.

## What is preserved

The local service invokes the same `backend/worker.js` handler used by the Cloudflare deployment. It therefore retains the existing API contract for health, owner login/session, profile, campaigns, operations, research, chat, channel strategy, campaign generation, publishing and analytics. SQLite implements the small KV interface those handlers require, including JSON reads, expiry and paginated prefix listing.

The daily research trigger defaults to 14:00 UTC, matching the existing Wrangler schedule. It is checked by the local process every 15 seconds and only fires once per UTC day. The machine and process must remain running at the scheduled time. If the service is stopped then, that day's scheduled trigger is missed; it does not backfill automatically.

## Important current limitations

- This removes Cloudflare Workers and KV from the local runtime, but it does **not** yet remove OpenAI. Chat, strategy, generation and live research still require the optional `OPENAI_API_KEY` and can incur provider charges.
- The local runtime can use optional Meta credentials for publishing and Facebook analytics. Those platform integrations remain third-party services and are never open source.
- A local AI model adapter, provider-neutral research replacement, model licence audit, automated backup/restore and production-hardening review are still future work.
- The local scheduler records a daily trigger marker. A missed or failed scheduled run needs owner review; no claim of always-on monitoring is made.
- Node's built-in SQLite is used to avoid a native npm dependency. Use a current supported Node 24+ release.

## Test

```sh
node --test backend/worker.test.mjs backend/local/server.test.mjs
```

The Cloudflare Worker tests remain the business-rule regression suite. The local tests verify SQLite KV compatibility and end-to-end owner login through the local HTTP server.
