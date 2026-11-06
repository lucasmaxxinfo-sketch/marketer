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
10. **Automated tests are limited.** The Pages workflow checks JavaScript syntax. The Android workflow validates metadata and syntax before building. No end-to-end application or publishing integration tests were found in the inspected workflow definitions.

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
