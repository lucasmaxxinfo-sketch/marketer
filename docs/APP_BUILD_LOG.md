# Kira App Build Log / Execution Diary

This is the durable running log for the Marketing Genius Command Centre backend migration. Add an entry after every meaningful implementation, test, configuration check, deployment, or release decision. Keep statements evidence-based.

## Current status

- Last updated: 2026-10-16
- Overall: **IN PROGRESS / NOT PRODUCTION-READY**
- Live website: https://lucasmaxxinfo-sketch.github.io/marketer/
- Repository: https://github.com/lucasmaxxinfo-sketch/marketer
- Supabase project: Kira Marketing Genius
- Live Edge Function remains the previously deployed rules-based implementation; do not describe the AI migration as live.
- Production merges/deployments are not authorised without explicit owner approval.
- Configuration status: `APP_LOGIN_PASSWORD`, `SESSION_SECRET`, `OPENAI_API_KEY`, and `APP_ORIGIN` remain **unknown/unverified**. Never record secret values here.

## Entry: 2026-10-16

### Work completed

- Added draft PR #8 to combine OpenAI generation with a rules-based fallback when no OpenAI key is configured.
- Added health reporting for campaign generation availability and active engine.
- Added tests for no-key health reporting and rules-based campaign generation.
- Added draft PR #9 to make owner login fail closed when the trusted `CF-Connecting-IP` header is absent.
- Added tests for missing trusted IP and attempts to spoof `X-Forwarded-For` / `X-Real-IP`.
- Kept `backend/worker.js` and `supabase/functions/marketing-genius/worker.js` identical on the security-fix branch.
- Updated Supabase setup guidance to require verification of the trusted IP source.
- Added and linked the execution plan and this running diary from the README.
- Rechecked the GitHub Actions workflow and confirmed the unit tests are actually executed. The earlier plan entry incorrectly left this unverified.

### Validation evidence

- PR #9 latest recorded head: `bfa9bf0b86cf0401fc5c4c11c345b041730818b4`.
- GitHub Actions run #94 succeeded on the PR merge commit `b7e495a80d77c514c39deabeb11ac6fcd6b10905` on 2026-10-16.
- Run #94 workflow: https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/38872166533
- Workflow file: https://github.com/lucasmaxxinfo-sketch/marketer/blob/fix/secure-login-rate-limit-ip/.github/workflows/supabase-backend-check.yml
- The workflow explicitly runs:
  - `deno check supabase/functions/marketing-genius/index.ts`
  - `deno test supabase/functions/marketing-genius/worker_test.ts supabase/functions/marketing-genius/storage_test.ts`
  - migration/setup/config checks.
- Retrieved run #94 job logs confirm **22 tests passed, 0 failed**: 15 worker tests and 7 storage tests. The checks include the missing trusted-IP fail-closed behaviour, resistance to spoofed forwarding headers, rules-based fallback generation, CORS/origin handling, approval guards, and storage adapter behaviour.
- Run #94's job and all listed steps completed successfully. This is CI evidence for the PR merge commit, not a live deployment or production runtime verification.
- Draft PR #8: https://github.com/lucasmaxxinfo-sketch/marketer/pull/8
- Draft PR #9: https://github.com/lucasmaxxinfo-sketch/marketer/pull/9

### Risks and blockers

- Supabase secret/configuration status is unknown and must be checked in the dashboard without exposing values.
- If Supabase does not securely provide `CF-Connecting-IP`, owner login will return HTTP 503 until a trusted, tested alternative is implemented. Do not switch to client-controlled forwarding headers.
- Campaign storage, owner login/session expiry, AI generation, CORS, and approval checks have not been verified against a deployed test environment.
- Do not publish to Facebook or Instagram without explicit approval of a prepared test post.
- The frontend API URL has not been changed; the live site remains on its existing workflow.
- PR #8 and #9 remain drafts; nothing has been merged or deployed.

### Next actions

1. Review the combined PR #8/#9 diff and verify branch ancestry; CI for the PR #9 merge commit is now confirmed green.
2. Verify required secret names and the non-secret `APP_ORIGIN` value in Supabase Dashboard. Never share secret values.
3. Verify trusted IP header behaviour in the actual Supabase runtime; keep login fail-closed until this is proven.
4. Obtain explicit owner approval before any test deployment.
5. Run controlled end-to-end checks for health, login, session expiry, persistent campaign CRUD, AI/fallback generation, CORS, and approval guards.
6. Only after passing evidence and explicit approval, connect the frontend and smoke-test the live app.
7. Record final evidence, release/rollback outcome, and mark complete only when all acceptance criteria pass.

