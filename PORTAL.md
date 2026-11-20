# Hosting OPT/IN in the Caldwell CTE student portal

The student portal (the `cte-hub` repo) hosts this game for signed-in school accounts. It copies the files
listed in `portal.json`, byte for byte, at a commit you choose (`/update-game opt-in` in cte-hub). Nothing is
patched on the way in, so what is in this repo is what students play.

- **What gets served:** `index.html` and `fonts/`. The test pages and scripts (`?check`, `?bots`, `?ui`,
  `?decisions`, `TESTING.md`, `tools/`) stay here and are not copied.
- **Nothing may load from other sites.** The portal blocks it to protect students (no trackers, no CDNs, no
  Google Fonts). Fonts are self-hosted in `fonts/`. If you add or change a font, regenerate them with
  `node tools/localize-fonts.mjs .` (needs internet; it saves the Google Fonts files next to the game).
- **The leaderboard and class model are kept by the portal**, at `../../api/opt-in/board`
  (code: cte-hub `apps/portal/lib/optin-board.js`). The portal checks that you're signed in, applies each change
  itself, and sends back the board. Outside the portal that address doesn't exist, the request fails, and the game
  runs on this device's own copy ("CACHED · OFFLINE"), so opening `index.html` on its own still works.
- **If you add a field to a leaderboard row** (`filed` in `index.html`), add it to `sanitizeEntry` in the portal's
  `lib/optin-board.js` too, or the portal will drop it.
- **Try it with the real board before you push:** in cte-hub, `cd apps/portal`, then
  `GAMES_DIR=/folder/that/holds/this/repo/as/opt-in npm run dev`, and open http://localhost:3001/games/opt-in/.
- **After you push here,** run `/update-game opt-in` in cte-hub, then `/ship`.
