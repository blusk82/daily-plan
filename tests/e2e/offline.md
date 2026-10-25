# iPhone check (manual, after first deploy)

Do these once on the phone after installing from Safari.

1. Open the Pages URL in Safari → Share → **Add to Home Screen**. Open the app from the home-screen icon. It should open full-screen, with no Safari bars.
2. Finish setup (calorie target, shop day, times) → **Start**. Today shows a timeline.
3. Tick breakfast, then un-tick it. ✕ on an exercise → tap a pain number, an area, then **Pain**. The row says "Not done · Pain · pain N".
4. Turn on **Airplane mode**. Close the app fully (swipe it away) and reopen it. Everything still loads and ticks still save.
5. Week → Plan next week → Make my week → Looks good → **Confirm and save backup**. The share sheet opens; save to Files. Check the `.json` file is there.
6. Turn Airplane mode off.
7. Check the home indicator doesn't cover the tab bar, and that Today's header clears the notch or Dynamic Island.

Already verified on the desktop (25 Oct 2026): the service worker installs at `/daily-plan/`. With the server stopped, the app reloads, completes setup, generates a plan and shows Today, with nothing from the network.