## Entry template for future updates

### YYYY-MM-DD | Change or test

- **Change:** What changed.
- **Evidence:** Commit, PR, CI run, or test result.
- **Result:** Pass/fail/not yet run.
- **Risks/blockers:** What remains unresolved.
- **Next action:** The exact next executable step.


## Entry: 2026-10-16 | Trusted IP header input validation

- **Change:** Login now rejects empty, oversized, whitespace-containing, and comma-separated `CF-Connecting-IP` values. Added regression tests and synchronized `backend/worker.js` with `supabase/functions/marketing-genius/worker.js`.
- **Evidence:** Branch `fix/trusted-ip-header-validation`; both worker files have matching blob SHA after the change.
- **Result:** Code and test changes committed to the follow-up branch. CI has not yet been run for this follow-up.
- **Risks/blockers:** This validation does not establish that Supabase supplies the header from a trusted proxy or overwrites client-provided values. Keep login fail-closed until runtime trust is verified; do not deploy or connect the frontend.
- **Next action:** Run CI and review the branch diff, then resolve the trusted-IP source design before any controlled deployment.


## Entry: 2026-10-16 | Follow-up CI verified

- **Change:** Updated PR #10 validation notes and recorded passing CI evidence in the execution plan.
- **Evidence:** GitHub Actions run #100 passed: https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/38875257412. Steps passed: Edge Function type-check, API contract smoke tests, and migration/setup validation.
- **Result:** Automated workflow passed on the follow-up branch. This is not live integration testing.
- **Risks/blockers:** Trusted origin of `CF-Connecting-IP` remains unverified in the deployed Supabase runtime; configuration and end-to-end acceptance tests remain outstanding.
- **Next action:** Resolve the trusted client-IP mechanism and verify configuration before proposing any controlled deployment. Keep production changes and frontend connection gated on explicit owner approval.


## Entry: 2026-10-16 | Trusted-IP documentation review

- **Change:** Added a specific verification requirement to distinguish header availability from proof that the gateway overwrites client-supplied values.
- **Evidence:** Supabase documents Edge Functions as running behind an edge gateway and lists `cf-connecting-ip` among headers captured in API logs: https://supabase.com/docs/guides/functions and https://supabase.com/docs/guides/observability/log-field-reference. Cloudflare documents that `CF-Connecting-IP` represents the connecting client IP when traffic passes from Cloudflare edge to an origin: https://developers.cloudflare.com/fundamentals/reference/http-headers/.
- **Result:** Public docs support that the header is used in the gateway ecosystem, but the reviewed pages do not establish that the deployed Supabase route strips or overwrites a client-supplied copy before this function reads it. Runtime trust remains unproven.
- **Risks/blockers:** Do not treat header presence or log capture as spoof-resistance evidence. Keep login fail-closed until this is verified or replace IP-dependent throttling with a trusted mechanism.
- **Next action:** Obtain platform-specific confirmation or implement a rate limiter with a verified trusted identity/source, then test it in a controlled environment.


## Entry: 2026-10-16 | Concurrent login rate-limit review

- **Review:** Inspected the proposed worker's login throttle and its tests on `fix/trusted-ip-header-validation`.
- **Finding:** The login handler reads the current failed-attempt count and then writes the increment as two separate storage operations. The Supabase adapter uses a read followed by an upsert, not an atomic increment. Concurrent failed requests can therefore read the same old count and exceed the nominal eight-attempt threshold.
- **Test gap:** Existing tests cover repeated attempts, missing IP, spoofed forwarding headers, and malformed IP values, but do not exercise simultaneous login failures against shared storage.
- **Action:** Added a release checklist item to test the race and use an atomic or serialized limiter if supported. This is a code-review finding, not a verified live exploit or a live-environment test.
- **Status:** No worker code, live configuration, deployed function, or frontend was changed. Release remains blocked by trusted-IP provenance, rate-limit concurrency, unverified configuration, and outstanding controlled end-to-end tests.


## Entry: 2026-10-16 | Atomic login rate-limit implementation drafted

