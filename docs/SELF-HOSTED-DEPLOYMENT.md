# Self-hosted Marketing Genius API

This is the recommended deployment path when Cloudflare credentials or Cloudflare Workers are not available. It uses the repository's open-source Docker stack and can run on any Linux server with Docker Engine and the Compose plugin.

## What runs

- Marketing Genius API: the existing `backend/worker.js` handlers, hosted by the Node 24 adapter in `backend/local/server.mjs`.
- SQLite: persistent campaign, business and operation data in a Docker volume.
- Ollama: local AI inference using the configured `qwen3:4b` model by default.
- SearXNG: self-hosted metasearch for Kira's public web research.
- Caddy: automatic HTTPS certificates and reverse proxy for the public API hostname.

The local adapter reuses the same tested request handlers and API routes as the Worker. This is a runtime replacement, not a second application or a reduced mock API. Cloudflare Workers, KV, Wrangler, an API token and a KV namespace are not required.

The GitHub Pages frontend remains where it is. It connects to the HTTPS API hostname configured below. Owner login, business isolation, campaign approval, research, learning memory, and the existing API contract remain in the shared Worker handlers.

## Server requirements

Use an always-on Linux VPS or server that you control.

- 2 or more CPU cores.
- 8 GB RAM recommended for the local Qwen model; more RAM improves responsiveness.
- At least 25 GB free disk space for containers, the AI model and persistent data.
- Docker Engine and Docker Compose plugin.
- A domain or subdomain dedicated to the API, for example `api.yourdomain.example`.
- DNS A record pointing that hostname to the server's public IPv4 address. Add an AAAA record only if IPv6 is correctly configured.
- Firewall allows inbound TCP 80 and 443. Keep SSH restricted to trusted addresses where possible.

The server must remain online for scheduled daily research. The local AI model is downloaded on first deployment and can take several minutes.

## One-time server preparation

1. Provision the Linux server and install Docker Engine plus the Docker Compose plugin using the official Docker instructions for that distribution.
2. Create a DNS A record for the API hostname pointing to the server's public IPv4 address.
3. Allow inbound TCP ports 80 and 443 in the server firewall and provider firewall. Keep port 8787 private; Compose binds it to loopback.
4. Create a dedicated deployment user with permission to run Docker and Git. Use SSH keys, not password login, for deployment.
5. Confirm the server can clone the public repository over HTTPS.

Caddy obtains and renews the HTTPS certificate automatically after DNS resolves and ports 80/443 are reachable.

## GitHub Actions configuration

In repository Settings → Secrets and variables → Actions, add these **repository secrets**:

- `DEPLOY_HOST`: server IP address or SSH hostname.
- `DEPLOY_USER`: deployment user.
- `DEPLOY_SSH_PRIVATE_KEY`: private SSH key for that user.
- `DEPLOY_SSH_KNOWN_HOSTS`: the server's verified SSH host-key line. Obtain it from a trusted source and verify its fingerprint before saving it. Do not generate trust dynamically inside the deployment workflow.
- `APP_LOGIN_PASSWORD`: strong owner sign-in password.
- `SESSION_SECRET`: independent random secret of at least 32 bytes.
- `SEARXNG_SECRET`: independent random SearXNG secret.

Add these **repository variables**:

- `SELF_HOSTED_DEPLOY_ENABLED` = `true`
- `API_DOMAIN` = the exact public API hostname, without `https://`.

Do not put secret values in source files or commit them. The workflow creates a private temporary environment file, transfers it over SSH, and removes its runner copy after deployment. The server's environment file is stored at `~/marketing-genius/backend/local/.env` with private file permissions.

## Deploy

After the server, DNS and GitHub settings are ready, run **Actions → Self-hosted Docker API deployment → Run workflow**. Later pushes to the relevant backend and Docker files on `main` deploy automatically while `SELF_HOSTED_DEPLOY_ENABLED` remains `true`.

The workflow:
1. Runs backend, SQLite adapter and installer tests.
2. Validates the complete Docker Compose configuration.
3. Connects to the server using the pinned SSH host key.
4. Updates the checked-out repository.
5. Writes the private server configuration.
6. Builds and starts the API, Ollama, SearXNG and Caddy.
7. Pulls the configured local AI model.
8. Verifies `https://API_DOMAIN/health` and checks that the runtime identifies itself as `self-hosted`.

The public API address to enter in Marketing Genius Settings is `https://API_DOMAIN`. Sign in using the owner password saved in GitHub Actions secrets.

## Manual deployment

You can also run the same stack without GitHub Actions:

```sh
cp backend/local/.env.example backend/local/.env
```

Set unique values for `APP_LOGIN_PASSWORD`, `SESSION_SECRET`, `SEARXNG_SECRET`, and set `API_DOMAIN` to the DNS hostname. Then run:

```sh
docker compose --profile public up -d --build
docker compose exec -T ollama ollama pull qwen3:4b
docker compose ps
docker compose logs -f marketing-genius-api caddy
```

Check `https://API_DOMAIN/health` before connecting the frontend.

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
- The scheduled research process runs inside the API service. Keep the service running at the configured UTC time.
- Local AI and SearXNG remove the OpenAI API key requirement for AI generation and public web research. Meta publishing and analytics still require valid Meta credentials and permissions; those are external platform integrations, not open-source services.

## Troubleshooting

- HTTPS certificate not issued: verify DNS points to the server and inbound TCP 80/443 are reachable.
- API unavailable: inspect `docker compose logs --tail=150 marketing-genius-api caddy`.
- Local AI unavailable: inspect `docker compose logs --tail=150 ollama` and confirm the model exists with `docker compose exec ollama ollama list`.
- Research returns no usable sources: inspect SearXNG logs and remember that upstream public search engines can rate-limit or block metasearch traffic.
- The workflow does not deploy: confirm `SELF_HOSTED_DEPLOY_ENABLED=true` and all listed secrets and variables are configured.
- The API health check does not pass: do not connect the frontend or claim the backend is live until the HTTPS health endpoint returns a healthy self-hosted runtime.
