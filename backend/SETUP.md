# Marketing Genius backend

Owner-only server API. Never commit credentials or put server secrets in browser code.

## Deployment checklist
1. Create a Cloudflare account and connect the marketer repository to Workers, or deploy the backend directory with Wrangler.
2. Create the MG_DATA KV namespace and replace the placeholder ID in wrangler.toml.
3. Add Worker secrets: APP_LOGIN_PASSWORD (strong owner sign-in password), SESSION_SECRET (random secret of 32+ bytes), OPENAI_API_KEY. Optional Meta publishing secrets: META_PAGE_ID, META_PAGE_ACCESS_TOKEN, META_INSTAGRAM_ACCOUNT_ID.
4. Set APP_ORIGIN to https://lucasmaxxinfo-sketch.github.io (origin only, no /marketer path).
5. Deploy the Worker and check /health. A healthy API does not mean AI or social publishing is connected.
6. Connect the PWA to the deployed API URL. Never put server secrets in frontend files.

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
GET /health; POST /api/auth/login; GET /api/auth/session; GET/POST /api/campaigns; GET/PATCH/DELETE /api/campaigns/:id; POST /api/generate; POST /api/publish; POST /api/analytics.

The PWA is hosted at GitHub Pages and the Worker is deployed separately. OpenAI and Meta accounts are required for live services; Meta may require app review and business verification.
