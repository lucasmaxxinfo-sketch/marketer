# Marketing Genius

A playful, phone-friendly marketing studio for four separate businesses. Create campaign drafts, review and edit copy, plan dates, and keep saved work in one place.

## Open the app
https://lucasmaxxinfo-sketch.github.io/marketer/

## Built-in feel
- Positive, fun creative direction
- Persistent animated galaxy starfield with rotating orbit ribbons
- Kira's seated portrait in a pink suit and green blouse
- Voice-command navigation and faster spoken replies; full voice conversation uses the optional authenticated AI Worker
- Optional sound and little chimes (off until enabled)
- Mobile-friendly layout
- Local draft storage
- Owner approval before publishing

## Important
Campaign drafts can be created locally without a live AI service. AI generation, conversational voice, cloud sync and social publishing require their respective services and credentials to be configured. The dashboard's **Let Kira work** action can create a local approval-ready draft from saved business settings and imported stock when live AI is not connected. The app must not claim a post or integration is live unless confirmed.

## Android
The repository includes an Android build workflow. Check the GitHub Actions run and Releases page for a successful build before installing an APK. Test builds may require Android to allow installation from the chosen source.

## Development
The static app is deployed with GitHub Pages. Frontend syntax and backend syntax checks run in GitHub Actions. See `backend/SETUP.md` only if configuring the optional live API.
