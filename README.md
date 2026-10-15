# Marketing Genius Command Centre

An installable, mobile-friendly PWA for planning, reviewing and learning from marketing campaigns.

## Current PWA features
- Campaign drafts with three editable post ideas
- Owner approval queue and campaign review/editing
- Post planning schedule
- Campaign wrap-up with manually entered results and lessons
- JSON export for backup and archived reports
- Local device storage
- Installable PWA shell and service-worker caching

## Backend foundation added
The `backend/` folder now contains a Cloudflare Worker API foundation for server-side AI campaign generation, campaign persistence endpoints, guarded Facebook/Instagram publishing endpoints, and Facebook insights retrieval. See [`backend/SETUP.md`](backend/SETUP.md) for deployment and credential requirements.

**This does not mean the complete product is live yet.** The Worker has not been deployed or connected to the PWA. The current PWA remains local-first and does not yet use those endpoints, provide secure end-user login, automatically publish scheduled posts, or sync data across devices. Social publishing and analytics depend on valid platform credentials, permissions and sometimes platform app review. The app must never claim publication or imported metrics unless the provider confirms success.

## Run the PWA locally
Serve this folder over HTTP (for example, `python -m http.server 8000`) and open `http://localhost:8000`. Service workers and PWA installation require HTTPS or localhost.

## Hosting
GitHub Pages hosts the static PWA. The API is a separate Cloudflare Worker and needs its own deployment, KV namespace and secrets. Never place AI or social-platform secrets in static frontend files. Until cloud sync is implemented, campaign data is stored in the browser, so use **Settings → Export all my data** for backup.
