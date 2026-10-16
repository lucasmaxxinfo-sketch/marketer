# Kira Backend Migration: Execution Plan

Last updated: 2026-10-16
Status: In progress, pre-deployment
Production changes: Not authorised. Do not merge or deploy without explicit owner approval.

## Definition of done

This task is complete only when all of the following are true:

1. The AI migration and rules-based fallback are integrated without losing either capability.
2. The backend and bundled Supabase worker are identical, and all automated checks pass.
3. Required Supabase configuration is verified by name/status without exposing secret values.
4. The deployed runtime provides a trustworthy client IP for login throttling, or a verified alternative is implemented. Login must not trust client-controlled forwarding headers or place every user in a shared rate-limit bucket.
5. A controlled test environment passes health, login/session, campaign CRUD persistence, AI generation, CORS, and approval-guard tests.
6. Publishing remains disabled unless credentials are configured and an explicitly approved test post is ready.
7. The frontend is pointed at the backend only after the backend tests pass and the owner explicitly approves that change.
8. The live site is smoke-tested after any approved release, and this log records evidence, outcomes, and rollback steps.

## Execution sequence

### Phase 1: Stabilise the proposed code

- [x] Create a rules-fallback follow-up branch and draft PR #8.
- [x] Add no-key fallback health and generation tests.
- [x] Create a secure-login rate-limit follow-up branch and draft PR #9.
- [x] Make login fail closed with HTTP 503 when the trusted `CF-Connecting-IP` header is missing; do not fall back to spoofable `X-Forwarded-For` or `X-Real-IP`.
- [x] Keep `backend/worker.js` and `supabase/functions/marketing-genius/worker.js` identical.
- [x] Add tests for missing trusted IP and spoofed forwarding headers.
- [x] Confirm the workflow runs both `worker_test.ts` and `storage_test.ts`.
- [x] GitHub Actions run #94 passed on PR #9's merge commit: type-check passed, **22 tests passed / 0 failed**, and migration/setup checks passed.
- [ ] Review the combined PR diff for accidental changes and confirm the rules fallback does not silently replace AI generation.

### Phase 2: Verify configuration safely

In Supabase Dashboard > Edge Functions > Secrets, check whether these names exist and are configured. Do not paste or send secret values in chat.

- [ ] `APP_LOGIN_PASSWORD`: configured, strong, and owner-controlled.
- [ ] `SESSION_SECRET`: configured and at least 32 bytes of high-entropy secret material.
- [ ] `OPENAI_API_KEY`: configured if AI generation is expected.
- [ ] `APP_ORIGIN`: exactly `https://lucasmaxxinfo-sketch.github.io`.
- [ ] Confirm the Supabase service-role environment is available to the function without exposing it.
- [ ] Do not configure Meta publishing credentials until a safe, owner-approved test post is ready.

Configuration is currently **unknown**. Never paste secrets into GitHub, the frontend, Notion, or chat.

### Phase 3: Resolve trusted-IP behaviour before enabling login

- [ ] Verify from the actual Supabase Edge Function runtime whether `CF-Connecting-IP` is present and set by a trusted platform layer.
- [ ] Confirm the gateway overwrites or strips client-supplied `CF-Connecting-IP`; header availability or presence in logs alone is not proof of spoof resistance.
- [ ] If present and trusted, test the deployed rate limit with multiple attempts and spoofed `X-Forwarded-For` / `X-Real-IP` headers.
- [ ] If absent or untrusted, do not disable the fail-closed guard. Implement a platform-supported rate limiter or a verified trusted-IP mechanism, then test it.
- [ ] Confirm ordinary users are not all placed in one shared bucket and an attacker cannot bypass throttling by spoofing headers.
- [x] Replace the worker read/write counter with a PostgreSQL atomic-increment RPC in the proposed migration; the function is restricted to the server `service_role`, uses an empty `search_path`, and resets expired counters within the upsert. GitHub Actions run #105 passed type-check, all 26 tests, and migration/setup validation. The concurrency test uses a test double, so a real PostgreSQL concurrency integration test remains required.
- [x] Reject empty, oversized, whitespace-containing, and comma-separated trusted-IP header values in the worker; keep both worker copies identical. This is input validation only and does not prove the platform header is trustworthy.

### Phase 4: Verify the backend in a controlled environment

After configuration is verified and the owner explicitly approves deployment to a test environment:

- [ ] Health endpoint identifies whether AI or rules fallback is active.
- [ ] Owner login succeeds with the correct password; incorrect login is throttled.
- [ ] Signed session works, expires as expected, and rejects invalid/expired tokens.
- [ ] Campaign create, read, update, and delete persist in Supabase storage across requests.
- [ ] AI generation succeeds with an API key; rules fallback succeeds without one.
- [ ] CORS allows the intended app origin and rejects unintended origins.
- [ ] Publishing endpoints reject unapproved campaigns/posts.
- [ ] No real Meta publishing is attempted unless the owner explicitly approves a prepared test post.
- [ ] Capture test outcomes and any remaining limitations in the build log.

### Phase 5: Release decision and frontend connection

- [ ] Review all CI and controlled-environment evidence.
- [ ] Confirm rollback instructions and keep the current local campaign workflow usable.
- [ ] Ask for explicit owner approval before merging or deploying.
- [ ] Only after backend verification and approval, configure the frontend API URL as `https://uodjgguffxapxbcvzkpu.supabase.co/functions/v1/marketing-genius`.
- [ ] Test login, campaign generation, saving, refresh persistence, CORS, and approval safeguards through the actual website.
- [ ] If any check fails, revert the frontend connection and/or redeploy the previous known-good backend; record the incident and fix.

## Clear ending

Mark this task **COMPLETE** only when all definition-of-done items are evidenced, the connected app behaves correctly in a real browser, and the owner has approved the release. Until then, status remains **IN PROGRESS / NOT PRODUCTION-READY**. No merge, deployment, frontend change, or real social post is authorised by this plan alone.


- [ ] Trusted-IP evidence review: official Supabase docs confirm gateway routing and logging of `cf-connecting-ip`, but do not document whether this project's gateway overwrites or strips a caller-supplied value. Treat source trust as unresolved until proven with authoritative documentation or a controlled spoofing test.


- [x] Re-run CI after SQL search-path hardening and setup documentation updates. GitHub Actions run #110 passed type-check, all 26 tests, and migration/setup validation: https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/38879368956.


- [x] Added an isolated PostgreSQL 16 CI integration check. Run #115 passed: it applies both migrations, invokes the atomic RPC concurrently 20 times and verifies the final count is 20, confirms expired counters reset to 1, and verifies `anon`/`authenticated` cannot execute the RPC while `service_role` can. This validates the migration against PostgreSQL in CI, but not against the live Supabase project or gateway IP-header trust.
