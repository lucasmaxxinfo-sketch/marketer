# Local Node.js backend

This is the first self-hostable backend runtime for Marketing Genius. It reuses the existing, tested Worker request handlers through a small Cloudflare-KV-compatible adapter backed by SQLite. That preserves the current API routes and business rules while removing the Cloudflare Workers/KV runtime dependency for a local installation.

## Requirements

- Node.js 24 or newer (uses the built-in `node:sqlite` module).
- No npm package installation is required for the local API runtime.
- Copy `.env.example` values into your process environment. Never commit real credentials.

## Guided installation (recommended)

Requirements: Docker Desktop (or Docker Engine with Compose) running, and Node.js 24 or newer. The installer works on Windows, macOS and Linux.

From the repository folder, run:

```sh
node backend/local/install.mjs
```

The installer checks Docker, creates `backend/local/.env` with unique random owner/session/search secrets, preserves any existing non-placeholder settings, builds and starts the API/Ollama/SearXNG containers, waits for the API health check, downloads the model selected by `LOCAL_AI_MODEL` in `backend/local/.env` (default `qwen3:4b`), and runs a real local model response test. The same configured model is passed into the API container; it is not silently replaced by a Docker default. It prints a newly generated owner password once immediately after saving the configuration, before downloading the model. Save it somewhere private even if a later installation step needs troubleshooting. The secret file is excluded from Git.

When successful, open the hosted command centre and connect the API address `http://localhost:8787` in Settings. The browser and local services must be on the same computer. The first model download is several gigabytes and can take time depending on internet speed. Keep Docker running while Kira performs scheduled work.

The installer does not delete existing SQLite data or Docker volumes. If a step fails, it leaves the configuration and containers in place so the issue can be diagnosed and installation resumed.

To stop the services without deleting data:

```sh
docker compose down
```

To start them again:

```sh
docker compose up -d
```

## Public HTTPS deployment

For an always-on Linux server or VPS, use the optional Caddy profile in the same Compose stack. Set `API_DOMAIN` in `backend/local/.env` to the server's static public IPv4 address (no domain or DNS setup is required), allow inbound TCP 80 and 443, then run:

```sh
docker compose --profile public up -d --build
docker compose exec -T ollama ollama pull qwen3:4b
```

Caddy 2.11.8 obtains and automatically renews short-lived, publicly trusted Let's Encrypt IP certificates. The API itself remains bound to server loopback port 8787 and is reached publicly only through Caddy. Connect the PWA and Android app to `https://YOUR_SERVER_IP`, not localhost. The certificates last 160 hours and renew automatically while Caddy remains online. For automated deployment from GitHub Actions, follow [the self-hosted deployment guide](../../docs/SELF-HOSTED-DEPLOYMENT.md).

## Run locally

From the repository root:

```sh
cp backend/local/.env.example backend/local/.env
# Edit backend/local/.env and set unique random values for all three secrets.
node backend/local/server.mjs
```

The bare Node command starts only the API. It does not start Ollama or SearXNG, so AI and research calls will remain unavailable until those services are running. For the complete local installation, use Docker Compose below. The API listens on `http://127.0.0.1:8787` by default and stores data in `./data/marketing-genius.sqlite`. The example `APP_ORIGIN` is pre-set to the hosted Marketing Genius site; change it only when using a different frontend origin. When the hosted site connects to localhost, the browser may ask permission for local-network access.

## Docker Compose

Copy the environment template to the Compose environment file, edit the credentials, then start the service:

```sh
cp backend/local/.env.example backend/local/.env
# Edit backend/local/.env before starting.
docker compose up -d --build
docker compose exec ollama ollama pull qwen3:4b
docker compose ps
docker compose logs -f marketing-genius-api
```

The manual model-pull command above uses the default model. If you changed `LOCAL_AI_MODEL` in `backend/local/.env`, replace `qwen3:4b` with that exact model reference. The guided installer reads the configured value automatically.

