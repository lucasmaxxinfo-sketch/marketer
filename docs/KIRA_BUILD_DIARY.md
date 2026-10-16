# Kira Marketing Genius — Build Diary and Technical Record

**Record status:** Living build log; not a completion certificate  
**Last verified:** 2026-10-16 (UTC)  
**Repository:** https://github.com/lucasmaxxinfo-sketch/marketer  
**Live frontend:** https://lucasmaxxinfo-sketch.github.io/marketer/  
**Backend project:** Supabase project `uodjgguffxapxbcvzkpu`, Sydney region (`ap-southeast-2`)  
**Important:** This document records verified implementation facts separately from pending work. Never put passwords, access tokens, or secret values in this file.

## 1. Purpose and scope

Kira Marketing Genius is a marketing management web app intended to support campaign planning and creation, channel selection, campaign storage, and a controlled publishing workflow. This record is being maintained during development so a final PDF can document the implementation, decisions, tests, visual evidence, failures, and release status.

The project owner's operating constraints are to prefer zero-cost and open-source components, avoid paid AI dependencies, keep marketing outputs focused and accurate, require owner review, and avoid making live changes without explicit authorization.

## 2. Current status snapshot

| Area | Status | Evidence / limitation |
|---|---|---|
| Existing web frontend | Published | GitHub Pages URL above. The frontend has not been switched to the new backend in this build sequence. |
| Repository and CI | Active | Repository includes workflows for deployment, visual checks, 3D portrait checks, campaign learning, and Supabase backend checks. |
| Supabase project | Created on Free plan | Project ref and region recorded above. Free-plan limits and third-party costs still apply. |
| Key-value storage migration | Applied | `supabase/migrations/202610160001_mg_kv.sql`; table `public.mg_kv`, RLS enabled, no anonymous/authenticated policies; intended server-side service-role access. |
| Supabase Edge Function | Active, version 3 | Function `marketing-genius`; `verify_jwt=false` because the app uses its own owner session token. Application-level auth must therefore be correctly configured and verified. |
| Rules-based campaign generator | Implemented and deployed in function version 3 | Engine label `rules-based-free-v1`; not a language model. Produces three draft posts and a rule-based channel strategy. |
| Paid AI provider | Removed from current worker path | Latest worker implementation returns the free strategy and generation functions directly. No OpenAI API key is required for campaign generation. |
| Automated checks | Passed for latest recorded commit | GitHub Actions run #73, commit `a290eb3a7f0803f6966cc4a4ced6fe4c70905964`; type-check, API contract smoke tests, and migration/setup file checks passed. |
| Owner login secrets | Pending owner configuration / confirmation | Required server-side values: `APP_LOGIN_PASSWORD`, `SESSION_SECRET` (at least 32 bytes), and recommended explicit `APP_ORIGIN`. Secret values must not be committed or shared in chat. |
| Live end-to-end test | Not yet verified | A successful HTTP health request, login, save/load campaign round trip, and frontend integration have not been confirmed in the recorded evidence. |
| Social publishing | Not configured / not verified | Worker has Meta Graph API paths for Facebook/Instagram, but no credentials were configured in this work. Treat publishing as unavailable until separately authorized, configured, and tested. |
| Pull request #7 | Open draft, not merged | https://github.com/lucasmaxxinfo-sketch/marketer/pull/7 |
| Pull request #6 | Open draft / backend migration work | https://github.com/lucasmaxxinfo-sketch/marketer/pull/6 |
| Live frontend deployment from this work | Not performed | No frontend switch or PR merge was made as part of the recorded work. |

## 3. Architecture and key files

