# Marketing Genius Command Centre — Build Status

**Audit date:** 7 November 2026  
**Repository:** `lucasmaxxinfo-sketch/marketer`  
**Default branch:** `main`  
**Production frontend URL:** https://lucasmaxxinfo-sketch.github.io/marketer/

This document records what is present in the repository and what still requires configuration or verification. A source-code implementation is not treated as proof that a live external service is connected.

## Product direction to preserve

- Kira is the focal point of the experience.
- The established visual direction is the animated cosmic environment, portrait/3D character treatment, pink/violet/cyan accents and cinematic presentation.
- The application is phone-friendly and uses a progressive web app foundation.
- Existing workspace areas include Home, To review, Create, Plan, Saved work, Businesses & tools, and Settings.
- Do not replace this experience with a generic admin dashboard.

## Repository inventory

| Area | Current source | Evidence / state |
|---|---|---|
| Application shell | `index.html` | Present |
| Main UI and workflows | `app.js` | Present |
| Base styling | `styles.css` | Present |
| Cinematic presentation | `cinematic-finish.css` | Present; includes a centered Kira composition and mobile viewport rules |
| Animated background | `cosmic-background.js` | Present |
| Kira character | `kira-avatar-3d.js`, `kira-portrait-data.js` | Present |
| Voice interface | `kira-voice.js` | Browser speech recognition/synthesis plus optional live AI conversation |
| Offline/PWA support | `manifest.webmanifest`, `sw.js` | Present |
| Owner API | `backend/worker.js` | Present |
| API deployment config | `backend/wrangler.toml` | Present, but KV namespace ID is still a placeholder in the tracked file |
| Frontend deployment | `.github/workflows/deploy.yml` | GitHub Pages workflow present; runs JavaScript syntax checks |
| API deployment | `.github/workflows/deploy-api.yml` | Manual/ backend-change deployment workflow present |
| Android build | `.github/workflows/build-android.yml`, `mobile/` | Android APK workflow present |

## Functionality found in source

### Frontend

- Campaign creation and local draft storage.
- Approval/review workflow.
- Campaign planning dates.
- Business profile and channel onboarding.
- CSV/Excel inventory import.
- Local fallback campaign draft creation.
- Cloud campaign sync when the owner API is configured.
- Kira voice navigation for built-in workspace areas.
- Optional full AI conversation when the live API is connected.

### Backend

The Cloudflare Worker defines:
- `GET /health`
- Owner login and session validation
- Campaign create/read/update/delete
- AI chat
- AI channel strategy
- AI campaign generation
- Publishing
- Analytics retrieval

The backend is designed to keep secrets server-side and requires owner authentication for protected API routes.

## Confirmed limitations in the tracked implementation

