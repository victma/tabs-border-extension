# Corner Text — Firefox Extension Boilerplate

Displays a configurable text overlay in the top-right corner of every page.
Built with [`webextension-polyfill`](https://github.com/mozilla/webextension-polyfill) for Firefox/Chrome compatibility.

## Project structure

```
.
├── manifest.json
├── icons/
│   ├── icon-48.png
│   └── icon-96.png
├── src/
│   ├── background/
│   │   └── background.js   ← persistent logic, storage defaults
│   ├── content/
│   │   ├── content.js      ← DOM injection, reacts to storage changes
│   │   └── content.css     ← overlay styles
│   └── popup/
│       ├── popup.html
│       ├── popup.css
│       └── popup.js        ← reads/writes browser.storage.local
└── node_modules/
    └── webextension-polyfill/
```

## Setup

```bash
npm install
```

## Load in Firefox (temporary)

1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `manifest.json`

## Load in Chrome

Same polyfill works — Chrome uses MV2 the same way.

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select this folder

## Dev tips

- Use [`web-ext`](https://github.com/mozilla/web-ext) for live-reloading:
  ```bash
  npx web-ext run
  ```
- Inspect the background script via **Inspect** in `about:debugging`
- `browser.storage.onChanged` fires in the content script immediately when you save from the popup — no page reload needed

## Customise

| What | Where |
|---|---|
| Overlay text & position | `src/content/content.css` |
| Default text | `src/background/background.js` → `onInstalled` |
| Permissions | `manifest.json` → `permissions` |
| Popup UI | `src/popup/` |