- **Change:** Replaced the login worker's separate counter read/write with a storage adapter call to a proposed PostgreSQL RPC. Added migration `supabase/migrations/20261016050000_atomic_login_rate_limit.sql`, which atomically upserts a per-IP counter, applies a 15-minute expiry, validates the key/TTL, and grants execution only to `service_role`.
- **Tests added:** A 20-request concurrent failed-login regression test expects exactly eight password checks and twelve HTTP 429 responses. Storage tests check the RPC route, payload, server-side authorization header, and invalid-key rejection.
- **Failure behaviour:** Login returns HTTP 503 if the atomic limiter is missing or the RPC fails. No fallback to a non-atomic read/write counter was added.
- **Evidence:** Changes are on branch `fix/atomic-login-rate-limit`, based on `fix/trusted-ip-header-validation`. Worker source copies were updated in parallel and have matching blob SHA at the time of this entry.
- **Result:** Implementation drafted; CI has not yet run for this branch. The migration exists in GitHub only and has **not** been applied to the live Supabase project.
- **Risks/blockers:** The trusted origin of `CF-Connecting-IP` is still unverified. Until the migration is applied in an approved test environment and concurrency tests pass against PostgreSQL, atomic behaviour is not runtime-verified. Configuration and controlled end-to-end tests remain outstanding.
- **Next action:** Open a draft PR, run CI, fix any test/type issues, review SQL privileges and expiry behaviour, and keep deployment/frontend changes gated on explicit approval.


## Entry: 2026-10-16 | Atomic login rate-limit CI result

- **Validation:** GitHub Actions run #105 passed: https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/38877771261
- **Evidence:** Supabase Edge Function type-check passed; all 26 tests passed (17 worker tests and 9 storage tests); migration/setup file checks passed. The new concurrent-login regression passed.
- **Correction during validation:** The first run exposed that the existing trusted-IP validation test expected a lone non-IP string (`x`) to fail, while the previous check only rejected empty, oversized, whitespace-containing, and comma-separated values. Added IPv4/IPv6 syntax validation and reran CI successfully. Both worker copies remain identical.
- **Result:** Proposed code and static test suite pass CI. This validates the mocked concurrency behaviour and code contract, not the actual PostgreSQL RPC under live concurrent load.
- **Risks/blockers:** Migration is not applied to Supabase. Trusted `CF-Connecting-IP` provenance is unverified. Secret/configuration status and controlled end-to-end tests remain outstanding. PR #11 remains draft and unmerged.
- **Next action:** Review the migration and runtime identity trust design, then only after explicit approval run the migration and integration tests in a controlled test environment. Do not deploy or connect the frontend yet.


## Entry: 2026-10-16 | SQL security review and trusted-IP evidence

- **SQL hardening:** Changed the proposed `mg_increment_login_failures` security-definer function to use an empty `search_path`; the target table remains schema-qualified. The function still revokes execution from `PUBLIC`, `anon`, and `authenticated`, granting it only to `service_role`.
- **Setup documentation:** Updated `supabase/SETUP.md` to require the storage migration followed by the atomic-counter migration before deploying the updated worker, and to distinguish mocked concurrency tests from a real PostgreSQL concurrency test.
- **Trusted-IP research:** Current Supabase docs describe the Edge Function gateway and list `cf-connecting-ip` among captured gateway request headers. They do not establish that the gateway overwrites or strips client-supplied `CF-Connecting-IP` for this project's route. Cloudflare's general header documentation describes Cloudflare-to-origin behaviour, but cannot alone prove the Supabase path. Trusted-IP provenance remains unresolved. Sources reviewed: https://supabase.com/docs/guides/functions and https://supabase.com/docs/guides/observability/log-field-reference
- **Validation status:** These are documentation and SQL-migration edits only after CI run #105. A fresh CI run is required to validate the current head. No SQL was applied to the live database, no function was deployed, and no frontend was changed.
- **Next:** Confirm current CI; continue with a safe controlled method to test actual gateway header behaviour and real PostgreSQL atomicity. Keep release blocked until both are verified.


## Entry: 2026-10-16 | CI rerun after SQL hardening

- **Validation:** GitHub Actions run #110 passed: https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/38879368956
- **Checks:** Supabase Edge Function type-check passed; all 26 worker/storage tests passed; migration/setup file checks passed.
- **Scope:** This run includes the migration's empty `search_path` hardening and the updated setup documentation. It does not execute the migration against PostgreSQL or prove gateway header trust.
- **Result:** Branch remains draft PR #11, unmerged and undeployed. No live database, backend deployment, or frontend configuration was changed.


## Entry: 2026-10-16 | Real PostgreSQL atomicity integration check

