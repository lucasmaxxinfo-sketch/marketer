# Marketing Genius backend setup

The static PWA is hosted separately from this API. This Worker provides server-side AI generation, campaign persistence endpoints, and guarded Meta publishing endpoints. It is not live until deployed and connected to the app.

## Deploy the API

1. Install Node.js and Wrangler (`npm install -g wrangler`) and sign in (`wrangler login`).
2. Create a KV namespace: `wrangler kv namespace create MG_DATA`.
3. Put the returned namespace ID in `wrangler.toml`.
4. From the `backend` directory, set secrets:
   - `wrangler secret put APP_ACCESS_TOKEN` (long random value)
   - `wrangler secret put OPENAI_API_KEY`
   - For Facebook publishing: `wrangler secret put META_PAGE_ID` and `wrangler secret put META_PAGE_ACCESS_TOKEN`
   - For Instagram publishing: `wrangler secret put META_INSTAGRAM_ACCOUNT_ID`
5. Deploy with `wrangler deploy`.
6. Protect the API with an authenticated gateway/identity layer before using it from a public browser app. Never embed server secrets in `app.js` or other static files.

## API endpoints

- `GET /health`: health check.
- `GET /api/campaigns`: list saved campaigns.
- `POST /api/campaigns`: create/save a campaign.
- `GET /api/campaigns/:id`, `PATCH /api/campaigns/:id`, `DELETE /api/campaigns/:id`: campaign storage.
- `POST /api/generate`: request AI-generated campaign strategy and three posts.
- `POST /api/publish`: publish an explicitly approved Facebook or Instagram post when the appropriate Meta credentials are configured.
- `POST /api/analytics`: retrieve supported Facebook post insights when configured.

All API endpoints except `/health` require `Authorization: Bearer <APP_ACCESS_TOKEN>`. This is server-to-server authentication, not a complete end-user login system. Do not expose the token in the PWA. Before public client integration, replace this gate with per-user authentication and authorization, request limits, and audit logging.

## Important integration limits

- Facebook/Instagram publishing requires an eligible Meta app, correct permissions, a Page/Instagram professional account, and valid tokens. Meta may require app review and business verification.
- Instagram feed publishing requires a public HTTPS image URL.
- Analytics availability depends on platform permissions, post type, API access and retention windows.
- TikTok, LinkedIn, YouTube and other platforms need their own approved integrations.
- A scheduler needs a durable queue/cron job and per-user timezone settings before it can publish automatically. Never schedule or publish content without an owner approval record.
- The existing GitHub Pages app is still local-first. The backend endpoints are not yet wired into its UI, and deploying this Worker alone does not complete the product.