- `index.html`, `styles.css`, `app.js`: browser application shell, styling, and front-end behavior.
- `kira-avatar-3d.js`: procedural Three.js portrait; a pre-existing SVG fallback is retained.
- `manifest.webmanifest`, `sw.js`, `icon.svg`: installability, service-worker behavior, and app icon assets.
- `backend/worker.js`: owner-only API logic, session signing/validation, campaign operations, free rules-based generation, and optional publishing code paths.
- `backend/SETUP.md`, `backend/wrangler.toml`: backend setup/deployment configuration.
- `supabase/functions/marketing-genius/index.ts`: Supabase Edge Function entry point.
- `supabase/functions/marketing-genius/storage.ts`: storage adapter used by the Edge Function.
- `supabase/functions/marketing-genius/worker_test.ts`: smoke tests for rules-based campaign generation and channel recommendations.
- `supabase/functions/marketing-genius/storage_test.ts`: storage adapter tests.
- `supabase/migrations/202610160001_mg_kv.sql`: key-value table migration.
- `.github/workflows/`: CI and deployment workflow definitions, including `supabase-backend-check.yml`, `visual-check.yml`, `kira-3d-check.yml`, `campaign-learning-check.yml`, `deploy-api.yml`, and `deploy.yml`.

The deployed function uses a function-local `worker.js` import. During deployment, the import path was adjusted from the repository-relative path to `./worker.js` so the function bundle resolves its worker module correctly.

## 4. Build diary

### Stage A — Existing app and presentation

**Evidence in repository history:** a commit titled “Refine Kira with a responsive 3D portrait” describes a procedural Three.js portrait, retained SVG fallback, and mobile/desktop browser checks.

**Decision:** keep a fallback rather than making the 3D portrait the only rendering path. This is a resilience choice for environments where WebGL or the 3D asset fails.

**Verification note:** the commit message describes the intended checks; it is not a substitute for reviewing the individual test run and screenshots in the final evidence pack.

### Stage B — Campaign quality and platform validation

Repository history includes “Strengthen Kira campaign quality rules” and “Validate Kira campaign platform selection.”

**Decision:** constrain campaign quality and validate selected platforms before sending work into platform-specific paths. This is intended to reduce mismatched platform output and unsupported claims.

**Reasoning:** a marketing manager must make the audience, offer, platform, and call to action clear, and must not imply a channel is connected merely because it appears in the plan.

### Stage C — Supabase backend migration

A Supabase project named “Kira Marketing Genius” was created in the Sydney region on the Free plan. The `mg_kv` migration was applied.

**Decision:** keep campaign data server-side and restrict direct table access. RLS is enabled without public or authenticated-user policies because the intended access path is through the trusted backend service role.

**Security implication:** the Edge Function has `verify_jwt=false`; therefore the custom owner login, HMAC session validation, origin controls, and server-side secret configuration are important. This arrangement is not considered production-verified until the secrets are configured and the end-to-end auth flow is tested.

**Complication:** the available Supabase connector path did not provide a supported action for writing Edge Function secrets. The safe path is for the owner to set the values directly in the Supabase Dashboard. No secrets were entered into this record.

### Stage D — Zero-cost campaign generation

Pull request #7 adds a deterministic rules-based generator. Its current code includes `freeStrategy` and `freeGenerate`, and the latest commit forces the strategy and generation entry points to use those functions.

**Decision:** remove the paid AI provider call path rather than merely using it as a fallback when an API key is absent.

**Reasoning:** the owner requested zero-cost/open-source options. A fallback-only design could still incur paid API usage if a provider key happened to be present. Removing the provider path makes the current campaign-generation behavior explicit.

**Trade-off:** the rules engine is deterministic and less adaptive than a language model. It should be clearly labeled as rules-based output, reviewed by the owner, and improved through transparent rules and observed campaign outcomes rather than being presented as AI-generated reasoning.

**Current output shape:** three draft posts with different objectives (awareness, consideration, action), platform assignments from the provided list, visual briefs, calls to action, and suggested relative days. These relative day labels are draft sequencing hints, not calendar dates.

**Quality limitation:** rules-based templates can be repetitive or generic. This implementation should be evaluated against real briefs before being treated as marketing-quality complete.

### Stage E — Automated verification

The latest recorded CI run is GitHub Actions run #73:
https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/38847996009

