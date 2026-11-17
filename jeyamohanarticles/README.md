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
- The app font preference (Inter, Times New Roman, Arial, or Open Sans) is saved in this browser. Inter and Open Sans are bundled locally; Tamil text uses available device/browser fonts.
- Posts created while offline are saved on this device and marked as sync pending. There is no upload server configured, so they are not sent or automatically retried to a remote service.
- The legacy writer draft (`ezhuthu-draft-v1`) remains supported and is not deleted during loading.
- Publishing and scheduling only change local article status. They do not publish or schedule work on an external service.
- SEO settings are a local preview; article text can be copied or downloaded as `.txt`.
- The External AI tools page saves its prompt in this browser. Choosing a provider opens its site and copies only that prompt; paste and send it there yourself. Posts and article drafts are not sent.
- The header shows a 24-hour local clock and browser connectivity state. Network quality is inferred from browser estimates or the manual speed test; websites cannot read the device's cellular signal bars. The speed test downloads a sample from Cloudflare; article text is not sent.

There is no backend or configured external publishing, scheduling, or analytics integration.

## Responsive layout

The interface adapts from phone widths through tablet and desktop layouts, including safe-area insets, a mobile navigation drawer, and reduced-motion preferences. Use Chrome DevTools' device toolbar to check device presets; the website cannot control Chrome's device-toolbar settings or the phone's native status bar.

The codebase uses Vue single-file components; React, Ant Design React, and their runtime packages have been removed.
