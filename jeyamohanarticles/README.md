# Jeyamohan Articles

Vue 3 + Vite writing workspace with Vue Router and Lucide Vue icons.

## Start

```sh
npm.cmd run dev
```

## Checks

```sh
npm.cmd run lint
npm.cmd run build
```

## Local-only behavior

- Profiles, drafts, bookmarks, Home Shortcuts, highlights, article status, SEO fields, and scheduled times are stored in this browser's `localStorage`. Posts and attached images use IndexedDB, with legacy `localStorage` migration and fallback.
- Article edits and profile fields are saved to browser storage immediately as you type; unfinished post text is also saved on each keystroke and restored when the post composer is reopened after a refresh.
- On startup, the app requests persistent browser storage where supported and shows whether the browser granted protection from automatic storage cleanup. Data remains local to this browser/device; browser resets, clearing site data, uninstalling the browser, device loss, and unsupported browsers can still result in data loss. Download backups and keep them elsewhere.
- Profile settings show the browser's estimated origin storage usage, quota, and remaining capacity where the Storage API is supported. These estimates are browser-controlled and are not a reserved 3,487 MB backup quota.
- The Backup page exports articles, posts/images, highlights, bookmarks, drafts, and saved preferences into date-organized ZIP parts under 387 MB each. Restore merges new IDs and leaves existing content intact. Multiple posts can be selected and downloaded as a ZIP; ZIP backups and individual TXT/image files can be imported, with standalone files added to Home as posts.
- The Article Editor's focus mode hides navigation and status chrome, widens the writing area, and saves its on/off preference in this browser.
- Backup downloads are local and manual: upload the downloaded ZIP to Google Drive yourself. The website has no backend or Drive integration. Browser storage nearing its reported quota is flagged on the Backup page; the estimate is not a guarantee of how much data can be saved.
- Action groups place secondary actions on the left and the main action(s) on the right; app notifications appear centered near the top of the screen. Post creation shows a 3-second preparation phase, a minimum 1-second save phase, and a confirmation at about 5 seconds after submission, after local storage succeeds.
- The app font preference (Inter, Times New Roman, Arial, or Open Sans) is saved in this browser. Inter and Open Sans are bundled locally; Tamil text uses available device/browser fonts.
- Posts created while offline are saved on this device and marked as sync pending. There is no upload server configured, so they are not sent or automatically retried to a remote service.
- The legacy writer draft (`ezhuthu-draft-v1`) remains supported and is not deleted during loading.
- Publishing and scheduling only change local article status. They do not publish or schedule work on an external service.
- SEO settings are a local preview; article text can be copied or downloaded as `.txt`.
- The External AI tools page saves its prompt in this browser. Choosing a provider opens its site and copies only that prompt; paste and send it there yourself. Posts and article drafts are not sent.
- The Google AI search prompt is autosaved locally and cleared only after the browser reports that copy/open succeeded. Provider pages are cross-origin, so the app cannot safely type or submit prompts inside them; paste the copied prompt manually.
- The header shows a 24-hour local clock and browser connectivity state. Network quality is inferred from browser estimates or the manual speed test; websites cannot read the device's cellular signal bars. The speed test downloads a sample from Cloudflare; article text is not sent.

There is no backend or configured external publishing, scheduling, or analytics integration.

## Responsive layout

The interface adapts from phone widths through tablet and desktop layouts, including safe-area insets, a mobile navigation drawer, and reduced-motion preferences. Use Chrome DevTools' device toolbar to check device presets; the website cannot control Chrome's device-toolbar settings or the phone's native status bar.

The codebase uses Vue single-file components; React, Ant Design React, and their runtime packages have been removed.
