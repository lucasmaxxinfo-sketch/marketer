# Kira Marketing Genius

An installable, mobile-friendly marketing workspace for planning, reviewing, and learning from campaigns.

## In the app

- Campaign drafts, owner review, and an approval queue
- Editable post copy and campaign planning
- Campaign wrap-up, expected-versus-actual notes, and archived reports
- Local-device storage and JSON backup
- Supabase-backed owner workspace under active integration work
- Deterministic rules-based campaign drafting that does not require a paid AI API

## Public app

https://lucasmaxxinfo-sketch.github.io/marketer/

The GitHub Pages frontend is deployed. Its local campaign workflow remains available without a connected backend. The connected Supabase workflow is not yet release-verified, and the live frontend has not been switched as part of the current draft pull requests.

## Campaign generation

The current backend branch uses `rules-based-free-v1`. It produces a three-post draft sequence with different objectives, platform assignments selected from the supplied brief, visual guidance, and calls to action.

This is deterministic template/rules output, not a language model. Review every draft for brand fit, spelling, factual accuracy, product/offer details, and platform suitability before publication. It must not invent prices, dates, availability, or business information.

## Backend and current deployment status

The current backend work is in Supabase project `uodjgguffxapxbcvzkpu` in the Sydney region (`ap-southeast-2`), on the Free plan.

- Edge Function: `marketing-genius`, currently deployed and reported active at version 3.
- Data migration: `supabase/migrations/202610160001_mg_kv.sql`.
- Campaign data is intended to be accessed through the server-side function using the service role, not through public table policies.
- Owner sessions are signed server-side and are intended to expire after 12 hours.
- The latest recorded backend CI run passed the function type-check, API contract smoke tests, and migration/setup checks.

**The connected product is not yet complete or end-to-end verified.** The owner must configure the function secrets, then login, storage round-trip, CORS, and frontend integration must be tested before release. The frontend has not been switched to the new backend and the relevant pull requests remain open and unmerged.

## Configure Supabase secrets

Dashboard: https://supabase.com/dashboard/project/uodjgguffxapxbcvzkpu/functions/secrets

Set these values in the dashboard, not in source code or chat:

- `APP_ORIGIN`: `https://lucasmaxxinfo-sketch.github.io`
- `APP_LOGIN_PASSWORD`: a strong, unique owner password
- `SESSION_SECRET`: a randomly generated secret of at least 32 bytes

Do not configure `OPENAI_API_KEY` or `OPENAI_MODEL` for this rules-based campaign engine. The current worker path does not call a paid AI provider. Supabase provides the server-side project URL and service-role environment variable to the deployed function.

## Publishing integrations

Facebook and Instagram publishing are not configured or verified. The backend contains platform-specific code paths that require Meta credentials, permissions, and separate owner authorization before they can be used. Do not claim a post is published unless the platform confirms it. Timed/automatic publishing is not considered ready for release.

## Android app

The repository contains an Android build workflow and Capacitor configuration. Treat generated APKs as debug/test builds unless a release has been explicitly signed and verified for distribution. Check the latest workflow and release artifacts before installing.

## Developer and release notes

- Repository: https://github.com/lucasmaxxinfo-sketch/marketer
- Backend setup: [supabase/SETUP.md](supabase/SETUP.md)
- Backend API: [supabase/functions/marketing-genius/index.ts](supabase/functions/marketing-genius/index.ts)
- Worker logic: [backend/worker.js](backend/worker.js)
- Living build diary and release evidence checklist: [docs/KIRA_BUILD_DIARY.md](docs/KIRA_BUILD_DIARY.md)
- Backend migration checks: [GitHub Actions workflow](.github/workflows/supabase-backend-check.yml)
- Draft PR #6: https://github.com/lucasmaxxinfo-sketch/marketer/pull/6
- Draft PR #7: https://github.com/lucasmaxxinfo-sketch/marketer/pull/7

The final build is not considered complete until owner login, campaign create/read/update/delete, campaign generation, mobile and desktop browser behavior, and the live frontend/backend integration have been tested and the outcomes recorded in the build diary. Do not merge the draft pull requests or change the live frontend without owner authorization.