The run completed successfully. Its job steps included:
1. Set up job.
2. Check out repository.
3. Set up Deno.
4. Type-check the Supabase Edge Function.
5. Run API contract smoke tests.
6. Validate migration and setup files exist.

Commit tested: `a290eb3a7f0803f6966cc4a4ced6fe4c70905964`, “Remove paid AI provider path from free campaign engine.”

**Interpretation:** this verifies the listed automated checks only. It does not prove the deployed endpoint, owner login, browser integration, or social publishing works end to end.

### Stage F — Edge Function deployment

The Supabase function listing showed:
- Name/slug: `marketing-genius`
- Status: `ACTIVE`
- Version: `3`
- Function ID: `b2b30403-599c-447f-8326-005bc9167304`
- JWT gateway verification: disabled (`verify_jwt=false`)

**Decision:** deploy the free campaign engine to the server function without switching the live frontend to it yet.

**Reasoning:** deploy and validate backend components separately from the public UI to reduce release risk.

**Outstanding verification:** an external HTTP health request could not be confirmed through the available connector path. Do not mark live health as passed until a real request is executed and its response is captured.

## 5. Known complications and risk register

1. **Owner secrets are not confirmed configured.** Without `APP_LOGIN_PASSWORD` and a `SESSION_SECRET` of at least 32 bytes, login should fail safely. Configure them in Supabase Dashboard and never record their values.
2. **Frontend/backend integration is pending.** The published site remains unchanged. Confirm the frontend's API base URL, CORS origin, auth token lifecycle, error states, and storage round-trip before release.
3. **Function gateway JWT verification is disabled.** This is intentional for custom owner sessions, but increases the importance of application-layer authentication and abuse protection.
4. **Publishing code is not the same as publishing readiness.** Meta credentials and any required platform permissions are not configured or verified.
5. **Free tier is not a blanket cost guarantee.** Supabase usage limits, build hosting, platform API terms, and future usage may change.
6. **Rules-based generation quality needs human evaluation.** Automated contract tests do not establish that every generated post is compelling, brand-accurate, or commercially effective.
7. **Visual evidence needs to be captured and verified.** The final PDF should use genuine screenshots of the actual app and relevant CI/dashboard states where available. Do not fabricate screenshots or present diagrams as real app captures.

## 6. Release acceptance checklist

- [ ] Owner has set `APP_LOGIN_PASSWORD`, `SESSION_SECRET` (at least 32 bytes), and explicit `APP_ORIGIN` in Supabase secrets.
- [ ] Health endpoint responds with the expected JSON and reports storage/login capability accurately.
- [ ] Owner can sign in; invalid password, expired session, and rate-limit behavior are tested.
- [ ] Campaign can be created, saved, retrieved, edited, and deleted without data loss.
- [ ] Three-post generation works for valid briefs and rejects incomplete briefs safely.
- [ ] Generated content is reviewed for accuracy, originality, platform fit, and legibility before use.
- [ ] Frontend/backend CORS and session behavior work on the actual GitHub Pages origin.
- [ ] Mobile and desktop layouts are tested with genuine screenshots captured.
- [ ] Social publishing remains disabled unless separately authorized and credentials/permissions are configured and verified.
- [ ] Security and performance advisories are reviewed and any material issues are addressed or documented.
- [ ] Pull requests are reviewed and merged only with owner authorization.
- [ ] A tagged release or final commit SHA is recorded.
- [ ] Final build-data PDF is compiled with real screenshots, test evidence, diagrams, release notes, and this diary.

## 7. Evidence collection plan for the final PDF

The final professionally formatted PDF should include:
- Cover, version, date, and completion status.
- Executive summary and current release decision.
- System architecture diagram and data-flow diagram.
- Repository and deployment map.
- A chronological build diary with commit SHAs and linked CI runs.
- Database schema and access-control explanation.
- API/authentication flow and secret configuration requirements (never secret values).
- Test matrix with exact outcomes and scope.
- Genuine app screenshots at mobile and desktop widths, captured after final integration.
- Screenshots of relevant CI outcomes and deployment state, clearly captioned with date and source.
- Graphs showing build-stage completion and test results, only from recorded evidence. A stage-completion chart must identify its checklist basis and must not imply statistical quality.
- Complications, errors, rejected approaches, trade-offs, and why each decision was made.
- Known limitations, security review, operating instructions, rollback/maintenance notes, and release checklist.
- Appendix of file paths, commit SHAs, migration names, and source links.

