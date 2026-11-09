# Zero-cost self-hosted Marketing Genius

Run Kira on a computer you already own. This is the only recommended backend path for this project: no VPS, paid hosting, paid AI API, domain purchase, cloud account or subscription.

## Open-source stack

- Node.js 24: API runtime.
- SQLite: persistent business, campaign and operation data.
- Ollama: local AI inference.
- Qwen3 4B: default local model, Apache-2.0 licensed.
- SearXNG: self-hosted public-web metasearch.
- Docker Compose: runs the services together.
- Caddy: optional HTTPS reverse proxy for remote access.

The stack reuses the existing API handlers. Cloudflare Workers and KV are not required. AI generation and research use local services, so no OpenAI key is needed. Social publishing is separate and requires third-party Meta credentials. Do not add paid integrations.

## Hardware

Use an existing Windows PC, Linux desktop, spare PC, mini PC or home server. For Windows installation and Android phone access over home Wi-Fi, follow [Windows + Android LAN setup](WINDOWS-ANDROID-LAN-SETUP.md). Keep it powered on and connected to the internet for Kira's four-hour research schedule.

Recommended starting point:
- 8 GB RAM.
- 2 CPU cores or better.
- 25 GB free disk space.
- Docker Engine and Docker Compose plugin.

These are recommendations, not a requirement to purchase hardware. Start with what is already available. Model responses may be slower on older CPUs.

## Install

1. Install Docker Engine and the Docker Compose plugin on the existing computer. On Windows, Docker Desktop with the WSL 2 backend is the simplest route.
2. Clone or update this repository.
3. Run the guided installer from the repository root:

```sh
node backend/local/install.mjs
```

The installer creates private secrets, starts the API, Ollama and SearXNG, downloads the configured local model, and verifies owner login plus a real Kira response.

4. Open the Marketing Genius web app on the same computer.
5. In Settings, set the API address to:

```
http://localhost:8787
```

6. Sign in using the owner password printed by the installer. Save it securely.

No GitHub deployment secrets, SSH deployment keys, public server, domain or cloud account are needed.

## Remote access

The simplest zero-cost setup is same-computer use. The hosted static frontend can be opened on that computer and connect to its local API.

For access from an Android phone on the same home Wi-Fi, use the dedicated [Windows + Android LAN setup](WINDOWS-ANDROID-LAN-SETUP.md). It adds a separate Caddy profile using a private local certificate authority. The API remains loopback-bound on host port 8787; do not expose that port directly. No router port forwarding is required for LAN access.

For remote access over mobile data, the optional Caddy profile can provide HTTPS directly from your home computer, but only if:
- Your ISP provides a reachable public IP address.
- Your router allows TCP ports 80 and 443 to be forwarded to the computer.
- Your firewall allows those ports.

Set `API_DOMAIN` in `backend/local/.env` to the reachable public IP, then run:

```sh
docker compose --profile public up -d --build
docker compose exec -T ollama ollama pull qwen3:4b-instruct
docker compose ps
```

Caddy obtains and renews a short-lived Let's Encrypt IP certificate. No domain purchase or DNS provider is required.

**CGNAT warning:** if your ISP uses carrier-grade NAT or blocks inbound ports, direct home HTTPS will not work. Do not buy a tunnel or VPS to work around it. Keep using Kira on the same computer until a genuinely free, open-source remote-access route is confirmed.

## Keep Kira running

The computer and Docker services must remain on for scheduled research. Kira opens a research window every four hours (UTC). If the computer is off, scans cannot run during that time.

Useful commands:

```sh
docker compose ps
docker compose logs -f marketing-genius-api
docker compose logs -f ollama
docker compose down
```

Use `docker compose down` to stop services without deleting persistent volumes. Do not use `docker compose down -v` unless you intentionally want to delete stored data and downloaded models.

## What remains external

- Search engines queried by SearXNG are public third-party websites. They may rate-limit or block automated requests.
- Facebook and Instagram publishing require Meta credentials and platform permissions. These are optional and not part of the free open-source core.
- No AI or research API key is required for local Ollama and SearXNG operation.

## Troubleshooting

- API not ready: `docker compose logs --tail=150 marketing-genius-api`.
- Local model unavailable: `docker compose exec ollama ollama list`.
- Research has no sources: inspect SearXNG logs; upstream search engines may rate-limit requests.
- Keep backups of the SQLite data volume. Never delete Docker volumes during routine updates.
