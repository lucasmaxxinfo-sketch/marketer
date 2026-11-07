# Self-hosted Marketing Genius API

This is the recommended deployment path when Cloudflare credentials or Cloudflare Workers are not available. It uses the repository's open-source Docker stack and can run on any Linux server with Docker Engine and the Compose plugin.

## What runs

- Marketing Genius API: the existing `backend/worker.js` handlers, hosted by the Node 24 adapter in `backend/local/server.mjs`.
- SQLite: persistent campaign, business and operation data in a Docker volume.
- Ollama: local AI inference using the configured `qwen3:4b` model by default.
- SearXNG: self-hosted metasearch for Kira's public web research.
- Caddy: automatic HTTPS certificates and reverse proxy, including certificates issued directly for a static public IPv4 address. Caddy overwrites the trusted client-IP header from the actual connection peer so login throttling is per visitor, not one shared unknown-IP bucket.

The local adapter reuses the same tested request handlers and API routes as the Worker. This is a runtime replacement, not a second application or a reduced mock API. Cloudflare Workers, KV, Wrangler, an API token and a KV namespace are not required.

The GitHub Pages frontend remains where it is. It connects to the HTTPS API hostname configured below. Owner login, business isolation, campaign approval, research, learning memory, and the existing API contract remain in the shared Worker handlers.

## Server requirements

Use an always-on Linux VPS or server that you control.

- 2 or more CPU cores.
- 8 GB RAM recommended for the local Qwen model; more RAM improves responsiveness.
- At least 25 GB free disk space for containers, the AI model and persistent data.
- Docker Engine and Docker Compose plugin.
- A reachable public IPv4 address is needed only for direct remote HTTPS access. It is not needed for same-computer use.
- Firewall access to inbound TCP 80 and 443 is needed only for direct remote HTTPS access.

**No custom domain or DNS configuration is required.** Caddy 2.11.8 requests a short-lived Let's Encrypt certificate for the server's public IP and renews it automatically. Let's Encrypt IP certificates are valid for 160 hours, so the reverse proxy must remain running for automatic renewal. See [Let's Encrypt's IP certificate announcement](https://letsencrypt.org/2026/01/15/6day-and-ip-general-availability) and [Caddy's TLS documentation](https://caddyserver.com/docs/caddyfile/directives/tls).

The server must remain online for Kira's scheduled research, which runs every four hours by default. The local AI model is downloaded on first deployment and can take several minutes.

## Zero-cost hardware choice

Use the best computer already available. The complete stack includes the API, SQLite, Ollama local AI, SearXNG research and optional Caddy HTTPS. **8 GB RAM and at least 25 GB free disk space are recommended** for the default Qwen 3 4B model. A more powerful CPU improves response speed. There is no hardware purchase requirement: start with an existing machine and measure performance before considering anything else.

For access from another device outside the home, your internet connection must allow inbound connections. If your ISP uses carrier-grade NAT (CGNAT), direct public HTTPS hosting from home will not work without an additional network path. In that case, use the local web app on the same computer or same home network until a genuinely free, open-source remote-access path is available. Do not sign up for a paid tunnel or hosting service.

## One-time server preparation

1. Provision the Linux server with a static public IPv4 address and install Docker Engine plus the Docker Compose plugin.
2. Allow inbound TCP ports 80 and 443 in the server firewall and provider firewall. Keep port 8787 private; Compose binds it to loopback.
3. Create a dedicated deployment user with permission to run Docker and Git. Use SSH keys, not password login, for deployment.
4. Confirm the server can clone the public repository over HTTPS.

Caddy obtains a trusted IP-address certificate automatically from Let's Encrypt. No domain purchase, DNS record or DNS provider is needed.

## No paid cloud setup required

No VPS, cloud account, GitHub deployment secrets, SSH deployment key, paid API or domain purchase is required for the local installation. The optional GitHub Actions SSH deployment workflow is only for people who already operate a remote Linux server; it is not part of the zero-cost home setup.

## Deploy

After the server and GitHub settings are ready, run **Actions → Self-hosted Docker API deployment → Run workflow**. Later pushes to the relevant backend and Docker files on `main` deploy automatically while `SELF_HOSTED_DEPLOY_ENABLED` remains `true`.

The local installer creates private secrets, starts the Docker services, downloads the selected model, and verifies owner login plus a real Kira response. For a same-computer installation, the API address is `http://localhost:8787`.

## Manual deployment

You can also run the same stack without GitHub Actions:

```sh
cp backend/local/.env.example backend/local/.env
```

The installer creates unique secrets automatically. For same-computer use, leave `API_DOMAIN` unset. Only configure it if you are deliberately enabling direct remote HTTPS from a reachable home public IP. Then run:

```sh
docker compose --profile public up -d --build
docker compose exec -T ollama ollama pull qwen3:4b
docker compose ps
docker compose logs -f marketing-genius-api caddy
```

For local use, check `http://localhost:8787/health` before connecting the frontend. For optional remote HTTPS, check `https://API_DOMAIN/health`.

## Local computer installation

For a private, same-computer installation without a public server, run:

```sh
node backend/local/install.mjs
```

This guided installer generates secrets, starts the API/Ollama/SearXNG stack, downloads the model, and tests owner login and a real Kira response. Connect the hosted command centre to `http://localhost:8787` on that same computer. This local-only option does not provide a public HTTPS endpoint for an Android phone or other remote devices.

## Data and operations

- SQLite data persists in the `marketing-genius-data` Docker volume.
- Ollama models persist in `ollama-models`.
- Caddy certificates persist in `caddy-data` and `caddy-config`.
- Stop containers without deleting data: `docker compose --profile public down`.
- Back up the SQLite volume regularly and store backups away from the server.
- Do not delete Docker volumes during upgrades.
- The scheduled research process runs inside the API service. Keep the service running continuously; Kira opens a new research window every four hours (UTC).
- Local AI and SearXNG remove the OpenAI API key requirement for AI generation and public web research. Meta publishing and analytics still require valid Meta credentials and permissions; those are external platform integrations, not open-source services.

## Troubleshooting

- HTTPS certificate not issued: verify `API_DOMAIN` is the server's static public IPv4 address and inbound TCP 80/443 are reachable. The certificate is short-lived and renews automatically while Caddy is running.
- API unavailable: inspect `docker compose logs --tail=150 marketing-genius-api caddy`.
- Local AI unavailable: inspect `docker compose logs --tail=150 ollama` and confirm the model exists with `docker compose exec ollama ollama list`.
- Research returns no usable sources: inspect SearXNG logs and remember that upstream public search engines can rate-limit or block metasearch traffic.
- The API health check does not pass: do not connect the frontend or claim the backend is live until the HTTPS health endpoint returns a healthy self-hosted runtime.