- **Change:** CI now starts an isolated PostgreSQL 16 service, applies the existing `mg_kv` migration and the proposed atomic-counter migration, then tests the SQL function directly.
- **Integration assertions:** 20 concurrent PostgreSQL calls produce a final counter of exactly 20; an expired counter resets to 1; `anon` and `authenticated` cannot execute the RPC, while `service_role` can.
- **Validation:** GitHub Actions run #115 passed, including the Edge Function type-check, 26 Deno tests, migration/setup checks, and the new PostgreSQL integration step: https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/38879497026
- **Evidence boundary:** This is real PostgreSQL validation in CI, not a test against the live Supabase project. It does not establish whether the hosted gateway strips or overwrites a client-supplied `CF-Connecting-IP` header.
- **Status:** PR #11 remains draft, open, unmerged. No live migration, backend deployment, or frontend change occurred.

## Entry: 2026-10-16 | Trusted-IP follow-up research

- **Research:** Rechecked the current Supabase Edge Functions gateway overview and two Supabase community discussions about client IP headers. The official overview confirms gateway routing but does not document a guarantee that this route overwrites or strips caller-supplied `CF-Connecting-IP`. A 2022 maintainer reply discusses `X-Forwarded-For` population; a 2025 community report describes a spoofed value appearing before an appended IP and notes `CF-Connecting-IP` appeared to contain the client IP.
- **Evidence boundary:** The community posts are not a current security contract, and the 2025 report is observational rather than a verified guarantee for this project's exact path. They do not justify switching to the first or last `X-Forwarded-For` value without testing the full proxy chain.
- **Decision:** Keep login fail-closed when `CF-Connecting-IP` is missing or malformed. Do not send spoofing probes to the live login endpoint. Resolve via authoritative platform confirmation or a controlled test in a dedicated non-production Supabase project.
- **Alternative if unresolved:** Evaluate a trusted proxy that overwrites a private client-IP header, or managed owner authentication with provider-side rate limits and MFA. Do not implement either without reviewing the design first.
- **Sources:** https://supabase.com/docs/guides/functions ; https://github.com/orgs/supabase/discussions/7884 ; https://github.com/orgs/supabase/discussions/34647
- **Result:** Research and durable documentation only. No live endpoint was probed, no deployment/configuration was changed, and no secrets were accessed. PR #11 remains draft and unmerged.
- **Next action:** Obtain authoritative confirmation or prepare an isolated non-production test project, then document results before considering release.

## Entry: 2026-10-16 | Added staging-only trusted-IP test protocol

- **Change:** Added [TRUSTED_IP_VALIDATION.md](TRUSTED_IP_VALIDATION.md), a step-by-step protocol for testing whether Supabase's Edge Function gateway overwrites caller-supplied `CF-Connecting-IP` values in a dedicated non-production project.
- **Safety boundary:** The procedure explicitly prohibits spoofing probes against the production login endpoint. The temporary diagnostic function must contain no secrets or database writes and must be removed after testing.
- **Acceptance criteria:** Compare received headers with the test client's independently known public egress IP, repeat with multiple spoofed values, and obtain platform confirmation before relying on observed behavior as a production security property.
- **Status:** Protocol documented; test not yet run because no dedicated staging project has been established/verified through this workflow. No live endpoint was probed, and no backend or frontend was deployed or changed.
- **Next:** Establish a dedicated staging environment or obtain authoritative platform confirmation, execute the protocol, and record evidence before revisiting the release gate.


## Entry: 2026-10-16 | CI run #122 passed

- **Validation:** GitHub Actions run #122 passed: https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/38880309402
- **Checks:** Edge Function type-check, API contract smoke tests, migration/setup validation, and the PostgreSQL atomic rate-limit integration step all completed successfully.
- **Integration evidence:** The workflow's PostgreSQL test validates concurrent atomic increments, expiry reset, and execution privileges in isolated CI PostgreSQL. This is not a live Supabase database test.
- **Result:** Current CI workflow is green. PR #11 remains draft and unmerged; no live migration, backend deployment, frontend connection, or live login test occurred.
- **Risks/blockers:** The hosted Supabase gateway's treatment of caller-supplied `CF-Connecting-IP` remains unverified. Required secrets/configuration and controlled end-to-end tests remain outstanding.
- **Next action:** Establish or verify a dedicated non-production Supabase environment, or obtain authoritative platform confirmation of header provenance. Do not probe production login or deploy/connect the frontend before explicit approval.


## Entry: 2026-10-16 | Read-only live Supabase status check

