// content.js
// Injected into every page. Has access to the page DOM but limited browser.* API.
// Communicates with background.js via browser.runtime.sendMessage.

const OVERLAY_ID = "corner-text-overlay";

function createOverlay(text) {
  // Avoid duplicates (e.g. on SPA navigations)
  if (document.getElementById(OVERLAY_ID)) return;

  const el = document.createElement("div");
  el.id = OVERLAY_ID;
  el.textContent = text;
  document.body.appendChild(el);
}

function removeOverlay() {
  document.getElementById(OVERLAY_ID)?.remove();
}

function updateOverlay(text) {
  const el = document.getElementById(OVERLAY_ID);
  if (el) el.textContent = text;
}

// Fetch settings from background and initialise
browser.runtime.sendMessage({ type: "GET_SETTINGS" }).then(({ overlayText, enabled }) => {
  if (enabled) createOverlay(overlayText);
});

// React to storage changes in real time (e.g. user edits text in the popup)
browser.storage.onChanged.addListener((changes) => {
  if (changes.enabled) {
    changes.enabled.newValue
      ? browser.runtime.sendMessage({ type: "GET_SETTINGS" }).then(({ overlayText }) => createOverlay(overlayText))
      : removeOverlay();
  }
  if (changes.overlayText) {
    updateOverlay(changes.overlayText.newValue);
  }
});
