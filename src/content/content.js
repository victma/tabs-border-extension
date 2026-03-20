// content.js
// Injected into every page. Has access to the page DOM but limited browser.* API.
// Communicates with background.js via browser.runtime.sendMessage.

const OVERLAY_ID = "tabtint-overlay";
const FRAME_ID = "tabtint-border-frame";

// The current configured title. Empty/undefined means "use tab title".
let configuredTitle = "";

const DEFAULT_BORDER_COLOR = "#a21c1c";
let borderColor = DEFAULT_BORDER_COLOR;

// Set by the background script so we can look up per-tab settings
let tabId = null;
let showTitle = true;
let showBorder = true;

function getDisplayTitle() {
  return configuredTitle || document.title;
}

function ensureOverlay() {
  if (document.getElementById(OVERLAY_ID)) return;
  const el = document.createElement("div");
  el.id = OVERLAY_ID;
  el.textContent = getDisplayTitle();
  el.style.borderColor = borderColor;
  document.body.appendChild(el);
}

function ensureFrame() {
  if (document.getElementById(FRAME_ID)) return;
  const frame = document.createElement("div");
  frame.id = FRAME_ID;
  frame.style.borderColor = borderColor;
  document.body.appendChild(frame);
}

function updateOverlay() {
  const el = document.getElementById(OVERLAY_ID);
  if (el) el.textContent = getDisplayTitle();
}

function syncVisibility(enabled) {
  if (enabled && showTitle) ensureOverlay();
  else document.getElementById(OVERLAY_ID)?.remove();

  if (enabled && showBorder) ensureFrame();
  else document.getElementById(FRAME_ID)?.remove();
}

// Watch for title changes (SPAs, dynamic pages) — only matters when using the default
const titleEl = document.querySelector("title");
if (titleEl) {
  new MutationObserver(() => {
    if (!configuredTitle) updateOverlay();
  }).observe(titleEl, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}

// Fetch settings and initialise
browser.runtime.sendMessage({ type: "GET_SETTINGS" }).then((settings) => {
  configuredTitle = settings?.overlayTitle ?? "";
  borderColor = settings?.borderColor || DEFAULT_BORDER_COLOR;
  tabId = settings?.tabId ?? null;
  showTitle = settings?.showTitle !== false;
  showBorder = settings?.showBorder !== false;
  syncVisibility(settings?.enabled !== false);
});

function applyBorderColor(color) {
  borderColor = color || DEFAULT_BORDER_COLOR;
  const el = document.getElementById(OVERLAY_ID);
  if (el) el.style.borderColor = borderColor;
  const frame = document.getElementById(FRAME_ID);
  if (frame) frame.style.borderColor = borderColor;
}

// React to storage changes in real time
browser.storage.onChanged.addListener((changes) => {
  if (changes.tabSettings && tabId != null) {
    const newEntry = (changes.tabSettings.newValue || {})[tabId] || {};
    const oldEntry = (changes.tabSettings.oldValue || {})[tabId] || {};
    if (newEntry.title !== oldEntry.title) {
      configuredTitle = newEntry.title || "";
      updateOverlay();
    }
    if (newEntry.color !== oldEntry.color) {
      applyBorderColor(newEntry.color);
    }
  } else {
    // Global defaults changed — apply only if this tab has no per-tab override
    if (changes.overlayTitle || changes.borderColor) {
      browser.storage.local.get("tabSettings").then(({ tabSettings = {} }) => {
        const perTab = tabSettings[tabId] || {};
        if (changes.overlayTitle && !perTab.title) {
          configuredTitle = changes.overlayTitle.newValue ?? "";
          updateOverlay();
        }
        if (changes.borderColor && !perTab.color) {
          applyBorderColor(changes.borderColor.newValue);
        }
      });
    }
  }

  let needSync = false;
  if (changes.showTitle) { showTitle = changes.showTitle.newValue !== false; needSync = true; }
  if (changes.showBorder) { showBorder = changes.showBorder.newValue !== false; needSync = true; }
  if (changes.enabled || needSync) {
    browser.storage.local.get("enabled").then(({ enabled }) => {
      syncVisibility(enabled !== false);
    });
  }
});