- **Checks performed:** Queried the connected Supabase project inventory, applied migration list, and deployed Edge Function metadata through the connected Supabase integration.
- **Evidence:** Only one project is visible in the connected account, `Kira Marketing Genius` (`uodjgguffxapxbcvzkpu`), and no Supabase development branches are listed. The live database migration list contains only `20261016035033 mg_kv`; the proposed atomic counter migration `20261016050000` is not recorded as applied. The deployed `marketing-genius` function is ACTIVE, version 4, with `verify_jwt=false`.
- **Result:** This confirms the atomic rate-limit migration is not applied to the live project and the currently deployed function has not been replaced by the proposed worker. Metadata check only; no live endpoint was probed and no data/configuration was changed.
- **Risks/blockers:** No isolated staging project is currently visible. The trusted origin of `CF-Connecting-IP` remains unverified; required secrets/configuration and controlled end-to-end acceptance tests remain outstanding.
- **Next action:** Before any staging deployment, establish an isolated non-production Supabase project with the owner's cost approval if required, or obtain authoritative platform confirmation. Keep the production project, deployed function, and frontend unchanged until the owner explicitly approves the release.


## Entry: 2026-10-17 | Free-only continuation and PR #11 code review

- **Owner constraint:** Continue using only open-source or genuinely free options. Do not create paid branches, subscriptions, or services with unclear charges. No new Supabase staging branch/project was created.
- **Review performed:** Re-read PR #11's worker tests, storage RPC tests, trusted-IP validation protocol, and GitHub Actions workflow. Confirmed the two worker copies are byte-identical; tests cover missing/malformed IP headers, client-controlled X-Forwarded-For/X-Real-IP not changing the bucket when CF-Connecting-IP is supplied, concurrent login throttling, and atomic RPC permissions in isolated PostgreSQL CI.
- **Evidence:** CI run #125 passed on commit 1c7fc327d24f91b61a20f9d6802fb9caee835dde: https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/38882264116
- **Limitations:** Worker unit tests use a simulated environment and cannot prove Supabase's hosted gateway overwrites caller-supplied CF-Connecting-IP. The isolated PostgreSQL test does not verify the live Supabase database or deployed function. Required runtime configuration and end-to-end login/campaign persistence remain unverified.
- **Safety/status:** No production endpoint was probed; no secret values were accessed; no migration, deployment, frontend connection, merge, or social publishing occurred. PR #11 remains draft. Project remains IN PROGRESS / NOT PRODUCTION-READY.
- **Next action:** Continue with existing free GitHub CI and source review. Seek authoritative Supabase confirmation or an owner-approved zero-cost isolated test environment for trusted-IP provenance. If no trustworthy free validation route exists, evaluate a different authentication/rate-limit design before release.


## Entry: 2026-10-17 | Zero-cost isolated gateway probe

- **Cost/environment:** Created a separate Supabase project named `Kira Marketing Genius Security Test` in the existing organisation. Supabase's cost quote was **$0/month**. Project ref: `cyndbisxznohjkxuiyfi`, region `ap-southeast-2`. No production project settings or data were changed.
- **Test method:** Deployed a temporary, no-secret Edge Function that echoed only gateway-observed IP-related request headers. Ran two independent GitHub Actions probes from hosted runners against the isolated function endpoint. No production login endpoint was called and no database writes were made.
- **Observed baseline:** Requests without spoofed IP headers returned HTTP 200 and contained a gateway-supplied `CF-Connecting-IP`. The observed `X-Forwarded-For` value contained a proxy-generated chain.
- **Spoof attempts:** Across both runs, requests that supplied a caller-controlled `CF-Connecting-IP: 198.51.100.77` were rejected with HTTP 403 (Cloudflare error code 1000) before the diagnostic function returned headers. Requests that supplied only `X-Forwarded-For: 203.0.113.88` or `X-Real-IP: 192.0.2.66` returned HTTP 200, but those supplied values were not reflected in the function's received headers. This is positive empirical evidence for this test route, not a universal platform guarantee.
- **Interpretation:** Do not trust `X-Forwarded-For` or `X-Real-IP`. The hosted gateway rejected caller-supplied `CF-Connecting-IP` in the tested requests, so the worker's strict use of that header is supported by isolated evidence. However, a 403 does not prove the gateway's exact internal overwrite behavior, and no authoritative platform guarantee has yet been obtained. Keep the fail-closed behavior and retain this as a release caveat until Supabase confirms the behavior or the exact deployment route is independently validated.
- **Cleanup:** The temporary diagnostic function was redeployed to return HTTP 410 and no longer performs probes. The temporary probe PR is being closed and its workflow removed. The zero-cost test project remains available for further controlled checks.
- **CI:** The production-code PR #11 CI remains passing on commit `ac283d5099621a33ba8368e670f3d768a2273c01`: https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/38894524989. Temporary probe runs: https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/38896786202.
- **Release status:** No merge, production deployment, live database migration, frontend API connection, secret access, or publishing occurred. Project remains **IN PROGRESS / NOT PRODUCTION-READY** until configuration, exact-path login acceptance, and remaining release gates are verified.