Compose binds the API to localhost only and stores the SQLite database and model files in named Docker volumes. The same `backend/local/.env` file is passed directly to both the API and SearXNG containers, including the SearXNG secret. Do not reuse the example placeholder secrets.

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
```

Use a reverse proxy with HTTPS before exposing this service outside the local machine. Do not expose the SQLite database file over the web.

## Connecting the hosted command centre to the local API

The hosted web app can call the local API at `http://localhost:8787` from the same computer. The Android Capacitor app uses the trusted WebView origin `https://localhost`; the local installer allowlists that exact origin for CORS. An Android phone cannot use `http://localhost:8787` to reach a backend running on a separate PC: on the phone, `localhost` means the phone itself. The default local API is deliberately bound to loopback and is not exposed over the LAN. Use the Android app with an HTTPS-hosted API endpoint, or use the hosted web app on the same computer as the local Docker backend. The local installer configures the exact GitHub Pages origin and the exact Android WebView origin (`https://localhost`) as permitted app origins. Other origins remain rejected. The API handles the browser's cross-origin preflight, including the Private Network Access permission header where the browser requests it; requests from other origins are rejected.

When connecting for the first time, the browser may display a local-network access permission prompt. Allow access for the Marketing Genius site, then use **Test connection** in Settings. Browser support and permission wording vary, so the local API connection must be tested in the browser and profile where the command centre is used. The API remains bound to loopback and is not exposed to other devices by the default Compose port mapping. For a self-hosted connection, **Test connection** also reports whether daily research monitoring is enabled, the configured UTC scan time, and today's scan state. This status does not expose the business profile.

## What is preserved

The local service invokes the same `backend/worker.js` handler used by the Cloudflare deployment. It therefore retains the existing API contract for health, owner login/session, profile, campaigns, operations, research, chat, channel strategy, campaign generation, publishing and analytics. SQLite implements the small KV interface those handlers require, including JSON reads, expiry and paginated prefix listing.

The self-hosted research trigger opens a new window every four hours, aligned to 00:00, 04:00, 08:00, 12:00, 16:00 and 20:00 UTC. The local process checks every 15 seconds and runs at most once per window, catching up if the service starts partway through a window. Each window has its own persistent marker, so a completed scan does not block the next window. The machine and API process must remain online for continuous monitoring. The cadence is configurable with `RESEARCH_INTERVAL_HOURS` using a whole-number divisor of 24; the default is 4.

## Important current limitations

- This removes Cloudflare Workers and KV from the local runtime. Kira chat, channel strategy and campaign generation can use the local Ollama model without an OpenAI key. Local research now uses SearXNG to gather public search snippets and the local Ollama model to analyse them. Search quality and freshness depend on the external search engines SearXNG can reach; snippets are not equivalent to full-page verification. Leave `OPENAI_API_KEY` blank to avoid hosted AI calls.
- The local runtime can use optional Meta credentials for publishing and Facebook analytics. Those platform integrations remain third-party services and are never open source. The default Ollama runtime is MIT-licensed, and the Qwen3-4B model is Apache-2.0 licensed. Check each model's own licence before switching models.
- Automated restore drills and a production-hardening review are still future work. A real Docker/model runtime and campaign-quality evaluation on the target machine have not yet been completed.
- The local scheduler records a persistent trigger state for each research window. Transient failures are retried after a two-hour backoff, up to three attempts per window; an interrupted run can be recovered after a 30-minute stale-running window. Completed and intentionally skipped windows are not repeated. Campaign performance learning remains limited to once per UTC day. A blocked research operation remains visible for owner review and can use the existing manual retry action. This is daily scheduled work, not minute-by-minute monitoring.
- Node's built-in SQLite is used to avoid a native npm dependency. Use a current supported Node 24+ release.

## Test

```sh
node --test backend/worker.test.mjs backend/local/server.test.mjs backend/local/install.test.mjs
```

The Cloudflare Worker tests remain the business-rule regression suite. Local tests verify SQLite KV compatibility, owner login, hosted-origin CORS and Private Network Access preflight through the HTTP adapter, and installer configuration handling.


## AI licence notes

- [Ollama](https://github.com/ollama/ollama) is MIT licensed.
- The default [Qwen3-4B](https://huggingface.co/Qwen/Qwen3-4B) model is published under Apache-2.0.
- You can change `LOCAL_AI_MODEL` in `backend/local/.env`; the installer downloads that exact model. Model licence and runtime licence are separate. Check the exact model card and licence before selecting a different model.


## Local research

The Compose stack includes [SearXNG](https://github.com/searxng/searxng), an AGPL-3.0 metasearch engine. Its private service is not published to the host network. The API requests JSON results from SearXNG and sends bounded titles/snippets/HTTPS URLs to the local Ollama model for analysis. The model is instructed to distinguish snippet evidence from interpretation and cite source IDs.

Search engines queried by SearXNG are external services. They may rate-limit, block automated requests or change their result formats. Kira must report weak or unavailable evidence rather than inventing current trends. The local search adapter does not crawl and verify full article text yet.