**Evidence integrity rule:** screenshots and graphs must represent actual captured evidence or be explicitly labeled as explanatory diagrams. No simulated screenshots, invented test outcomes, or inferred completion dates.

### Stage G — Documentation accuracy and visual evidence capture

The README was revised to reflect the current Supabase architecture and rules-based engine rather than older Cloudflare/OpenAI deployment notes. This avoids instructing a future operator to configure an AI API key that the current campaign-generation path does not use.

The browser verification workflow was expanded to:
- run on the active build branch as well as the main branch,
- capture genuine home and studio screenshots at mobile (390px) and desktop (1365px) viewport widths,
- upload the screenshot files as a CI artifact with a 30-day retention period, including when the browser test fails.

**Reasoning:** the requested final build PDF needs actual visual evidence, not recreated or illustrative mock screenshots. Capturing screenshots in the browser test provides dated evidence from the tested commit and helps document UI changes over time.

**Current status (verified 2026-10-16):** browser workflow run #71 completed successfully on commit `ded79545b83ebbaf62f4c9c7f60ca5a383d35550`. It uploaded artifact `kira-app-screenshots-71` (artifact ID `12024428003`) containing genuine home and studio captures at 390px mobile and 1365px desktop widths. The captures were inspected. The studio screens are legible and no longer show the earlier transition blur. The home screen displays the 3D Kira avatar and navigation at both tested widths. These are local browser-test captures of the branch under test, not proof that the production GitHub Pages frontend is connected to Supabase or that authentication works.

### Stage H — Health reporting and deployed function version 4

A follow-up review found that the health endpoint described the rules-based generator using the capability label `aiCampaigns`. That label could make the UI suggest that a paid or language-model-backed AI system was connected even though the current engine is deterministic.

**Change made:** the health payload now reports `aiCampaigns: false`, `campaignGeneration: true`, and `aiEngine: "rules-based-free-v1"`. The app's service-status line was changed from “AI campaigns” to “Free campaign drafts”. Unused OpenAI environment-variable pass-throughs were removed from the Supabase adapter. A test was added to lock in this distinction.

**Reasoning:** capability labels must describe what the deployed product actually does. This is both a product-trust and cost-control requirement.

**Deployment:** Supabase Edge Function `marketing-genius` was deployed as version 4. The function listing confirmed version 4 as active with gateway JWT verification disabled for the documented custom-session design.

**Verification scope:** backend CI run #80 passed type-checking, API contract smoke tests, and setup-file checks for the preceding backend/UI health-label changes. The additional explicit health-label assertions were committed afterward and need a subsequent CI run to confirm. Browser workflow run #71 passed and its screenshot artifact was inspected. The public health URL was not accessible through the available web inspection route, so a live HTTP health response remains unverified.

## 8. Change log for this document

- 2026-10-16: Initial living build record created from repository tree, pull request diffs, the latest CI run, Supabase function metadata, and the recorded migration/deployment actions.
- 2026-10-16: README corrected to describe the current Supabase backend, free rules-based campaign engine, pending secrets, and release limitations.
- 2026-10-16: Browser verification workflow updated to wait 750ms for the 580ms screen-arrival animation before capture. Browser run #71 passed and uploaded artifact `kira-app-screenshots-71` (ID `12024428003`); mobile/desktop home and studio images were downloaded and visually inspected.
- 2026-10-16: Health capabilities were corrected to distinguish rules-based drafting from AI generation, unused OpenAI environment pass-throughs were removed, and Supabase Edge Function version 4 was deployed. Follow-up CI for the explicit health-label assertions and live HTTP verification remain pending.
- Future changes should add dated entries and evidence links rather than silently rewriting the history.