## 2026-10-17: Atomic login limiter CI rerun passed

- Corrected the malformed-IP test wrapper in `supabase/functions/marketing-genius/worker_test.ts` after the prior workflow failed on a syntax error.
- Follow-up GitHub Actions run succeeded on commit `5fa60ce52c2809c334a20b9f5cffc555f36de659`: https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/38964333374
- Verified workflow steps passed: Edge Function type-check, worker and storage Deno tests, migration/setup validation, and PostgreSQL 16 atomic counter concurrency/expiry/permissions checks.
- Confirmed `backend/worker.js` and `supabase/functions/marketing-genius/worker.js` have identical blob SHA `bf124904758e1f0d7821e7fe76964a244910fe46` on this branch.
- The trusted client-IP provenance gate remains open. The isolated staging test is evidence only, not a platform guarantee.
- PR #11 remains open and draft. No merge, production deployment, production migration, frontend connection, or production endpoint test was performed.


## Entry: 2026-10-17 | Replace custom owner login with Supabase Auth

- **Change:** Added a review branch, feature/supabase-auth-owner-login, replacing the custom password verifier and IP-header-based login throttle with Supabase Auth email/password sign-in. Each API request validates the access token through Supabase Auth and checks the authenticated email against server-side OWNER_EMAIL. Added refresh-token handling and updated the Settings form to request owner email and password.
- **Security rationale:** The application no longer depends on an unverified CF-Connecting-IP header. Sign-in throttling is delegated to Supabase Auth. The owner allowlist is server-side; an authenticated non-owner account is rejected.
- **Files changed:** app.js, backend/worker.js, supabase/functions/marketing-genius/worker.js, supabase/functions/marketing-genius/index.ts, and supabase/functions/marketing-genius/worker_test.ts.
- **Validation:** Not yet complete. CI must run against the draft PR, and actual Auth, refresh, persistent storage, campaign CRUD, rules/AI generation, CORS, and approval safeguards still require the isolated staging project.
- **Configuration:** No secret values were read or changed. Staging owner account and required Edge Function settings have not been verified.
- **Production:** Unchanged. No production migration, secret, function, or frontend configuration was modified.
- **Next action:** Finish docs, run PR CI, then configure and deploy only to the isolated staging project after the owner account email is confirmed.


## Entry: 2026-10-17 | Isolated staging deployment

- **Owner identity:** The requested owner email is Terilliom@gmail.com. It is intended for the server-side OWNER_EMAIL allowlist; no account password was requested or created.
- **Staging storage:** Applied migration mg_kv_storage to the dedicated free project cyndbisxznohjkxuiyfi. Verified public.mg_kv exists, has RLS enabled, and contains zero rows.
- **Staging function:** Deployed marketing-genius version 1 to the isolated project using the Supabase Auth migration branch. Production was not touched.
- **Configuration limitation:** The available integration can retrieve the project's publishable key but cannot safely set or inspect Edge Function secret names, invite/create an Auth user, or send an invitation email. Required OWNER_EMAIL and SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY) configuration and the owner account remain unverified. No secret values were read or changed.
- **Integration-test status:** The real staging deployment is in place, but end-to-end sign-in, throttling, refresh, campaign CRUD, AI/rules fallback, and CORS have not been marked passed because the owner account/configuration is not ready and the runtime endpoint could not be invoked from this tool session. CI passing is not represented as live integration evidence.
- **Security advisor:** Checked after staging deployment; see current project advisor response. Production remains unchanged.
- **Next required action:** In the staging project's Authentication dashboard, create/invite the owner account and confirm its email. Configure OWNER_EMAIL=Terilliom@gmail.com and SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY) for the staging Edge Function without sharing any password or secret value in chat. Then rerun live endpoint tests before any merge or production deployment.
