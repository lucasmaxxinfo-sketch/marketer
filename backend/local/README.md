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

The API listens on `http://127.0.0.1:8787` by default and stores data in `./data/marketing-genius.sqlite`. The Compose stack starts Ollama and stores downloaded model files in a separate named volume. Pull the default `qwen3:4b` model once after startup. Keep the data and model volumes backed up. For local frontend testing, set the app's API URL to the local API address and set `APP_ORIGIN` to the exact frontend origin.

## Docker Compose

Copy the environment template to the Compose environment file, edit the credentials, then start the service:

```sh
cp backend/local/.env.example backend/local/.env
# Edit backend/local/.env before starting.
docker compose up -d --build
docker compose exec ollama ollama pull qwen3:4b
docker compose logs -f marketing-genius-api
```

Compose binds the API to localhost only and stores the SQLite database in a named Docker volume.

To create an online SQLite backup from the host when running the bare Node service:

```sh
node backend/local/backup.mjs ./backups/marketing-genius-backup.sqlite
```

The destination must not already exist. The backup utility runs SQLite's online `VACUUM INTO` operation and verifies database integrity. Keep backups somewhere separate from the machine running Kira.

## Docker (manual)

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

- This removes Cloudflare Workers and KV from the local runtime. Kira chat, channel strategy and campaign generation can use the local Ollama model without an OpenAI key. Live web research still uses the optional hosted OpenAI Responses API and can incur provider charges. Leave `OPENAI_API_KEY` blank to prevent hosted AI calls; live research will remain unavailable until a local research provider is implemented.
- The local runtime can use optional Meta credentials for publishing and Facebook analytics. Those platform integrations remain third-party services and are never open source. The default Ollama runtime is MIT-licensed, and the Qwen3-4B model is Apache-2.0 licensed. Check each model's own licence before switching models.
- A local AI model adapter, provider-neutral research replacement, model licence audit, automated restore drill and production-hardening review are still future work.
- The local scheduler records a daily trigger marker. A missed or failed scheduled run needs owner review; no claim of always-on monitoring is made.
- Node's built-in SQLite is used to avoid a native npm dependency. Use a current supported Node 24+ release.

## Test

```sh
node --test backend/worker.test.mjs backend/local/server.test.mjs
```

The Cloudflare Worker tests remain the business-rule regression suite. The local tests verify SQLite KV compatibility and end-to-end owner login through the local HTTP server.


## AI licence notes

- [Ollama](https://github.com/ollama/ollama) is MIT licensed.
- [Qwen3-4B](https://huggingface.co/Qwen/Qwen3-4B) is published under Apache-2.0.
- Model licence and runtime licence are separate. Check the exact model card and licence before selecting a different model.
