# Supabase backend migration

This migration reuses the existing API implementation in `backend/worker.js` through a Supabase Edge Function adapter. It preserves the current API routes and avoids maintaining two separate copies of the AI/publishing logic.

## 1. Create the storage table

In the Supabase project SQL Editor, run `supabase/migrations/202610160001_mg_kv.sql`.

The table has Row Level Security enabled and intentionally has no browser-facing policies. Only the Edge Function should use the server-side service-role key.

## 2. Deploy the Edge Function

Deploy `supabase/functions/marketing-genius/index.ts` as a Supabase Edge Function named `marketing-genius`.

Set these Edge Function secrets in Supabase:
- `APP_ORIGIN` = `https://lucasmaxxinfo-sketch.github.io`
- `APP_LOGIN_PASSWORD` = a strong owner-only password
- `SESSION_SECRET` = a random secret of at least 32 bytes
- `OPENAI_API_KEY` = your OpenAI API key
- `OPENAI_MODEL` = `gpt-4.1-mini` (optional)
- `META_PAGE_ID`, `META_PAGE_ACCESS_TOKEN`, `META_INSTAGRAM_ACCOUNT_ID` (optional, for Meta features)

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. Never place the service-role key or any server secret in frontend code, GitHub source, or public settings.

## 3. Connect the PWA

In Marketing Genius Settings, set the API URL to the full function URL:

`https://YOUR_PROJECT_REF.supabase.co/functions/v1/marketing-genius`

The existing frontend appends paths such as `/api/auth/login` and `/api/campaigns`; the adapter rewrites these paths before calling the existing API router.

## 4. Verify safely

1. Open `/health` on the function URL and confirm it returns service capabilities.
2. Sign in through the PWA Settings.
3. Create a test draft and verify it appears after refreshing/reopening the workspace.
4. Test AI generation with a non-sensitive brief.
5. Do not test real Meta publishing until credentials, page/account permissions, and an explicitly approved test post are ready.

## Current limitations

- This branch is a migration implementation for review. It does not deploy itself, configure project secrets, or change the live GitHub Pages app.
- The existing API uses a single KV-style store. This migration preserves that contract in a private Postgres table to reduce behavior changes; it does not yet normalize campaigns into relational tables.
- Login throttling reads `CF-Connecting-IP`, then `X-Real-IP`, then the first `X-Forwarded-For` value. Verify that Supabase overwrites or securely supplies the chosen proxy header before production use; do not rely on a client-controlled header for abuse prevention.
- Verify CORS behavior, SQL storage, session expiry, campaign CRUD, AI generation, and publishing safeguards in the actual Supabase project before merging.
- Timed automatic publishing remains disabled in the existing product.
