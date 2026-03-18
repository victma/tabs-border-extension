// content.js
// Injected into every page. Has access to the page DOM but limited browser.* API.
// Communicates with background.js via browser.runtime.sendMessage.

const OVERLAY_ID = "corner-text-overlay";

// The current configured text. Empty/undefined means "use tab title".
let configuredText = "";

function getDisplayText() {
  return configuredText || document.title;
}

function createOverlay() {
  if (document.getElementById(OVERLAY_ID)) return;

  const el = document.createElement("div");
  el.id = OVERLAY_ID;
  el.textContent = getDisplayText();
  document.body.appendChild(el);
}

function removeOverlay() {
  document.getElementById(OVERLAY_ID)?.remove();
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
  if (settings?.enabled !== false) createOverlay();
});

// React to storage changes in real time
browser.storage.onChanged.addListener((changes) => {
  if (changes.overlayText) {
    configuredText = changes.overlayText.newValue ?? "";
    updateOverlay();
  }
  if (changes.enabled) {
    changes.enabled.newValue ? createOverlay() : removeOverlay();
  }
});
