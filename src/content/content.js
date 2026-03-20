// content.js
// Injected into every page. Has access to the page DOM but limited browser.* API.
// Communicates with background.js via browser.runtime.sendMessage.

const OVERLAY_ID = "corner-text-overlay";
const FRAME_ID = "viewport-border-frame";

// The current configured text. Empty/undefined means "use tab title".
let configuredText = "";

const DEFAULT_BORDER_COLOR = "#a21c1c";
let borderColor = DEFAULT_BORDER_COLOR;

// Set by the background script so we can look up per-tab colors
let tabId = null;

function getDisplayText() {
  return configuredText || document.title;
}

function createFrame() {
  if (document.getElementById(FRAME_ID)) return;

  const frame = document.createElement("div");
  frame.id = FRAME_ID;
  frame.style.borderColor = borderColor;
  document.body.appendChild(frame);
}

function removeFrame() {
  document.getElementById(FRAME_ID)?.remove();
}

function createOverlay() {
  if (document.getElementById(OVERLAY_ID)) return;

  const el = document.createElement("div");
  el.id = OVERLAY_ID;
  el.textContent = getDisplayText();
  el.style.borderColor = borderColor;
  document.body.appendChild(el);
  createFrame();
}

function removeOverlay() {
  document.getElementById(OVERLAY_ID)?.remove();
  removeFrame();
}

function updateOverlay() {
  const el = document.getElementById(OVERLAY_ID);
  if (el) el.textContent = getDisplayText();
}

// Watch for title changes (SPAs, dynamic pages) — only matters when using the default
const titleEl = document.querySelector("title");
if (titleEl) {
  new MutationObserver(() => {
    if (!configuredText) updateOverlay();
  }).observe(titleEl, {
    childList: true,
    characterData: true,
    subtree: true,
  });
}

// Fetch settings and initialise
browser.runtime.sendMessage({ type: "GET_SETTINGS" }).then((settings) => {
  configuredText = settings?.overlayText ?? "";
  borderColor = settings?.borderColor || DEFAULT_BORDER_COLOR;
  tabId = settings?.tabId ?? null;
  if (settings?.enabled !== false) createOverlay();
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
    if (newEntry.text !== oldEntry.text) {
      configuredText = newEntry.text || "";
      updateOverlay();
    }
    if (newEntry.color !== oldEntry.color) {
      applyBorderColor(newEntry.color);
    }
  } else {
    // Global defaults changed — apply only if this tab has no per-tab override
    if (changes.overlayText || changes.borderColor) {
      browser.storage.local.get("tabSettings").then(({ tabSettings = {} }) => {
        const perTab = tabSettings[tabId] || {};
        if (changes.overlayText && !perTab.text) {
          configuredText = changes.overlayText.newValue ?? "";
          updateOverlay();
        }
        if (changes.borderColor && !perTab.color) {
          applyBorderColor(changes.borderColor.newValue);
        }
      });
    }
  }
  if (changes.enabled) {
    changes.enabled.newValue ? createOverlay() : removeOverlay();
  }
});
