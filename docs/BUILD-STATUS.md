# Marketing Genius Command Centre — Build Status

**Audit date:** 6 November 2026  
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
6. **No automatic timed publishing.** The backend setup explicitly says date-only scheduling does not contain a safe posting time and the Worker has no cron triggers configured. The current schedule is a planning view, not an autonomous publishing scheduler.
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
