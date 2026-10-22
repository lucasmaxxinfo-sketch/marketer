# Marketing Genius — Product Build Brief

## Purpose
Build a real, mobile-first marketing workbench for four businesses. The marketing doctrine is the decision engine; this application is the usable tool, not merely a prompt library.

## Businesses
1. Retroscore — Christchurch, New Zealand; retro collectibles, gifts, memorabilia and 1980s/1990s nostalgia.
2. GO!VCR — New Zealand VCR/VHS and retro-video equipment, accessories, parts, servicing and repairs. Christchurch pickup and NZ shipping where confirmed. Applicable listings may use the established 30-Day Repair / Replace / Refund Guarantee. Remotes are included only when explicitly stated.
3. GO!VCR PropSup — props/hire offering for authentic retro equipment and objects. Never invent inventory, hire prices, availability or terms.
4. Terilliom Developments — technology, AI-assisted systems, automation, integrations and practical business solutions. Market confirmed outcomes, not unverified capabilities.

Keep each business's identity, facts, assets, products, offers and campaigns separate.

## Core marketing doctrine
- Every asset answers: What is it? Why should the audience care? What should they do?
- One dominant message, clear hierarchy, legible mobile-first design, deliberate whitespace and minimal clutter.
- No fake urgency, unsupported claims, invented business details or generic AI visual clichés.
- Critique before finalising. Proofread all copy and validate business/product/price details.
- Human owner has final approval. The agent recommends and drafts; it does not publish or spend money without explicit authorisation.
- If facts are missing, show a clear “Needs confirmation” status rather than guessing.

## Primary app navigation
1. Dashboard — recent work, drafts needing review, campaign status and quick actions.
2. Business switcher — select one of the four businesses; active business is visible on every work screen.
3. Create — guided creation for social posts, ads, product marketing, posters/graphics, video scripts, emails, listing copy and campaigns.
4. Campaigns — create, edit, duplicate, organise, and track draft/review/approved/completed status.
5. Brand & Sources — business facts, brand voice, logos, reference documents and source links, grouped by business.
6. Product/Service Library — structured entries for products, services or props, with price/status/claims fields and linked photos.
7. Creative Studio — briefs and image-generation workflow, with preview and revision history where supported.
8. Quality Check — objective, audience, message, CTA, spelling, legibility, brand fit, factual accuracy and mobile-readability checklist.
9. Settings — export/backup, data controls, model/provider configuration and privacy.

## Main workflow
Choose business → choose objective → enter or select product/service → create brief → generate strategy/copy/creative → run quality checks → revise → save as draft → owner approves → export/download. No automatic public posting or ad spend by default.

## MVP functional requirements
- Responsive, accessible phone-first UI.
- Persistent saved campaigns and drafts, not just temporary on-screen examples.
- Create/read/update/delete for campaigns and business knowledge.
- Four isolated business profiles and a visible active-business context.
- Search/filter saved campaigns and library items.
- Image upload and asset association, with clear file-size/type errors.
- Export copy to clipboard and download/share supported assets.
- Source/fact provenance and confirmation flags for uncertain information.
- Quality-check report with actionable corrections.
- Loading, empty, success, and error states for every major action.
- Demo/sample content clearly labelled as sample, never presented as real business data.
- Secrets/API keys must never be embedded in client-side code.
- Use free/open-source components where practical; do not imply AI generation works without a configured provider/API.

## Design direction
Professional creative workbench, uncluttered and touch-friendly. Clear typography, strong contrast, restrained colour, generous whitespace and useful visual hierarchy. Avoid a generic SaaS dashboard full of decorative cards. Design should feel like a practical marketing studio.

## Technical delivery and verification
- Preserve existing working code and repository history; inspect before changing.
- Use GitHub as the source of truth and commit changes with descriptive messages.
- Build on the existing stack unless a demonstrated blocker requires change.
- Add automated checks/build workflow where practical.
- Run available tests and production build; fix failures rather than merely describing them.
- Document setup, environment variables, deployment and known limitations.
- Report only verified capabilities as complete. A preview is not proof that persistence, AI calls, uploads or export work.
- APK is not the first deliverable unless the existing architecture supports it cleanly. Prioritise a working mobile web app/PWA, then package Android if feasible.

## Acceptance criteria
A new user can open the app on a phone, select any of the four businesses, create and save a campaign draft, reopen and edit it, run the quality checklist, export its copy, and see business-specific facts without cross-contamination. Errors are understandable. The app does not fabricate successful AI generation or data saving.
