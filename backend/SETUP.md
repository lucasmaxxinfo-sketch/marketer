# Marketing Genius backend

Marketing Genius has a provider-neutral backend runtime. The recommended deployment is the repository's open-source Docker stack. Cloudflare Workers are optional and are no longer required to run the hosted API.

## Recommended: self-hosted Docker API

Follow [Self-hosted Docker API deployment](../docs/SELF-HOSTED-DEPLOYMENT.md).

The Docker stack runs:
- The existing API request handlers from `backend/worker.js`, hosted by the Node 24 local adapter.
- SQLite for persistent owner, business, campaign and operation data.
- Ollama for local AI inference.
- SearXNG for public web research.
- Caddy for automatic HTTPS and reverse proxy.

The local runtime reuses the existing API handlers and routes. It does not fork the business rules or require Cloudflare Workers, KV, Wrangler, a Cloudflare account, or a Cloudflare API token.

For a same-computer installation, run `node backend/local/install.mjs`. The guided installer creates private secrets, starts Docker Compose, downloads the selected Ollama model, and verifies owner login plus an actual Kira response. See [the local backend guide](local/README.md).

## Optional legacy Cloudflare deployment

The Cloudflare Worker deployment remains available only as an optional compatibility path. It is not required for the Docker deployment.

To use it, manually enable the repository variable `CLOUDFLARE_DEPLOY_ENABLED=true` and configure the legacy workflow's Cloudflare token, account ID, KV namespace ID, owner password and session secret. The tracked KV ID is intentionally a placeholder. Do not commit a real namespace ID or any credentials.

The workflow does not attempt a Cloudflare deployment on ordinary pushes. Backend validation still runs independently. The self-hosted Docker workflow is the default provider-neutral deployment route.

## API behavior and security

Owner-only server API. Never commit credentials or put server secrets in browser code.

- Owner sign-in uses a server-validated password and HMAC-signed bearer tokens that expire after 12 hours.
- Login attempts are throttled by client IP using the configured storage adapter.
- Browser requests are restricted to explicitly configured frontend origins.
- Publishing verifies the saved campaign and post approval state. It does not trust an approval flag sent by the browser.
- AI generation runs server-side and validates that the provider returns exactly three usable posts.
- Publishing is only reported as successful when Meta returns a post ID.
- Direct publishing supports Facebook Page feed posts and Instagram feed posts with a public HTTPS image URL.
- Automatic timed publishing is not enabled. The existing date-only schedule has no safe posting time, so the system must not guess.
- Live metrics depend on platform permissions and post type. Estimated numbers are never presented as actual results.

## API endpoints

- `GET /health`
- `POST /api/auth/login`, `GET /api/auth/session`
- `GET/POST/DELETE /api/campaigns`, `GET/PATCH/DELETE /api/campaigns/:id`
- `GET/POST/DELETE /api/operations`, `PATCH /api/operations/:id`
- `GET/PUT /api/profile`
- Business workspace and inventory endpoints under `/api/businesses`
- `GET /api/learning` for the active business's verified campaign lessons
- `POST /api/research`, `POST /api/strategy`, `POST /api/chat`
- `POST /api/generate`, `POST /api/publish`, `POST /api/analytics`

The PWA remains hosted on GitHub Pages. Enter the deployed self-hosted API's HTTPS address in Settings and sign in with the owner password. The local-only address `http://localhost:8787` works only from the same computer running Docker. An Android phone cannot use a PC's localhost address.

## Provider requirements

- Local AI and research use Ollama and SearXNG and do not require an OpenAI API key.
- Facebook and Instagram publishing and analytics still require Meta credentials, account permissions and any required Meta app review.
- The server must remain online for Kira's scheduled research, which runs every four hours by default.
- Keep Docker volumes and SQLite backups safe. Do not remove volumes during upgrades.

## Owner data controls

- Settings explains browser-local workspace data and the business/inventory/conversation context sent to the configured API and AI provider for requests.
- **Export my data** exports the local workspace and, when signed in, cloud campaign records.
- **Clear device data** clears the current browser's saved workspace and session token. It does not delete server data.
- **Delete cloud campaigns** requires an active owner session and deletes campaign records from the configured backend plus local campaign copies. It does not delete third-party Meta data or provider-side request records.
- **Sign out on this device** removes the bearer token from the current tab. Its signed token expires server-side after 12 hours.

These are application controls, not a complete legal retention policy or compliance certification. Confirm provider retention terms, the responsible legal entity, applicable jurisdictions and required notices before public release.