1. **Backend deployment is not verified.** The tracked Wrangler config still contains `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`. The deployment workflow substitutes a private GitHub Actions secret at deployment time, but this audit cannot see repository secrets or prove a successful Cloudflare deployment.
2. **Live AI is conditional.** Chat, strategy and campaign generation require `OPENAI_API_KEY` configured in the deployed Worker.
3. **Cloud persistence is conditional.** It requires a deployed Worker and configured KV binding.
4. **Publishing is limited.** The Worker currently supports Facebook Page feed text posts and Instagram feed image posts. Instagram requires a public HTTPS image URL.
5. **Social account credentials are not verified.** Facebook and Instagram publishing require Meta credentials and appropriate account/app permissions. Source code alone does not prove the accounts are connected or that Meta has approved the app.
6. **Timed autonomous publishing is not implemented.** The tracked Worker has a daily Cron Trigger for Kira's research scan, not for publishing. The scan requires a deployed Worker, configured KV and AI provider, a saved cloud business profile, and the owner's monitoring switch enabled. The campaign planner remains a planning view, not a timed publishing scheduler.
7. **Analytics are limited.** The backend currently retrieves configured Facebook post insights only. It does not provide a complete cross-platform analytics engine.
8. **TikTok and Google Business Profile publishing are not implemented in the Worker.** They appear as channel setup options, not supported publishing targets.
9. **Voice capability depends on the browser.** Voice input uses browser speech recognition; the code notes that support varies and recommends a compatible browser. Full conversational responses require the live AI API.
10. **Frontend browser checks now exist and are passing for the verified scope.** Playwright checks cover mobile and desktop rendering, Kira portrait loading and framing, the Three.js scene, five workspace portals, keyboard skip-link access, reduced motion, sound toggle and navigation. These tests do not yet cover backend routes, real publishing, connected account permissions or the full campaign lifecycle. The latest Android debug APK build passed and was published as [release android-build-126](https://github.com/lucasmaxxinfo-sketch/marketer/releases/tag/android-build-126). A real-device installation check remains outstanding.

## Delivery sequence

### P0 — Establish live baseline
- Verify the current GitHub Pages deployment and its latest Actions result.
- Verify the deployed Worker `/health` response.
- Verify owner login, KV persistence and AI capability without exposing credentials.
- Record each capability as live, unavailable or untested.

### P1 — Make core operations dependable
- Test campaign generation, editing, approval, cloud sync and recovery.
- Test Facebook publishing in a controlled Page environment.
- Test Instagram publishing with a real public HTTPS image asset.
- Ensure the UI reports actual provider responses and never implies a post was published without a confirmed provider post ID.

### P2 — Complete autonomous operations
- Design a real scheduled publishing system with explicit local timezone, posting time, queue state, retries, idempotency and audit history.
- Add platform-specific publishing integrations only after their current API permissions and requirements are verified.
- Expand analytics using platform-supported insights and clearly label unavailable metrics.
- Add trend research with dated source evidence, relevance scoring and a campaign opportunity queue.

### P3 — Production quality
- Add automated tests for frontend workflows and backend routes.
- Add operational monitoring, error reporting and backup/recovery checks.
- Test responsive layouts, accessibility, reduced-motion behavior and browser voice support.
- Verify Android APK builds and installation on a real device.
- Complete security review of account authorisation, token storage, CORS, rate limits and publishing approvals.

## Operating rule

Preserve the existing product and visual identity. Make incremental, testable changes. Do not label a feature complete until its real workflow has been exercised and the result verified.
## 2026-11-06 documentation milestone

- [Build diary](./BUILD-DIARY.md) now includes the system architecture map, campaign decision flow, decision register, change-quality gate and evidence policy.
- [System architecture SVG](./assets/marketing-genius-system-map.svg) is committed and linked from the diary.
- This milestone improves project governance and traceability; it does not change the runtime application or prove external services are live.

## Latest backend security verification — 6 November 2026

- Eight automated Worker tests passed, covering cloud campaign export/deletion, bounded AI inventory context, expired sessions, origin rejection, owner publishing approval and safe handling when Meta credentials are absent.
- [API workflow run 42196394879](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42196394879) confirms all eight tests passed.
- Deployment then stopped before contacting Cloudflare because these six repository secrets are missing: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `MG_DATA_KV_ID`, `APP_LOGIN_PASSWORD`, `SESSION_SECRET`, and `OPENAI_API_KEY`.
- The frontend build stage for [workflow run 42196394829](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42196394829) passed; deployment status was still running at the time of this update.
- No live Worker, AI service, cloud persistence or Meta publishing capability is claimed.

## Latest backend reliability verification — 6 November 2026

- All outbound OpenAI and Meta requests have a 20-second timeout.
- Provider network failures/timeouts return gateway errors instead of being misreported as invalid owner requests.
- Failed Meta publishing does not change an approved post to published.
- Facebook insights use an Authorization header for the access token instead of a URL query parameter.
- Ten Worker tests passed, including provider outage and publishing-state checks: [API workflow run 42197279525](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42197279525).
- Deployment still stops before contacting Cloudflare because the six required repository secrets are absent. No live backend is claimed.

## Immediate engineering gate

Before enabling autonomous execution, verify the deployed Worker, KV binding, owner login, AI provider configuration and Meta account permissions. Then design a durable scheduled queue with explicit timezone, posting time, retries, idempotency, audit events and a safe pause mechanism. Do not activate cron publishing until those controls and tests exist.
## Executive product experience standard

The owner-approved target is an executive-grade experience that is effortless to use, polished, simple, elegant and premium, while retaining a playful, exciting and distinctive personality.

Acceptance criteria:
- Clear purpose, current state and next action without exposing unnecessary system complexity.
- Simple, low-friction core workflows and progressive disclosure.
- Premium visual craft through typography, spacing, consistency, transitions and responsive states rather than clutter.
- Kira remains the central operating intelligence and the established cosmic identity is preserved.
- Motion and sound are purposeful, optional/controllable where appropriate, and never obscure essential information.
- Reduced-motion, keyboard, contrast, phone and desktop usability are tested.
- All live status indicators are backed by real application state.

Direction recorded in [BUILD-DIARY.md](./BUILD-DIARY.md). This is an acceptance target, not a claim that the current UI has passed the audit.

## Cross-cutting privacy and security requirement

Privacy-by-design and data protection by default apply across the whole product, not only to legal pages. Every feature must document its data purpose, collection minimisation, access permissions, processing/sharing, storage, retention, deletion, owner controls and failure cases.

Required product-wide controls include secure server-side credential handling, least-privilege account access, clear third-party processing disclosures, revocation/disconnection, appropriate audit trails, and tested export/correction/deletion processes where applicable.

Do not assume an unconfirmed company-wide policy or legal entity covers this product. Confirm the responsible entity, applicable jurisdictions and provider terms before public release. Legal wording and compliance require qualified review.

**Release gate:** No public launch until privacy/security controls are implemented and tested, data flows are documented, required notices and terms are accurate, and legal review is complete. This is a requirement, not a claim of current compliance.


## Latest verified frontend milestone — 2026-11-06

- Main render selector corrected in `app.js` (commit `d8a9fa7`).
- Workspace menu visibility corrected (commit `0f2cd88`).
- Mobile portrait offset corrected (commit `93ac75d`).
- Kira portrait browser verification passed on mobile (390 × 844) and desktop (1365 × 900): [workflow run 42189297265](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42189297265).
- General browser verification passed for mobile and desktop: [workflow run 42188816680](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42188816680).
- Latest Pages deployment succeeded: [workflow run 42189297262](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42189297262).

**Scope boundary:** These are frontend and layout checks. They do not prove Worker availability, AI provider configuration, Meta account permissions, successful live publishing, timed autonomous scheduling or legal compliance. The latest general browser run and Android build remain in progress.


## Live integration gate — verified 6 November 2026

The API deployment workflow has **not** deployed the Worker. Its latest inspected run, [41984097080](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/41984097080), stopped before contacting Cloudflare because these required GitHub Actions secrets were missing:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `MG_DATA_KV_ID`
- `APP_LOGIN_PASSWORD`
- `SESSION_SECRET`
- `OPENAI_API_KEY`

The values must be added by the repository owner under GitHub **Settings → Secrets and variables → Actions**. Do not paste secret values into source files, issues, build logs or this chat. Meta Page and Instagram credentials are optional in the workflow, but publishing remains unavailable until the relevant credentials and permissions are configured and tested.

**Current verified delivery:**
- Frontend Pages deployment: passed on commit `93ac75d`.
- Kira portrait mobile/desktop checks: passed on commit `93ac75d`.
- Android debug APK: built and published as [android-build-126](https://github.com/lucasmaxxinfo-sketch/marketer/releases/tag/android-build-126).
- A fresh general browser verification for the final mobile layout is still running; an earlier general browser run passed.

**Do not represent Kira's live AI, cloud persistence, Meta publishing or autonomous timed posting as active until the Worker is deployed and each capability is verified against the real provider.


## Owner data controls — implementation added 6 November 2026

- Settings now documents local browser storage and the data sent to the configured Worker/OpenAI when Kira's AI features are used.
- Export includes device data and all cloud campaign records when signed in.
- Owner-authenticated cloud campaign deletion paginates KV records and deletes in batches.
- Device clearing and cloud campaign deletion are separate, clearly described actions.
- Sign-out removes the current tab's session token; the signed token expires after 12 hours.
- Automated backend tests passed for unauthenticated deletion rejection, export pagination beyond 1,000 campaigns, and bulk deletion that preserves non-campaign KV keys: [API workflow run 42192100218](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42192100218).

**Limitations:** The current controls cover app device data and cloud campaign records. They do not revoke Meta credentials, erase provider-side AI request records, or constitute a completed retention policy/legal review. The latest browser checks and frontend deployment for this change are still being verified. Cloudflare Worker deployment remains blocked by missing private repository secrets.


## AI data minimisation — code and tests verified 6 November 2026

- Inventory sent to Kira is limited to 30 product records with bounded product-name, price, stock and category fields.
- The Worker applies the same limits server-side for chat and campaign generation.
- Campaign generation sends a bounded brief rather than forwarding the raw settings object and channel setup notes.
- Kira's system prompt no longer assumes a fixed list of business identities; it uses the owner-supplied current business context.
- All four backend tests passed, including the AI payload minimisation test: [workflow run 42192622926](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42192622926).

**Deployment state:** This code has passed syntax and automated tests, but the Worker has not been deployed because the required Cloudflare/OpenAI secrets are still absent. Do not describe these server-side controls as live until deployment succeeds.


## Latest Android and privacy UI verification — 6 November 2026

- Privacy disclosure and local export controls passed mobile and desktop browser verification: [run 42192290276](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42192290276).
- Updated frontend browser suite passed on the privacy-enabled build: [run 42192476417](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42192476417).
- Latest Android debug test package: [android-build-131](https://github.com/lucasmaxxinfo-sketch/marketer/releases/tag/android-build-131), built successfully in [run 42192476392](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42192476392).
- Privacy-enabled Pages deployment succeeded in [run 42192702015](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42192702015).


## Kira operations queue foundation — 6 November 2026

**Implemented in source:** Owner-authenticated Worker endpoints now support a persistent operations queue in the existing KV namespace:
- `GET /api/operations` lists operations, newest updates first.
- `POST /api/operations` creates a bounded operation record with a supported work type, priority, source metadata and optional evidence references.
- `PATCH /api/operations/:id` advances a record through an explicit state machine and appends a bounded status history.
- Queue records use a separate `operation:` key prefix. Campaign records and unrelated KV data are not touched.
- Terminal states cannot be reopened through the current transition rules. Invalid transitions return HTTP 409.
- All routes inherit the existing owner-session authentication and approved-origin checks.

**Important boundary:** This is the persistent work-queue foundation, not autonomous trend research or a finished Kira operations screen. The queue does not yet launch research jobs, call external sources, run on a timer, or publish. No live Worker deployment is claimed.

**Verification:** A new automated test covers creation, queued-to-in-progress transition, audit history, invalid transition rejection and listing. Workflow verification is pending.

**Next:** Connect the queue to Kira's actual research and opportunity-assessment workflow, then surface real queue state in the existing Kira interface. Only introduce scheduled scans after source access, cost limits, freshness rules and pause controls are implemented.


## Kira operations interface — 6 November 2026

**Implemented:** Added a dedicated **Kira’s work** view to the existing workspace navigation. The view displays operation type, priority, current state, update time, recorded result and blocker where present. It can refresh from the authenticated cloud queue. When the cloud workspace is not connected, it shows the device-local operation history and labels that boundary.

**Workflow integration:** The existing “Let Kira work” action now creates a campaign-preparation operation, advances it to in-progress while Kira prepares the campaign, and moves it to awaiting-owner after the draft is saved for review. This records the work the current action actually performs; it does not imply background trend monitoring or timed autonomy.

**Verification:** Frontend JavaScript syntax passed and the mobile/desktop browser verification passed on commit `60a7853`. GitHub Pages deployment passed in [workflow run 42198737100](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42198737100). Backend queue tests passed in [API workflow run 42198473868](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42198473868), before its separate missing-secrets deployment gate failed.

**Remaining:** The Worker API is not deployed. Until its six private deployment secrets are configured and the Worker is verified live, cloud operations persistence is not available in production. Local queue display remains available on the device. The operations screen has not yet had its own dedicated browser assertion; existing mobile/desktop navigation, layout and regression suite passed.


## Kira live research and opportunity assessment — 6 November 2026

**Implemented in source:**
- Added owner-authenticated `POST /api/research` using the OpenAI Responses API and hosted `web_search` tool. The search tool is required for each request, not merely optional.
- Research context is bounded server-side and includes the business name, service area, audience, selected platforms and up to 20 bounded inventory items.
- Kira is instructed to return a dated research snapshot, 2–4 ranked opportunities only when supported by evidence, confidence and limitations, and one recommended next move. Weak evidence must result in a no-campaign recommendation.
- Source URLs and titles are extracted from web-search sources/citation annotations. The API refuses to accept an empty report or a report with no cited source metadata.
- Kira’s work view now has an explicit **Research opportunities** action. It creates a persistent operation, advances it through in-progress, then awaits owner review with the report and source references attached.
- Added a business location/service-area field so research can be locally relevant when the owner supplies one.
- Added a live-research readiness indicator to the API health response.
- Operation evidence is sanitised and bounded server-side. Owner-only bulk operation deletion paginates through all records and preserves campaign and login-rate-limit keys.
- Workspace export now includes cloud operations as well as cloud campaigns. Settings provides a separate **Delete cloud operations** action. The privacy disclosure explains research data sent to OpenAI and storage of research reports/source links.
- Updated the service-worker cache and browser checks to cover the new research entry point, location field and privacy controls.

**Verification:** The latest inspected backend API workflow reports 14 tests passed and 0 failed, including live web-search request construction, citation extraction, empty-result rejection, evidence sanitisation and deletion across more than 1,000 operation records. The workflow then stopped at the private deployment-secrets gate before contacting Cloudflare. The new browser/privacy checks and PWA deployment are running separately; do not treat the Worker endpoint as live until the Worker is deployed and a real authenticated research request is verified.

**Configuration:** `OPENAI_API_KEY` is required. `OPENAI_RESEARCH_MODEL` is an optional Worker variable; default is `gpt-6-astra`. The Worker still needs the six existing private deployment secrets.

**Not yet implemented:** Automatic periodic scans, continuous trend monitoring, unattended opportunity decisions, or autonomous publishing. Research runs only when the owner starts it. The backend deployment blocker still prevents production research from running.


## Opportunity-to-campaign handoff — 6 November 2026

**Implemented:** An owner can select an evidence-backed opportunity from Kira’s work and choose **Build campaign from this**. The handoff:
- Requires an authenticated live workspace session.
- Creates a separate campaign-preparation operation and records the source evidence.
- Sends the selected research report and source references into the existing campaign-generation workflow.
- Instructs campaign generation to treat research as internal evidence, distinguish facts from interpretation and avoid unsupported public claims.
- Saves the resulting campaign draft to the cloud campaign store with its source operation ID and research evidence attached.
- Moves the new preparation operation to awaiting owner and closes the selected research operation as completed.
- Returns the owner to **To review**. It does not approve or publish the campaign.

**Verification:** Mobile and desktop browser workflow [42200156118](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42200156118) passed, including a seeded awaiting-owner opportunity and a check that campaign development refuses to proceed without an owner session. GitHub Pages deployment [42200155983](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42200155983) succeeded with service-worker cache `mgcc-cache-v32`. Backend workflow [42200047821](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42200047821) reports 14 passed, 0 failed, then stops at the six-secret deployment gate. Android build for cache-v32 is pending.

**Remaining:** The Worker is not deployed, so the full research-to-campaign pipeline cannot yet run against the live OpenAI service. The frontend and workflow are deployed, but this is not evidence that live research or cloud operations are operational. No scheduled scans or automatic publishing are enabled.


## Latest build and review provenance update

- Campaign review now exposes the source links retained from research-led campaign generation, allowing the owner to inspect the evidence before approval. Only valid HTTPS evidence links are displayed.
- PWA service-worker cache is now `mgcc-cache-v33` to refresh installed clients.
- Android build [143](https://github.com/lucasmaxxinfo-sketch/marketer/releases/tag/android-build-143) completed and the `app-debug.apk` release asset is uploaded. This is a debug-signed testing build, not a Play Store release.
- The Worker remains undeployed until the six required GitHub Actions secrets are configured. Live research, cloud persistence and publishing must not be treated as operational until separately verified against the deployed service.


## Campaign evidence regression check

The browser workflow now seeds a campaign containing both a trusted HTTPS research source and an unsafe `javascript:` URL. It opens the review screen and verifies that the trusted source is visible and the unsafe URL is not rendered as a link. Mobile and desktop verification passed in [run 42203263017](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42203263017). The workflow commit was deployed to GitHub Pages successfully in [run 42203262995](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42203262995).


## Navigation UX refinement — 6 November 2026

- Active workspace destination is now programmatically identified with `aria-current="page"` and receives a clear visual state.
- The existing drawer has a dimmed outside-click backdrop. Tapping outside closes it.
- Escape closes the drawer. Existing navigation destinations and Kira’s home composition are preserved.
- PWA cache advanced to `mgcc-cache-v35`.
- Mobile/desktop browser verification passed: [run 42205774474](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42205774474).
- GitHub Pages deployment succeeded: [run 42205774518](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42205774518).
- Android build [152](https://github.com/lucasmaxxinfo-sketch/marketer/releases/tag/android-build-152) completed successfully in [run 42205700715](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42205700715). This is a debug-signed testing APK, not a Play Store release.


## Campaign review UX — 7 November 2026

- Review is now organized into campaign summary, Kira's reasoning/research, individual post editing, optional targets and decision actions.
- Campaign lookup uses stable campaign IDs, not campaign names.
- Post copy, dates, statuses and targets persist locally as edited. Explicit Save changes syncs to cloud when signed in.
- Save validation prevents a post being marked Scheduled without a planned date.
- The review clearly states that saving or approving does not publish.
- PWA cache: `mgcc-cache-v36`.
- Mobile and desktop regression passed, including edit-and-persist verification: [run 42321383137](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42321383137).
- Web deployment succeeded: [run 42321383134](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42321383134).
- Android rebuild [run 42321354932](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42321354932) is still running. No new APK release is claimed yet.


### Owner decision queue: review before decision
- Simplified the To review queue so pending and returned campaigns expose one primary action: Review campaign.
- Removed immediate approve/send-back actions from those queue cards. Both owner decisions now appear inside the detailed campaign review, after the owner can inspect strategy, research provenance and individual post content.
- Retained the existing send-back reason prompt and approval confirmation. Neither action publishes content.
- Added mobile and desktop browser regression assertions for the review gate and both in-review decisions.
- Updated the service-worker cache to `mgcc-cache-v37`.
- Android build 154 completed successfully and includes the previous campaign review layout. The current queue refinement was committed after that build, so a fresh Android build is still required to include this latest change.


### Decision queue clarity refinement
- Added live counts to All, Pending and Sent back filters so the owner can see the size of each decision bucket before opening it.
- Added accessible `aria-pressed` state and a labelled filter group.
- Replaced the generic empty state with a message that reflects the selected filter.
- Updated the queue instruction to make the review-first process explicit.
- Added mobile and desktop regression checks for counts, filter state and filter-specific empty copy.
- Updated service-worker cache to `mgcc-cache-v38`.


### Kira work queue: truthful status and owner handoff
- Reworked operation cards to distinguish queued, in-progress, awaiting-owner, blocked, completed and cancelled states.
- Added plain-language explanations for each state, plus the latest recorded update when available.
- Blocked work now has a dedicated dependency panel that displays the recorded blocker, with a clear fallback if no reason was supplied.
- Completed work labels its result as a completed result. Research evidence remains visible as source links.
- The campaign-development handoff is shown only for an opportunity assessment that is awaiting an owner decision and has a saved result.
- Added mobile and desktop browser checks covering all five active test states, the blocker reason, completed result labelling and action eligibility.
- Updated the service-worker cache to `mgcc-cache-v39`.


### Kira operation audit trail and actor attribution
- Operation history now records whether a status transition was made by Kira or by the owner.
- Kira-created operations begin with Kira as the recorded actor; owner-created operations remain attributed to the owner.
- Kira's research, campaign preparation, blocked outcomes and completion transitions now identify Kira explicitly. Selecting a research opportunity is recorded as an owner action.
- Operation cards include a compact, expandable history showing recent status changes, actor, timestamp and note.
- Added Worker unit coverage for actor attribution and transition history, plus mobile and desktop browser checks for the visible history.
- Bumped the PWA service-worker cache to `mgcc-cache-v40`.


## Kira research recovery — implementation committed 7 November 2026

- Blocked opportunity research now has a real retry path, reusing its existing operation record and invoking the live research endpoint with current business settings.
- Duplicate clicks are guarded in the client; the Worker enforces legal status transitions and clears a blocker only when work moves out of the blocked state.
- No retry control is shown for other operation types without an executable recovery handler.
- Backend tests cover blocked → queued → in-progress recovery, blocker clearing, audit history and duplicate transition rejection.
- PWA cache advanced to `mgcc-cache-v41`.
- Verification and deployment are pending. The Cloudflare Worker remains blocked until the repository owner configures the six required private secrets. Do not claim live recovery until the Worker is deployed and tested against the production endpoint.


## Opt-in daily Kira research — implementation in progress

- Added an owner-only cloud business profile endpoint. Profile input is bounded server-side, including inventory context.
- Settings now offers an owner-controlled daily opportunity scan preference. It is off by default. When enabled and connected, the profile is synced to the Worker.
- Added a daily Cloudflare Cron Trigger at 14:00 UTC. The Worker checks the owner preference before calling OpenAI web search.
- A successful scheduled scan creates an **awaiting owner** opportunity operation with source links and Kira-attributed history. A failed scan creates a blocked operation with the recorded reason. A per-day marker prevents normal duplicate runs.
- The schedule does not approve campaigns, publish posts, or spend advertising budget.
- PWA cache advanced to mgcc-cache-v42.
- Automated verification is pending. Backend deployment remains blocked by the repository Actions configuration issue, so scheduled execution is not live yet.


**Verification update:** The browser regression now explicitly enables the daily monitoring preference and confirms it persists after saving on both mobile and desktop. Run [42328709455](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42328709455) passed. The PWA deployment for the current UI copy succeeded in [run 42328709528](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42328709528). Backend validation and all 19 Worker tests pass, but the deploy job still stops at the required private-settings gate before contacting Cloudflare. The current Android rebuild is in progress; no new APK release is claimed until its release asset is verified.


**Android verification:** Android build [170](https://github.com/lucasmaxxinfo-sketch/marketer/releases/tag/android-build-170) completed successfully. The APK is debug-signed for testing, not a production Play Store release.


## Verified repository state — 7 November 2026

This section supersedes older delivery counts and any older statements that conflict with the current tracked source.

### Kira's scheduled research

- `backend/wrangler.toml` contains the Cron Trigger `0 14 * * *` (14:00 UTC daily, 03:00 New Zealand daylight time).
- `backend/worker.js` implements the scheduled handler and `runAutonomousResearch`.
- The job exits without work unless the KV binding, OpenAI API key, cloud business profile and `researchMonitoringEnabled === true` are present.
- A completed scan creates an `awaiting_owner` opportunity operation with HTTPS source evidence. A failed scan creates a `blocked` operation. A per-UTC-day marker prevents a second completed scan that day and suppresses a recent in-progress duplicate.
- Automated Worker tests verify the enabled and disabled paths.
- **Operational state: not live-verified.** The Worker deployment is still blocked, so the presence of the trigger and handler in source is not evidence that a scheduled scan has executed.
- The research implementation uses OpenAI's hosted Responses API and hosted `web_search` tool. It is metered and proprietary, so it does not meet the owner's new all-open-source/no-mandatory-subscription direction.

### Latest verified builds and checks

- Backend JavaScript syntax and all 19 Worker tests passed in [API workflow run 42328864384](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42328864384).
- The same API workflow stopped at its private-settings preflight before contacting Cloudflare. Its runner log shows all six required values empty. No Worker deployment or live health check is claimed.
- Latest frontend deployment succeeded: [run 42328939851](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42328939851).
- Latest browser verification passed: [run 42328709455](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42328709455).
- Latest Kira 3D portrait checks passed: [run 42328709532](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42328709532).
- Android debug testing APK build 170 completed and was published: [release android-build-170](https://github.com/lucasmaxxinfo-sketch/marketer/releases/tag/android-build-170). This is a debug-signed testing build, not a Play Store production release.

### Open-source and cost audit

- No root `LICENSE` file was found in the repository tree during this audit. Public visibility does not itself grant open-source reuse rights.
- The current backend is a Cloudflare Worker with Cloudflare KV storage and Cron Triggers. These are hosted proprietary services, even where free allowances exist.
- Live AI and research call the OpenAI API. This is a proprietary metered dependency.
- The frontend loads SheetJS CE 0.18.5 and Three.js 0.160.0 from jsDelivr at runtime. Their exact bundled notices/licences and redistribution conditions must be recorded before vendoring or packaging them.
- The Android wrapper uses Capacitor 7 packages. A full dependency and asset licence inventory is still required.
- A staged migration plan is recorded in [OPEN-SOURCE-ROADMAP.md](./OPEN-SOURCE-ROADMAP.md). Do not remove working Cloudflare code until the replacement has parity tests and a reversible migration path.

### Correct operating position

The website and Android test build are delivering. Backend source and tests are delivering. Cloudflare deployment, scheduled execution, live AI, cloud persistence and social publishing remain unverified. No mandatory-cost-free or fully open-source claim is made for the current deployed system.


## Local open-source backend prototype — 7 November 2026

A first self-hostable backend runtime has now been added under `backend/local/`.

- `server.mjs` runs the existing `backend/worker.js` request handler inside Node.js 24. This deliberately reuses the existing API routes and business rules rather than rewriting them.
- `SQLiteKV` implements the Cloudflare KV methods currently used by the Worker: string/JSON reads, writes, deletes, TTL expiry and paginated prefix listing.
- SQLite stores records in a local database file with WAL mode and a busy timeout.
- The local HTTP server translates incoming HTTP requests into standard Fetch API `Request` objects and returns the Worker `Response`, preserving the existing API contract.
- A local daily UTC scheduler invokes the existing scheduled research handler at 14:00 UTC by default. It only runs while the local process is online and still requires the existing hosted OpenAI research provider and monitoring opt-in.
- A Dockerfile, localhost-only Docker Compose service, safe `.env.example`, SQLite online backup utility and integrity check have been added. Root ignore files exclude local credentials, database files and backups. No real credentials are stored in the repository.
- CI now uses Node.js 24 and runs both the original Worker tests and the new local backend tests. The Worker also has a provider adapter: local Ollama can run Kira chat, channel strategy and campaign generation without an OpenAI key. The local Compose stack includes an Ollama service and persistent model volume.

**Verification:** API workflow [42334277624](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42334277624) passed syntax checks, all 25 tests (22 Worker tests plus 3 local runtime tests), and Docker Compose configuration validation. It then stopped at the existing Cloudflare secret preflight. The same workflow then stopped at the existing Cloudflare deployment preflight because the runner received empty private settings. The local test pass is separate from, and does not claim, a live production deployment.

**Migration stage:** The Node/SQLite runtime and compatibility adapter are implemented and tested. The frontend has not yet been switched to this runtime. A local AI provider, replacement live-research provider, dependency/asset licence inventory, backup/restore tests and a clean-install test remain outstanding. OpenAI and Meta integrations are still optional third-party services, not open-source components.


### Packaging and backup follow-up

- Added root `compose.yaml` for a localhost-bound API container with persistent named SQLite volume and health check.
- Added `backend/local/backup.mjs` using SQLite online backup (`VACUUM INTO`) and a post-backup integrity check.
- Added automated backup-readback test.
- Added `.gitignore` and `.dockerignore` rules for local secrets, database files, backups and generated dependencies.
- The backup and packaging additions are in the current CI run; do not mark the backup test green until that run completes.


### Local AI provider boundary

- `backend/worker.js` now routes chat, channel strategy and campaign generation through a provider adapter.
- With `AI_PROVIDER=ollama`, requests use the local Ollama OpenAI-compatible chat endpoint and the configured `LOCAL_AI_MODEL`. No Authorization API key is sent and there is no silent OpenAI fallback.
- The local environment template selects Ollama and leaves `OPENAI_API_KEY` blank by default.
- The Compose stack runs Ollama with a persistent model volume. The default model must be pulled once by the operator.
- Automated tests verify chat and campaign generation work with Ollama configured and no OpenAI key. The current test uses a mocked Ollama HTTP response; it does not prove model quality or a real model download/runtime.
- **Still proprietary/metered:** live web research currently uses OpenAI Responses API and hosted web search. Keep the OpenAI key blank to avoid those calls; autonomous research will remain unavailable until a local research/search provider is implemented.


### Self-hosted research provider

- Added `researchWithSearxng` to the shared Worker handler. When `RESEARCH_PROVIDER=searxng`, it queries the configured private SearXNG JSON endpoint and passes bounded HTTPS result titles/snippets to the selected AI provider.
- With `AI_PROVIDER=ollama`, local Ollama analyses those snippets without an OpenAI key. No hosted AI fallback is used.
- Results with non-HTTPS URLs or empty snippets are excluded. The response retains source titles, URLs, observation time and supplied publication date notes.
- Added a private SearXNG service to Compose and enabled JSON output in the included settings file. It is only exposed inside the Docker network.
- CI test confirms the SearXNG query and local model call, source filtering and absence of hosted Authorization credentials.
- **Important limitation:** this is search-snippet analysis, not full-page verification. SearXNG aggregates public search engines, which may rate-limit, block or alter results. The service's own software is AGPL-3.0; its external search engines remain third-party services.


## Local runtime hardening — 7 November 2026

- Corrected Compose environment handling so the same `backend/local/.env` file supplies the private SearXNG secret to its container. The previous Compose interpolation looked for a root-level `.env`, which was not the file documented for setup.
- Corrected SQLite KV prefix matching to treat literal percent and underscore characters as characters rather than SQL LIKE wildcards. Added regression cases for both.
- Updated the local setup guide to distinguish the bare Node API (which does not start AI/search services) from the complete Docker Compose stack, and corrected the manual Docker code fence.
- Updated Settings and privacy copy so it no longer implies that every connected workspace sends data to OpenAI. It now distinguishes the local Ollama/SearXNG path from hosted providers and explains that scheduled scans require the local service to be running.

**Verification:** API workflow [42334490385](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42334490385) passed backend syntax checks, all Worker/local tests, and Docker Compose configuration validation. It then stopped at the known Cloudflare secret preflight. The runner still receives empty Cloudflare deployment credentials; no Cloudflare deployment is claimed. The PWA deployment after the latest frontend copy changes is pending and must be checked separately.

**Still not verified:** No real Docker containers or Qwen model have been started in this environment. The frontend has not yet been switched to a local API by default. The current app can connect through Settings using the local API address, but the owner must have the local stack running on the same device.


### Local browser connection boundary

- The local environment template now allows the hosted frontend origin `https://lucasmaxxinfo-sketch.github.io` by default, so the website can call the API on the same device at `http://localhost:8787` after the owner starts the local stack.
- The Worker CORS preflight handler supports the browser private-network preflight header, but only after the exact configured `APP_ORIGIN` has passed the origin check. Unapproved origins remain blocked.
- The Settings connection field now shows the local API address and explains the local connection path. Privacy copy distinguishes local Ollama/SearXNG processing from hosted providers.
- Automated suite now contains 26 tests. API workflow [42334644858](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42334644858) passed all 26 tests and Compose validation, then stopped at the known Cloudflare credentials preflight.
- Frontend syntax regression from the privacy copy was identified in Android/browser CI and corrected in commit [2603424](https://github.com/lucasmaxxinfo-sketch/marketer/commit/2603424448201b655b6bf7aafbb8720ff64e8d44). Browser, Android and Kira portrait workflows for that corrected commit are running; do not mark them passed until complete.


### Guided local installer — 7 November 2026

- Added a cross-platform Node.js installer at `backend/local/install.mjs`. It checks Node 24 and Docker/Compose, creates unique random owner/session/SearXNG secrets, preserves existing non-placeholder settings, writes the private environment file with restrictive permissions, builds and starts the three local services, waits for API health, pulls Qwen3-4B and performs a real Ollama response check.
- The installer prints a newly generated owner password once at successful completion. Existing owner passwords are preserved and not reprinted. Failure does not delete configuration, containers or stored data.
- Added automated tests for secret generation, preservation of existing credentials and repair of placeholder values.
- Added `node backend/local/install.mjs` as the recommended one-command install path and documented prerequisites, model download, connection and restart/stop steps.
- API CI now syntax-checks the installer and runs its three new tests alongside the existing backend suite. The full automated suite is now 29 tests.

**Not yet proven:** CI does not run the full Docker stack or download the model. The installer has not yet been executed on the owner's machine, so hardware compatibility and real first-run timing remain unverified.


### Installer end-to-end verification refinement — 7 November 2026

- Installer now tests Kira through the real authenticated local API route after the model download: owner login, session issuance, and an actual `/api/chat` request routed from the API container to Ollama. A successful response is required before it reports completion.
- A newly generated owner password is printed immediately after the private environment file is saved, before Docker startup/model download, so a later failure cannot leave the owner without the only displayed copy. It is not printed again on subsequent runs.


### Backend verification and optional deployment separation — 7 November 2026

- Split the backend pipeline into a required verification job and a separate optional Cloudflare deployment path. Backend syntax, all 29 tests and Compose configuration can now report success independently of unavailable Cloudflare credentials.
- If any required Cloudflare secret/variable is unavailable to the Actions runner, the workflow emits a clear warning and skips only the Cloudflare Worker deployment. This does not affect the local Node/SQLite/Ollama/SearXNG installer.
- The most recent pre-refactor API run [42335345223](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42335345223) confirmed all 29 tests passed and Compose validation passed. The new split workflow is awaiting its first verification run.


### Installer root-path regression fix — 7 November 2026

- Added a direct repository-root regression test and corrected the installer path calculation. The installer now locates `backend/local/.env.example` and `compose.yaml` relative to its own file, regardless of whether it is launched from the repository root or via the backend npm script.
- Installer test suite now contains four focused tests; the complete backend suite is 30 tests. The new workflow run is pending verification.


### Local daily scheduler catch-up — 7 November 2026

- Corrected the local scheduler so a process that starts after the configured UTC minute still runs that day's scan on its next check. It remains idempotent and runs no more than once per UTC day. A day when the machine is offline for the entire day is still not backfilled.
- Added regression tests for before-time, exact-time, late same-day startup and duplicate-day prevention. Complete backend suite now contains 31 tests; CI verification passed: backend workflow [42341369791](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42341369791) completed successfully with **35 tests passed, 0 failed**. The latest website deployment [42341385230](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42341385230) also completed successfully.


### Installer and scheduler CI verification — 7 November 2026

- Final backend verification run [42335632924](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42335632924) succeeded: **31 tests passed, 0 failed**, including installer repository-root resolution, local Ollama timeout behavior and scheduler catch-up. Docker Compose configuration validation passed.
- Optional Cloudflare deployment readiness completed successfully as a check; the actual Worker deployment was correctly skipped because the runner cannot access the six Cloudflare/OpenAI settings. This is not a backend test failure and does not affect the self-hosted installer.
- Full Docker/Ollama model download and Kira runtime test still need to be run on the target computer using the installer. CI does not claim that local machine runtime has been verified.


### Hosted-to-local browser connection verification — 7 November 2026

- Added an HTTP-level integration test through the actual Node local server adapter, not only the shared Worker handler. It verifies the configured GitHub Pages origin receives CORS permission, browser Private Network Access preflight is answered, health requests receive the expected origin header, and an unrelated origin is rejected.
- Documented the browser's possible local-network permission prompt and the loopback-only exposure boundary.
- This validates the server-side protocol path in CI. It does not replace a real browser test on the owner's computer; browser permission prompts and local runtime availability still need confirmation there.


### Hosted-to-local connection verification passed — 7 November 2026

- Backend workflow [42339576076](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42339576076) completed successfully. **32 tests passed, 0 failed**. The new test exercised the real local HTTP adapter and confirmed GitHub Pages-origin CORS, Private Network Access preflight, health access and rejection of an unrelated origin.
- Docker Compose configuration validation passed. The optional Cloudflare Worker deployment was skipped because the runner still cannot access its private deployment settings.
- The latest website build and deployment [42339586373](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42339586373) completed successfully on the updated main branch.
- Browser permission handling and the complete local Docker/Ollama runtime still require a real test on the target computer.


### Local AI model selection consistency — 7 November 2026

- Removed the hard-coded model override from Docker Compose. The API now receives the `LOCAL_AI_MODEL` value from the private environment file.
- The installer reads and validates that same value, downloads the selected Ollama model, and uses it for its authenticated Kira response check. The default remains `qwen3:4b`.
- Added regression tests for default selection, a different model tag, namespaced model references and rejection of unsafe shell-like values.
- This prevents a custom model setting from being ignored by Docker or the installer. Actual performance still depends on the selected model and available computer hardware.


### Configurable local model verification passed — 7 November 2026

- Backend workflow [42339717310](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42339717310) completed successfully: **33 tests passed, 0 failed**. This includes custom Ollama model selection and validation.
- Docker Compose configuration validation passed. Optional Cloudflare deployment readiness completed, but Worker deployment remained skipped because the six hosted deployment settings were not available to the runner.
- The code now uses the configured model consistently from `backend/local/.env` through Compose, installer download and API model selection. The default remains `qwen3:4b`.
- Actual model pull and response quality on the owner's computer remain unverified until the local installer is run.


### Scheduled research recovery hardened — 7 November 2026

- The local scheduler previously wrote a permanent daily-fired marker before confirming the Worker research result. A transient failure or process interruption could therefore suppress another scheduled attempt for the rest of that day.
- The scheduler now persists running, completed, skipped and failed states, avoids overlapping timer ticks, recovers a stale running attempt after 30 minutes, and retries failed work after a two-hour backoff up to three attempts per day.
- Only confirmed completion or an intentional skip closes the daily schedule. Failed outcomes are logged distinctly and remain eligible for bounded retry. Blocked operations remain available for owner review and manual retry.
- Added deterministic tests for retry timing, stale-running recovery, terminal states and the daily attempt limit. CI verification pending.


### Scheduled research recovery CI verification passed — 7 November 2026

- Backend workflow [42340061743](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42340061743) completed successfully: **34 tests passed, 0 failed**.
- New tests cover the two-hour failed-run backoff, 30-minute stale-running recovery, the three-attempt daily limit, and terminal completed/skipped states.
- Docker Compose configuration validation passed. Cloudflare Worker deployment remains skipped because the required hosted deployment settings are not available to the workflow.
- The local scheduler now distinguishes successful, skipped and failed research outcomes instead of treating every non-skipped return as success.
- Full local Docker/Ollama runtime and browser testing on the target computer remain outstanding.


### Local runtime health visibility — 7 November 2026

- The local `/health` response now reports a minimal `localRuntime` status: configured UTC research time, whether owner monitoring is enabled, today's scheduler state and attempt count.
- The health response does not include the business name, description, audience or other profile content.
- Settings > Test connection displays this operational status alongside API/provider readiness, so the owner can distinguish a working API from an enabled daily research schedule.
- Added an HTTP integration test for configured schedule, enabled monitoring, initial daily state and profile-data non-disclosure. CI verification pending.


### Local research runtime status verification passed — 7 November 2026

- Backend workflow [42340530302](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42340530302) completed successfully: **35 tests passed, 0 failed**, including the new HTTP health-status integration test.
- The test exposed a pre-existing escaped-regex defect that caused custom `RESEARCH_CRON_UTC` values to silently fall back to 14:00 UTC. Corrected the validator; the configured schedule is now reflected accurately in local runtime health.
- Local health reports only the UTC schedule, monitoring toggle, today's run state and attempt count. It does not expose business profile fields.
- Settings > Test connection displays the daily research state alongside provider readiness.
- Docker Compose configuration validation passed. Hosted Cloudflare deployment remains separate and skipped while the private deployment settings are unavailable.
- The latest website build for this change is being deployed; check its workflow before treating the PWA rollout as complete.


### Owner monitoring toggle end-to-end test — 7 November 2026

- Extended the local HTTP integration test to sign in through the real owner login endpoint, save the owner profile through authenticated `PUT /api/profile`, read it back, and confirm the unauthenticated operational health endpoint reflects monitoring as enabled.
- The test also confirms the health status contains no business name. This verifies the actual owner-setting-to-scheduler-status data path, rather than seeding the SQLite store directly.
- CI verification pending.


### Scheduled research workflow integration verification — 7 November 2026

- Exposed the local scheduler tick as a service method so automated integration tests can trigger the exact production schedule path without waiting for a timer.
- Added an end-to-end local test that invokes the real Worker scheduled handler, mocks only the SearXNG and Ollama HTTP boundaries, and verifies an enabled owner profile produces a completed daily marker plus one evidence-backed `opportunity_assessment` in `awaiting_owner`.
- The same test verifies a repeated tick does not create a duplicate operation.
- Added a failure-path test proving unavailable search creates a visible blocked Kira operation and leaves the daily scheduler marker failed rather than reporting success.
- These tests exercise the actual scheduled handler and local SQLite store. They do not prove a live external search engine or a real Ollama model is available on the owner's computer; that still requires running the installer and local stack.


### Scheduled research integration follow-up — 7 November 2026

- The first CI run exercised both success and failure paths and exposed two test assertion mismatches, plus a useful operational gap: the local scheduler's failed marker did not retain the blocked operation ID returned by Kira.
- Corrected the scheduler to preserve that operation reference, so the health/diagnostic record can be traced directly to the blocked work item. Corrected the tests to assert the actual outbound request URLs and verify the returned operation ID.
- Re-run CI before considering this workflow verified.


### Research-to-campaign handoff verification — 7 November 2026

- Added a connected API workflow test that creates a Kira research operation, attaches HTTPS evidence, advances it to owner review, and supplies its report and source URL to local Ollama campaign generation.
- The test saves the resulting three-post campaign with its originating research operation ID and retained source evidence.
- It verifies the campaign remains an unapproved draft and the publishing endpoint rejects it until explicit owner approval. It also verifies the research operation cannot be marked completed directly from owner review; the owner selection transition must be recorded first.
- This verifies the API/data contract used by the interface's “Build campaign from this” action. It is not a browser click-through test or a live model-quality test.


### Duplicate campaign-preparation protection — 7 November 2026

- Added an in-flight guard to the “Build campaign from this” action. Repeated clicks on the same research item during an active preparation now share one run instead of creating parallel draft operations and duplicate campaigns.
- The guard is released on both success and failure, so a failed preparation can be attempted again after the blocker is addressed.
- This protects concurrent clicks in the current browser session. Cross-device idempotency and recovery after a browser/process interruption remain separate hardening work.


### Research workflow and mobile release verification — 7 November 2026

- Backend workflow [42342621788](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42342621788) passed **38 tests, 0 failed**, including scheduled local research success/failure handling and the research-to-campaign API handoff with source provenance and an explicit publishing approval gate. Docker Compose configuration validation passed.
- App browser verification [42342745522](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42342745522) passed on mobile and desktop after the campaign-build concurrency guard. Kira portrait checks [42342745487](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42342745487) passed.
- Android build [42342745638](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42342745638) succeeded and published installable debug APK release [android-build-175](https://github.com/lucasmaxxinfo-sketch/marketer/releases/tag/android-build-175).
- PWA deployment [42342756618](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42342756618) succeeded.
- These checks verify the repository build and mocked integration paths. The local Docker/Ollama/SearXNG stack still needs to be installed and run on the target computer before real live research can be claimed.
- Cloudflare Worker deployment remains skipped because the GitHub Actions runner cannot access the private deployment settings; the self-hosted local backend path is separate.


### Android API-origin compatibility and connection boundary — 7 November 2026

- The Android Capacitor build serves its bundled app from the WebView origin `https://localhost`. The API previously accepted only the GitHub Pages origin, so a browser-origin policy would reject Android app requests to any hosted API.
- Added an explicit comma-separated `APP_ADDITIONAL_ORIGINS` allowlist to the shared Worker and local runtime. The local installer template now includes only the exact trusted Android origin. Tests cover native-origin health requests and preflight while continuing to reject arbitrary origins.
- Documented an important network boundary: an Android phone's `localhost` is the phone, not the user's PC. The local Docker API remains loopback-only by design, so the APK cannot connect to a PC's local backend using `http://localhost:8787`. Android must use an HTTPS-hosted API, while the hosted web app can use the local API on the same computer.
- This change prepares the API CORS contract for Android; a hosted API deployment and a real device sign-in test are still required to verify the full mobile connection.


### Hosted Worker Android origin configuration — 7 November 2026

- Added the exact Capacitor Android WebView origin `https://localhost` to the Wrangler non-secret variable configuration. This means a future successful Worker deployment will carry the same narrow origin allowlist as the local backend.
- The hosted Worker itself has not been deployed because the repository's Cloudflare credentials are still unavailable to the Actions runner. Mobile API sign-in therefore remains unverified against a live hosted backend.


## Current delivery checkpoint — 7 November 2026

This section supersedes older milestone counts and release references above where they conflict.

### Verified
- The latest GitHub Pages deployment for commit `00bc27f1324cf3eddf4b63b45077bdb453695458` completed successfully: [workflow run 42343583761](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42343583761).
- Backend validation run [42343572038](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42343572038) passed JavaScript syntax checks, all **39 automated tests** (39 passed, 0 failed), and Docker Compose configuration validation. Its test suite covers Worker rules, local SQLite runtime, installer configuration, scheduled research, research-to-campaign handoff, origin controls and owner approval boundaries.
- The Android debug APK was published in [release android-build-175](https://github.com/lucasmaxxinfo-sketch/marketer/releases/tag/android-build-175). It remains a debug-signed test build, not a production-signed release.
- The Android WebView origin `https://localhost` is explicitly allowlisted in the local installer and tracked Worker configuration.

### Still not live-verified
- The Cloudflare Worker deployment job was skipped because the GitHub Actions runner did not receive all required deployment credentials. The successful backend workflow means validation passed, not that Cloudflare was contacted.
- No live Worker health response, hosted owner login, cloud KV persistence, hosted AI response or Android sign-in against a hosted API is claimed.
- The local Docker/Ollama/SearXNG installer has not been run on the owner's computer. Hardware compatibility, first model download and a real local model response remain unverified there.
- Android cannot reach a PC's loopback-only local API through the phone's own `localhost`. The Android app needs a reachable HTTPS API endpoint for remote use.

### Latest CI verification on the current main commit
- Backend workflow [42344626272](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42344626272) completed successfully on commit `9d58f06584f9e61de1e7bc2fbc9f0280f3552df4`.
- The run passed JavaScript syntax checks, all 39 automated tests, the new Wrangler configuration check, and Docker Compose validation.
- The Wrangler check verifies the Worker name and entry point, KV binding and deployment placeholder, Android WebView origin and daily research cron.
- The frontend Pages workflow [42344626288](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42344626288) also completed successfully on the same commit.
- Cloudflare deployment was still skipped because required deployment credentials were not available to the Actions runner. The successful validation does not establish a live hosted API.


### UI diagnostics and latest Android package
- Settings **Test connection** now reports each backend capability separately and explains the difference between an unreachable API and a reachable API with missing server configuration.
- Mobile/desktop browser verification passed on commit `18db79e07242d6ebf784e3f311ec78e9d0a5b9bc`: [run 42344891933](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42344891933).
- Kira 3D portrait verification passed: [run 42344891923](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42344891923).
- Android build and release succeeded as [android-build-177](https://github.com/lucasmaxxinfo-sketch/marketer/releases/tag/android-build-177). Download: [app-debug.apk](https://github.com/lucasmaxxinfo-sketch/marketer/releases/download/android-build-177/app-debug.apk). This is still a debug-signed test build, not a production-signed app.
- The PWA containing the health-check improvements deployed successfully: [run 42344891953](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42344891953).


### Optional hosted AI deployment dependency — 7 November 2026

- Updated the Cloudflare deployment workflow so the OpenAI provider key is optional for the core Worker deployment. Owner login and session signing remain required; storage namespace and Cloudflare access remain required.
- If the OpenAI key is absent, the Worker can still deploy for authenticated workspace/storage functions, while the API health endpoint correctly reports hosted AI and OpenAI live research as unavailable. The local Ollama/SearXNG runtime is unaffected.
- Backend validation passed on commit `e41fbd8a46f3873a15b301f955dd186e5ba28949`: [run 42345594548](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42345594548). GitHub Pages deployment also passed: [run 42345594668](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42345594668).
- Cloudflare deployment remains skipped. The latest readiness logs show five core settings were not exposed to the runner: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `MG_DATA_KV_ID`, `APP_LOGIN_PASSWORD`, and `SESSION_SECRET`. The OpenAI key is no longer a blocker for core deployment.
- No live Worker deployment or hosted API capability is claimed.
