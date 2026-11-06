# Marketing Genius backend

Owner-only server API. Never commit credentials or put server secrets in browser code.

## Deployment checklist

The repository includes a manual GitHub Actions workflow named **Deploy Marketing Genius API**. Open the repository's Actions tab and choose that workflow after its required repository secrets have been configured. The workflow validates and deploys the Worker, including the three required server secrets. If optional Meta secrets are present in the repository settings, it also installs each supplied Meta secret without exposing it to the browser.

Required repository secrets: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, MG_DATA_KV_ID, APP_LOGIN_PASSWORD, SESSION_SECRET, and OPENAI_API_KEY. Keep all values private. The Cloudflare API token needs permission to deploy Workers and manage the required KV namespace.
1. Create a Cloudflare account and connect the marketer repository to Workers, or deploy the backend directory with Wrangler.
2. Create the `MG_DATA` KV namespace in Cloudflare. Copy its namespace ID into the GitHub Actions secret `MG_DATA_KV_ID`. The deploy workflow injects that ID at build time; keep the tracked placeholder in `wrangler.toml` and never commit a real namespace ID.
3. Add Worker secrets: APP_LOGIN_PASSWORD (strong owner sign-in password), SESSION_SECRET (random secret of 32+ bytes), OPENAI_API_KEY. Optional repository secrets for publishing: META_PAGE_ID, META_PAGE_ACCESS_TOKEN, META_INSTAGRAM_ACCOUNT_ID. The deploy workflow installs each one when supplied. Facebook publishing needs the Page ID and Page access token; Instagram publishing also needs the Instagram professional account ID and a public HTTPS image URL for each image post.
4. Live opportunity research uses the OpenAI Responses API and hosted `web_search` tool. It requires `OPENAI_API_KEY`; the optional `OPENAI_RESEARCH_MODEL` Worker variable can override the default `gpt-6-astra` model. Research requests are owner-authenticated, include bounded business/audience/location/inventory context, and return source URLs that Kira stores on the operation record. Search usage is a metered provider action; the owner explicitly starts each research run.

The Worker defaults `APP_ORIGIN` to `https://lucasmaxxinfo-sketch.github.io`. If the Pages origin changes, update the Worker configuration to the exact origin only, with no `/marketer` path.
5. Deploy the Worker and check /health. A healthy API does not mean AI or social publishing is connected.
6. Open Settings in the deployed PWA, enter the deployed Worker URL and owner sign-in password, and save. The password is not stored in browser settings. Never put server secrets in frontend files.

## Security and behavior
- Owner sign-in uses a server-validated password and HMAC-signed bearer tokens that expire after 12 hours.
- Login attempts are throttled by client IP using KV. This is best-effort because KV is eventually consistent.
- Browser requests are restricted to the configured frontend origin.
- Publishing verifies the saved campaign and post approval state. It does not trust an approval flag sent by the browser.
- AI generation runs server-side and validates that the provider returns exactly three usable posts.
- Publishing is only reported as successful when Meta returns a post ID. Direct publishing supports Facebook Page feed posts and Instagram feed posts with a public HTTPS image URL.
- Automatic timed publishing is not enabled yet. The existing date-only schedule has no safe posting time, so the system must not guess.
- Live metrics depend on platform permissions and post type. Estimated numbers are never presented as actual results.

## Endpoints
GET /health; POST /api/auth/login; GET /api/auth/session; GET/POST/DELETE /api/campaigns; GET/PATCH/DELETE /api/campaigns/:id; POST /api/strategy (personalised channel assessment); POST /api/chat (owner-authenticated Kira conversation); POST /api/generate; POST /api/publish; POST /api/analytics.

The PWA is hosted at GitHub Pages and the Worker is deployed separately. OpenAI and Meta accounts are required for live services; Meta may require app review and business verification.


## Owner data controls

- Settings explains the browser-local workspace and the business/inventory/conversation context sent to the configured Worker and OpenAI for AI requests.
- **Export my data** exports the local workspace and, when signed in, all cloud campaign records.
- **Clear device data** clears the current browser's saved workspace and session token. It does not delete cloud campaigns.
- **Delete cloud campaigns** requires an active owner session and deletes all campaign records from the Worker KV namespace plus local campaign copies. It does not delete third-party Meta data or provider-side request records.
- **Sign out on this device** removes the bearer token from the current tab. Its signed token expires server-side after 12 hours.
- The Worker limits AI inventory context to 30 product rows and bounds field lengths. Do not upload customer lists or sensitive personal information.

These are application controls, not a complete legal retention policy or compliance certification. Confirm provider retention terms, the responsible legal entity, applicable jurisdictions and required notices before public release.
