# Open-source and self-hosting roadmap

**Owner requirement:** Kira and the Marketing Genius Command Centre should use free/open-source software wherever practical, avoid mandatory paid subscriptions, keep data under owner control, and never incur hidden AI or hosting charges.

This is a migration plan, not a claim that the current system already meets that requirement.

## Current dependency audit

| Layer | Current implementation | Licence / cost position | Direction |
|---|---|---|---|
| Frontend | HTML, CSS and JavaScript in this repository | Original project files; repository currently has no root licence file | Preserve |
| Visual engine | Three.js 0.160.0 loaded from jsDelivr | Open-source library; exact licence notice must be included if vendored | Preserve and self-host pinned assets |
| Spreadsheet import | SheetJS CE 0.18.5 loaded from jsDelivr | Community Edition; verify exact release licence and notices before vendoring | Preserve behind an import adapter |
| Android shell | Capacitor 7 | Open-source packages; audit transitive dependencies and notices | Preserve |
| Backend | Cloudflare Worker | Proprietary hosted runtime | Replace with Node.js service |
| Database | Cloudflare KV | Proprietary hosted storage | Replace with SQLite initially; PostgreSQL if multi-user/concurrency requires it |
| Scheduler | Cloudflare Cron Trigger | Proprietary hosted scheduler | Replace with OS/systemd timer or a self-hosted scheduler process |
| AI | OpenAI Chat Completions API | Proprietary, metered | Add local model provider through Ollama or llama.cpp |
| Web research | OpenAI hosted Responses API and web_search | Proprietary, metered | Add replaceable research adapter and self-hosted search/retrieval; retain source evidence and disclose limits |
| Source control | GitHub | Hosted proprietary platform around open Git | Keep source exportable; Git itself remains portable |
| Static hosting | GitHub Pages | Hosted proprietary service with free-use conditions | Make the frontend independently hostable |
| CI/build | GitHub Actions | Hosted proprietary service with usage limits | Keep build scripts runnable locally and support self-hosted runners |
| Social publishing | Meta Graph API | Third-party proprietary platform/API | Optional integration only; cannot make Meta's platform open source |

## Target architecture

- **Application:** preserve the existing Kira-centred PWA and Capacitor Android wrapper.
- **API:** Node.js, using standard HTTP interfaces and no vendor-specific runtime bindings.
- **Storage:** SQLite for a single-owner installation; PostgreSQL when concurrent users or operational scale justify it.
- **AI runtime:** Ollama as the initial local model-serving adapter, with llama.cpp as a lower-level alternative. Both runtimes are MIT-licensed in their upstream repositories. The selected model's own licence must be checked separately; an open runtime does not make every model open source.
- **Research:** provider-neutral interface. Prefer self-hosted search and retrieval, cache dated source results, record URLs and timestamps, and never fabricate freshness or citations. External websites remain third-party sources and may restrict automated access.
- **Scheduling:** a persistent job record plus a self-hosted scheduler. Jobs need timezone-aware next-run calculation, idempotency keys, retries, failure state, audit history and a global pause switch.
- **Deployment:** Docker Compose for a repeatable self-hosted install, plus a documented bare Node.js option. The owner can run it on existing hardware; the machine must remain powered on and connected for background work.
- **Portability:** exportable database backups, documented environment variables, no dependency on proprietary KV key formats, and a replaceable AI/research provider interface.

## Migration order

