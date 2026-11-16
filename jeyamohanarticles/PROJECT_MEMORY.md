# Project Memory

Last updated: 2026-11-16

## App

- Jeyamohan Articles is a Vue 3 + Vite single-page writing workspace using Vue Router and Lucide Vue icons.
- Browser storage formats and keys remain in `src/services`; the React UI, React dependencies, and Ant Design React have been removed.
- Articles, bookmarks, Home Shortcuts, highlights, profile preferences, and local publish/schedule states remain in `localStorage`; posts and images use IndexedDB with legacy `localStorage` migration/fallback. There is no backend.
- Posts created offline are saved on-device and marked sync-pending. No remote upload or automatic retry is attempted until an upload service is configured.
- The network indicator uses browser connection estimates and explicit speed-test results; browser APIs cannot read a device's cellular signal bars.
- Network quality colors are inferred from browser estimates or the manual download test: under 1 Mbps weak/blue, 1-<5 okay/red, 5-<25 good/yellow, and 25+ fast/green. Tapping the indicator opens details; the border animates while details are open or a test runs.
- On mobile, the network strip is now a compact single row (about 35 px tall); the measured Mbps result appears in a quality-colored badge beside the brand in the header.
- On the Home route, Google AI search moves below the network strip and above the Home heading on mobile; desktop keeps the search in the header. Mobile Highlights appear after the composer and before Recent Posts; desktop order is unchanged.
- The default profile display name is `Jeyamohan`. Only exact known legacy default names (including the garbled stored value) are normalized during workspace load; other profile names remain unchanged.
- Mobile non-Home routes show a back arrow beside the hamburger. It returns through Vue Router history, and replaces the route with Home when no in-app history exists. Permission prompts are not requested globally; browser permissions must be user-approved in response to a specific feature action.
- Vue state and debounced persistence are centralized in `src/stores/workspace.js`.
- The route hash continues to use familiar paths such as `#/compose` and `#/editor?article=...`.

## Verification

- `npm.cmd run lint` exits successfully with 0 errors and 55 Vue style warnings.
- `npm.cmd run build` passes.
- Browser smoke check covered article creation, autosave to the existing workspace key, local publishing, and responsive widths from 320 px to desktop; smoke-test storage was restored afterward.
- Network status panel, quality color, animated border, and mobile overflow were checked. Offline post smoke check confirmed an IndexedDB post persisted through reload and stayed marked sync-pending; temporary test data was restored.
- The compact network strip and header speed badge were verified in the mobile browser: strip height decreased from about 60 px to 35 px, the speed test showed a quality-colored Mbps badge, and no content extended beyond the viewport at tested mobile widths.
- Mobile/desktop layout checks confirmed the Google AI search and Highlights are in the intended responsive positions at 375 px and desktop width; browser storage now shows the migrated profile name `Jeyamohan`.
- Mobile back navigation was browser-tested from Profile to Home; the menu remains available and the back control is hidden on Home. Build passes and targeted ESLint reports 0 errors (8 existing Vue style warnings).
- The Vite dev server is running at `http://127.0.0.1:5173/` as requested.
- The Vite dev server is stopped; the shared browser is back on `http://127.0.0.1:5173/#/compose`.

## Next Work (User Will Provide Changes One at a Time)

- Likely follow-ups from the user's backlog: date-grouped `/posts` grid/list view, date-wise TXT/JSON exports, post-copy action, mobile navigation/search polish, accessibility duplicate cleanup, and durable composer drafts.
- Do not implement the entire backlog at once; take the next requested item, clarify scope when needed, and preserve the dirty worktree.
- Google Drive/Gmail sync and a 3 GB cloud quota need a real backend and Google OAuth configuration; none is configured. Do not claim cloud upload or automatic retry.
- A webpage cannot configure OpenDNS or device DNS. A hard-coded default password such as `1234` is not safe for a real login.
