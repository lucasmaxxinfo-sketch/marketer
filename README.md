# Marketing Genius Command Centre

An installable, mobile-friendly marketing workspace for planning, reviewing and learning from campaigns.

## In the app
- Campaign drafts, owner review and an approval queue
- Editable post copy and planning schedule
- Campaign wrap-up, expected-versus-actual notes and archived reports
- Local-device storage and JSON backup
- Optional connection controls for a secure live AI workspace

## Android app
An Android build is now configured to build automatically from the project. When the build succeeds, the installable APK will be published under [GitHub Releases](https://github.com/lucasmaxxinfo-sketch/marketer/releases).

These are debug-signed test builds, not yet a store-ready signed release. Android may ask you to approve installing an app from your browser. Only install it on a device you control.

## Deployment status
The GitHub Pages PWA is deployed. Its current local campaign workflow remains usable without an API. The secure Cloudflare Worker API includes owner-password sign-in, short-lived signed sessions, server-side AI generation, campaign persistence, approval-checked Facebook/Instagram publishing endpoints and a Facebook insights endpoint.

**The complete connected product is not live yet.** The Worker still needs a Cloudflare deployment, server secrets and a KV namespace, then the deployed API address must be entered in Settings. Meta publishing and analytics additionally require a properly configured Meta app, eligible account permissions and valid credentials. Automatic timed publishing is disabled until a safe post time and reliable scheduling job are implemented. The app must never claim publication or imported metrics unless the provider confirms them.

## Public app
https://lucasmaxxinfo-sketch.github.io/marketer/

## Deploying the API
See [backend/SETUP.md](backend/SETUP.md). The manual GitHub Actions workflow named **Deploy Marketing Genius API** expects these repository secrets:
- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID
- MG_DATA_KV_ID
- APP_LOGIN_PASSWORD
- SESSION_SECRET
- OPENAI_API_KEY

The Worker workflow deploys only when manually triggered. Meta publishing secrets can be added separately after the Meta app and account are ready. Never place server secrets in static frontend files.

## Local preview
Serve this folder over HTTP, for example with `python -m http.server 8000`, then open `http://localhost:8000`. PWA installation requires HTTPS or localhost.