1. **Inventory and licence audit.** Identify every direct/transitive package, image, font, sound, model and generated asset. Record its origin, licence and redistribution conditions. Do not add a root project licence until original ownership and third-party rights are clear.
2. **API compatibility boundary.** Extract the current API contract from the frontend and tests. Preserve routes and response shapes so the frontend does not need a disruptive rewrite.
3. **Local backend prototype.** Implement Node.js + SQLite with the existing owner authentication, campaign CRUD, operations, profile and audit semantics. Add automated parity tests before switching any user traffic. **Initial prototype implemented:** the Node HTTP server reuses the existing Worker handler through a SQLite-backed KV compatibility adapter. CI covers the shared Worker tests and local HTTP login path. The frontend has not been switched.
4. **Local AI adapter.** Add Ollama/llama.cpp support, explicit model selection, hardware checks, and a safe unavailable state. No cloud fallback unless the owner explicitly enables it. **Initial implementation delivered:** chat, channel strategy and campaign generation use Ollama's local OpenAI-compatible endpoint when `AI_PROVIDER=ollama`; tests prove no OpenAI key or Authorization header is needed. Model quality and real hardware performance still need a real-device check.
5. **Research adapter.** Replace the OpenAI hosted search dependency with a self-hosted or owner-selected search provider. Maintain source URLs, timestamps, relevance notes and evidence validation. Clearly state that self-hosting software does not guarantee free access to external search engines.
6. **Scheduler.** Move the daily scan to the local job runner. Add timezone-aware schedule configuration and test restart recovery, duplicate prevention, retries and pause/resume.
7. **Deployment and backup.** Provide Docker Compose, local setup, backup/restore and update instructions. **Initial packaging implemented:** Dockerfile, localhost-only Compose service, environment template, SQLite online backup utility and backup integrity test. A separate-machine clean install and restore drill remain outstanding.
8. **Cutover.** Export existing cloud records, import and reconcile them locally, run both systems read-only for comparison, then switch only after parity and recovery checks pass. Keep a rollback path.
9. **Retire proprietary runtime.** Remove Cloudflare-specific code only after the local replacement is proven and the owner has confirmed data migration.

## Non-negotiable safeguards

- No secrets in source control, browser code, logs or this document.
- No hidden paid API fallback or metered AI calls.
- No public publishing, paid spend or external consequential action without owner approval.
- Local model licence, usage restrictions and hardware requirements must be checked individually.
- Third-party platform APIs remain third-party dependencies even if the connector code is open source.
- Open source does not mean zero operating cost: hardware, power, internet, domain registration, backups and optional external services can still cost money.
- Never represent the product as fully open source until the licence and asset audit is complete.

## Initial technology references

- [Ollama source and MIT licence](https://github.com/ollama/ollama)
- [llama.cpp source](https://github.com/ggml-org/llama.cpp)
- [PostgreSQL licence](https://www.postgresql.org/about/licence/)
- [Capacitor source](https://github.com/ionic-team/capacitor)

## Current status

**Planning and source audit:** recorded 7 November 2026.

**Implemented prototype:** Node.js 24 API wrapper, SQLite-backed storage adapter, local daily scheduler, Dockerfile, Docker Compose, local environment template, SQLite backup utility and CI tests. **Not yet implemented:** frontend cutover, local AI runtime, self-hosted research replacement, full dependency/asset licence inventory, clean-install/restore drill, root project licence.

**Current production reality:** frontend remains hosted on GitHub Pages; the production backend source still targets Cloudflare Workers/KV and OpenAI; its deployment has not been verified. The local Node/SQLite runtime is an additional tested prototype, not yet the production backend or a complete open-source solution. The current scheduled research implementation is present in source but not proven live.


## Prototype delivery update — 7 November 2026

The first local backend prototype is now in the repository at `backend/local/`. It wraps the existing API handler rather than duplicating the business logic, and SQLite stores the same KV-style records. A Docker Compose service is provided, bound to localhost by default. Local credentials and database files are excluded through repository and Docker ignore files. A SQLite online backup command verifies integrity.

The initial compatibility and owner-login tests passed in CI. The expanded backup test is included in the latest workflow run and must be checked before calling the complete suite green. The frontend is still not connected to this runtime, and hosted OpenAI/Meta integrations remain optional proprietary dependencies.


**Latest AI-adapter verification:** API workflow [42334078025](https://github.com/lucasmaxxinfo-sketch/marketer/actions/runs/42334078025) passed all 24 tests, including two new tests that exercise local Ollama chat and campaign generation without a hosted API key. The HTTP provider was mocked in CI; a real Ollama model runtime and quality evaluation are still outstanding.
