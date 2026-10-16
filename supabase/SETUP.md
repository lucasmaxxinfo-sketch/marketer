# Supabase backend migration

This migration reuses the existing API implementation in `backend/worker.js` through a Supabase Edge Function adapter. It preserves the current API routes and avoids maintaining two separate copies of the AI/publishing logic.

## 1. Create the private storage table

In the Supabase project SQL Editor, apply `supabase/migrations/202610160001_mg_kv.sql` to create the private key-value storage table. The atomic login-rate-limit migration is no longer required for authentication because sign-in throttling is delegated to Supabase Auth.

The table has Row Level Security enabled and intentionally has no browser-facing policies. Only the Edge Function should use the server-side service-role key.

## 2. Deploy the Edge Function

Deploy `supabase/functions/marketing-genius/index.ts` as a Supabase Edge Function named `marketing-genius`.

The function folder contains its own `worker.js` alongside `index.ts` and `storage.ts`. The entry point imports this local copy so the deployment bundle does not depend on files outside the function directory. When `backend/worker.js` changes, keep `supabase/functions/marketing-genius/worker.js` synchronized and verify the copies match before deployment.

**Important gateway setting:** `supabase/config.toml` sets `verify_jwt = false` for this function because the handler calls Supabase Auth to validate the bearer token and checks the authenticated email against `OWNER_EMAIL`. Keep the handler authentication and CORS checks enabled.

Install the Supabase CLI, authenticate, link the intended project, then deploy from the repository root:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy marketing-genius
```

Confirm the linked project reference before running database or deployment commands. Do not paste service-role keys into the shell command or commit them to the repository.

Set these Edge Function secrets in Supabase:
- `APP_ORIGIN` = `https://lucasmaxxinfo-sketch.github.io`
- `OWNER_EMAIL` = the exact email address of the single owner account allowed to use the workspace
- `SUPABASE_ANON_KEY` = the project anon/publishable key used by the server to call Supabase Auth. The adapter also accepts `SUPABASE_PUBLISHABLE_KEY` as its source name.
- `OPENAI_API_KEY` = your OpenAI API key
- `OPENAI_MODEL` = `gpt-4.1-mini` (optional)
- `META_PAGE_ID`, `META_PAGE_ACCESS_TOKEN`, `META_INSTAGRAM_ACCOUNT_ID` (optional, for Meta features)

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Create or invite the owner account in Supabase Authentication, enable email/password sign-in, and confirm the account email before testing. `OWNER_EMAIL` must match that account. Never place the service-role key or server secrets in frontend code, GitHub source, or public settings.

## 3. Connect the PWA

In Marketing Genius Settings, set the API URL to the full function URL:

`https://YOUR_PROJECT_REF.supabase.co/functions/v1/marketing-genius`

The existing frontend appends paths such as `/api/auth/login` and `/api/campaigns`; the adapter rewrites these paths before calling the existing API router.

## 4. Verify safely

1. Open `/health` on the function URL and confirm it returns service capabilities.
2. Sign in through the PWA Settings with the owner email and its Supabase Auth password.
3. Confirm the session refresh route renews an expired access token and that a non-owner account is denied.
3. Create a test draft and verify it appears after refreshing/reopening the workspace.
4. Test AI generation with a non-sensitive brief.
5. Do not test real Meta publishing until credentials, page/account permissions, and an explicitly approved test post are ready.

## Current limitations

- This branch is a migration implementation for review. It does not deploy itself, configure project secrets, or change the live GitHub Pages app.
- Owner sign-in uses Supabase Auth email/password. The Edge Function validates every bearer access token through the Auth user endpoint and then checks the returned email against the server-side OWNER_EMAIL allowlist.
- Sign-in throttling is delegated to Supabase Auth rather than a custom rate limiter based on CF-Connecting-IP, X-Forwarded-For, or X-Real-IP. The app does not rely on unverified client IP headers.
- The adapter must have SUPABASE_URL, SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY), and OWNER_EMAIL configured. Configuration values must be verified by checking names/status only, never by exposing secret values.
- Verify CORS behavior, real Supabase Auth login and throttling, refresh-token rotation, SQL storage, campaign CRUD, AI generation, rules fallback, and approval checks in the dedicated staging project before merging.
- Do not publish to Facebook or Instagram without explicit approval of a prepared test post.
- Timed automatic publishing remains disabled in the existing product.
