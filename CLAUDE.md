# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**TabTint** — a Manifest V2 browser extension (Firefox + Chrome) that decorates whitelisted tabs with a colored border, title overlay, and favicon badge. Built on `webextension-polyfill` so `browser.*` works in both browsers.

## Commands

- `yarn install` — install `webextension-polyfill` (the only runtime dep; it is loaded directly from `node_modules/` via `manifest.json`, so `node_modules` must exist at runtime, not just at build time).
- Firefox manual load: `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on* → pick `manifest.json`.
- Chrome manual load: `chrome://extensions` → enable *Developer mode* → *Load unpacked* → pick repo root.

No build step, no bundler, no test runner, no linter configured. `package.json`'s `test` script is a placeholder.

## Architecture

Three extension contexts coordinate through `browser.storage.local`, which is the single source of truth. All three load `src/shared/utils.js` first (see `manifest.json`) so they share pattern-matching helpers and `DEFAULT_COLOR`.

### Contexts
- **`src/background/background.js`** — long-lived. Seeds defaults on install, handles `GET_SETTINGS` / `SET_DOMAIN_DEFAULTS` / `SET_TAB_SETTINGS` messages, and garbage-collects per-tab entries on `tabs.onRemoved`.
- **`src/content/content.js`** — injected into every page at `document_end`. Owns DOM injection of the overlay (`#tabtint-overlay`), border frame (`#tabtint-border-frame`), and favicon badge (`#tabtint-favicon` link, original favicons disabled by swapping their `rel` to `tabtint-disabled-icon`). Reacts to `storage.onChanged` for live updates without reload.
- **`src/popup/popup.{html,css,js}`** — the browser-action UI. Reads storage directly on open, sends messages for per-tab/per-domain writes, and manages the whitelist.

### Settings resolution (precedence)
For a given tab, the effective `{title, color}` is resolved as:
1. `tabSettings[tabId]` — per-tab override (ephemeral; cleared on tab close).
2. `domainDefaults[hostname]` — exact host match.
3. `domainDefaults[pattern]` — wildcard pattern match (only patterns containing `*`; see `findMatchingPattern`).
4. Global `overlayTitle` / `DEFAULT_COLOR`.

`resolveDomainDefaults` in `src/shared/utils.js` implements steps 2–3 and mixes exact + pattern results (exact wins field-by-field).

### Whitelist gating
The content script is injected everywhere (`<all_urls>`) but is inert on non-whitelisted hosts. `syncVisibility` checks `isWhitelisted(whitelist, hostname)` before mounting anything. Patterns use `*` as a single-label wildcard (e.g. `*.example.com`) — compiled to regex in `matchesPattern` with a module-level cache.

### Storage keys (in `browser.storage.local`)
`enabled`, `showTitle`, `showBorder`, `overlayTitle`, `domainDefaults` (`{host → {color, title}}`), `tabSettings` (`{tabId → {color, title}}`), `whitelist` (array of host patterns). Defaults are written once in `onInstalled`.

### Favicon badge
`applyFaviconBadge` draws the current border color as a rounded background behind a shrunken copy of the page's favicon on a canvas, then swaps the page's favicon links out (preserving their original `rel` in `data-tabtint-rel` for restoration). CORS-tainted favicons fall back to a color-only icon. A `MutationObserver` on `<head>` re-applies the badge when SPAs swap favicons.

### Live-update flow
`popup.js` writes to storage → `storage.onChanged` fires in every content script → each script diffs `changes.*` and re-resolves precedence. The content script also handles the case where a domain *becomes* whitelisted mid-session by re-fetching settings via `GET_SETTINGS`.

## Gotchas

- Manifest V2 only — do not migrate to MV3 without discussion; `background.scripts` and `browser_action` would both need to change.
- `src/shared/utils.js` is loaded as a plain script (not a module), so its top-level `const`s become globals in each context. Avoid renaming them without updating all three entry points.
- The polyfill path `node_modules/webextension-polyfill/dist/browser-polyfill.min.js` is referenced verbatim from `manifest.json`; `node_modules/` ships with the extension.
