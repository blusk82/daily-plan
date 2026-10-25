# Daily Plan

A personal, phone-first web app for the day's meals, rehab exercise and shopping. It works offline once installed on the iPhone home screen. All data stays on the phone. There are no accounts, no server and no running costs.

- **Today:** a timeline of meals, exercise sessions, shopping trips and prep jobs (defrost, soak). Tap to tick. Tap ✕ to record why something didn't happen.
- **Week:** on Sunday the app proposes next week. Swap, lock or move anything, then confirm. If you don't plan, the app's default plan is used.
- **Shop / Pantry:** shopping trips built from the plan. "Use it up" items get used first. Staples never go on the list.
- **More:** appointment summary (to show your practitioners), library, settings and backup.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit + UI tests (Vitest, jsdom, fixed UTC+10 timezone)
npm run build      # production build with service worker in dist/
```

On Windows Git Bash, set `MSYS_NO_PATHCONV=1` when passing `BASE_PATH=/daily-plan/` to a local build. Otherwise Git Bash rewrites the path.

## Deploy (GitHub Pages)

The repo is public and holds **code only** plus the labelled sample library. Nothing personal is ever committed.

1. Push to `main`. `.github/workflows/deploy.yml` runs the tests, builds with `BASE_PATH=/<repo>/` and deploys.
2. One-off setup: in the repo go to **Settings → Pages → Source: GitHub Actions**.
3. On the iPhone, open `https://<user>.github.io/<repo>/` in Safari, then **Share → Add to Home Screen**. Data is only kept safely once the app is installed.

## Your library

The app ships with a **sample** library (every name starts with "Sample:"). Your real recipes, exercises, routine and balance rules come as a JSON library file (`LibraryPack`, see `src/domain/types.ts` and `src/library/schema.ts`). Import it in **More → Library → Import library file**. Importing an updated file keeps your own additions, hidden recipes and on/off settings.

## Backups

Everything lives in Safari's storage on the phone. Save a backup at the end of Sunday planning ("Confirm and save backup") to Files, iCloud Drive or OneDrive. A banner reminds you after 7 days without one. Restore it in **More → Settings**.
