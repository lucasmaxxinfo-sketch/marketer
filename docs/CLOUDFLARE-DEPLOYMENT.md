# Cloudflare Worker deployment

> **Legacy / optional deployment path.** Cloudflare is no longer required or used by the normal backend deployment. The recommended production runtime is the open-source self-hosted Docker stack (Node.js, SQLite, Ollama, SearXNG and Caddy). Start with [Self-hosted deployment](SELF-HOSTED-DEPLOYMENT.md). This page is retained only for existing installations that deliberately choose Cloudflare.

The repository's backend deployment uses Cloudflare's open-source Wrangler CLI directly. It does not use the Wrangler GitHub Action wrapper.

## Required GitHub configuration

Open the repository's Settings → Secrets and variables → Actions.

Create these **repository secrets**:

- `CLOUDFLARE_API_TOKEN`: Cloudflare account API token. Use Cloudflare's **Edit Cloudflare Workers** token template and restrict it to the account hosting this Worker.
- `APP_LOGIN_PASSWORD`: owner login password for the Marketing Genius API.
- `SESSION_SECRET`: long random signing secret. Generate a new value; do not reuse the owner password.

Create these **repository variables**:

- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID.
- `MG_DATA_KV_ID`: ID of the existing KV namespace bound as `MG_DATA`.

The account ID and KV namespace ID are identifiers, not authentication secrets. They may be stored as repository variables. They can also be stored as secrets if preferred.

Optional repository secrets:

- `OPENAI_API_KEY`: enables hosted AI and OpenAI live research.
- `META_PAGE_ID`, `META_PAGE_ACCESS_TOKEN`, `META_INSTAGRAM_ACCOUNT_ID`: enable the corresponding Meta publishing integrations when the account permissions are correct.

Never put secret values in source files, commit history, issue comments, or chat messages.

## Deploy

After adding the required values, run the **Backend checks and Cloudflare Wrangler deployment** workflow using Actions → select the workflow → Run workflow. The same workflow also runs when backend code or its workflow changes on main.

The Worker health endpoint reports whether any business has daily monitoring enabled, the configured UTC scan time, today's aggregate scan state, attempt count and per-business completion/failure counts. It does not disclose business names or profile data. Daily status distinguishes `waiting`, `running`, `completed`, `partial`, `failed`, `missed`, `stalled`, `unavailable` and `disabled`. A research scan is marked `stalled` when a business remains in `running` for more than 30 minutes; a retry records a fresh start time. A run is marked `missed` when no business has started within 30 minutes after the configured UTC scan time; incomplete runs are marked `partial` after that grace period. The same endpoint also reports Kira's daily campaign-learning state (`dailyLearning`), including whether learning is enabled, waiting, running, completed, failed, missed, stalled or unavailable, plus aggregate campaign counts. A run is marked `stalled` when it remains in progress for more than 30 minutes.
Kira also maintains a per-business `business-learning:<businessId>` memory containing up to 30 recent evidence-backed Facebook campaign lessons. Only medium- and high-confidence analyses are persisted. Each entry retains its source, review time, campaign, measured metrics and observed recommendations; lessons are never shared across business workspaces. The memory is supplied to later autonomous campaign decisions and draft generation. The signed-in owner can inspect the active business's verified lessons in Results & Archive through the read-only `/api/learning` endpoint. The endpoint is business-scoped and does not expose another workspace's memory. Owner-entered reports remain separately labelled as unverified context and are not promoted into verified platform evidence.
 It does not disclose campaign or business names. Learning runs alongside scheduled research and analyses supported, published Facebook campaign posts when Meta Insights and AI are configured. Owner-entered campaign reports remain available as lower-confidence directional lessons for future campaign decisions. The schedule is configured in both the Cloudflare cron trigger and the `RESEARCH_CRON_UTC` variable; keep them aligned. When research returns usable sources, Kira also runs a campaign-suitability check. Strong opportunities with configured marketing platforms are converted into three-post campaign drafts in the correct business workspace. These drafts remain pending owner approval; the scheduled task never approves or publishes them. Weak research, missing platform configuration or campaign-generation failures leave the research report available for owner review without forcing a draft.

The workflow validates the backend, installs Wrangler, injects the KV namespace ID into a temporary copy of the deployment config, creates a temporary secrets file on the runner, and runs:

```bash
wrangler deploy --config wrangler.toml --secrets-file .wrangler-secrets.json
```

The temporary secrets file is deleted when the deployment step exits. It is not committed.

## Alternative: Cloudflare-managed GitHub Builds

If GitHub Actions secrets remain inaccessible, Cloudflare's first-party Workers GitHub integration can own the build and deployment connection instead. Connect the repository from Cloudflare Workers & Pages, select the `main` branch, set the Worker build root to `backend`, and configure its build command to run Wrangler. Configure Worker secrets in the Cloudflare dashboard under the Worker → Settings → Variables and Secrets. The KV namespace ID must still be the real namespace ID in `backend/wrangler.toml`; the tracked placeholder is not deployable.

This route requires an owner to authorize the Cloudflare Workers & Pages GitHub App and select the repository in Cloudflare. It does not require putting the Cloudflare API token into GitHub Actions. See [Cloudflare GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/).

## Current observed blocker

The direct Wrangler workflow is committed and its backend validation passes. Its deployment job currently receives empty values for all five required deployment settings:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `MG_DATA_KV_ID`
- `APP_LOGIN_PASSWORD`
- `SESSION_SECRET`

The workflow therefore stops before installing Wrangler or contacting Cloudflare. This is a credentials/configuration availability problem, not a Wrangler runtime failure. A Worker deployment and live `/health` check are still required before the hosted API can be called live.
