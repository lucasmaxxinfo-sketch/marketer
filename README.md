# Marketing Genius Command Centre

An installable, mobile-friendly PWA for planning, reviewing and learning from marketing campaigns.

## Current features
- Campaign drafts with three editable post ideas
- Approval queue; campaigns remain drafts until the owner approves
- Post planning schedule
- Campaign wrap-up with manually entered actuals and lessons
- JSON export for backup and archived reports
- Local device storage
- Installable PWA shell and service-worker caching

## Important limits
This first version is a local-first prototype. It does **not** yet connect to a live AI model, publish to social networks, import platform engagement analytics, or sync data between devices. Those require account integrations and a secure backend. It never claims that a post was published or that engagement numbers were imported.

## Run locally
Serve this folder over HTTP (for example, `python -m http.server 8000`) and open `http://localhost:8000`. Service workers and PWA installation require HTTPS or localhost.

## Free hosting
GitHub Pages can host the static app for free. In repository Settings → Pages, select GitHub Actions as the build/deployment source, then add a Pages workflow when ready. Data is currently stored in the browser's local storage, so use **Settings → Export all my data** to back it up.
