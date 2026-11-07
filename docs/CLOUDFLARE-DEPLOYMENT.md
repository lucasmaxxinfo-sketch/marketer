# Cloudflare Worker deployment

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

The Worker health endpoint reports whether any business has daily monitoring enabled, the configured UTC scan time, today's aggregate scan state, attempt count and per-business completion/failure counts. It does not disclose business names or profile data. Daily status distinguishes `waiting`, `running`, `completed`, `partial`, `failed`, `missed`, `unavailable` and `disabled`. A run is marked `missed` when no business has started within 30 minutes after the configured UTC scan time; incomplete runs are marked `partial` after that grace period. The schedule is configured in both the Cloudflare cron trigger and the `RESEARCH_CRON_UTC` variable; keep them aligned.

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
