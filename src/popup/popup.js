// popup.js
// Runs in its own page context (the popup window).
// Has access to full browser.* API but its own isolated DOM.

const DEFAULT_COLOR = "#a21c1c";

const enabledToggle = document.getElementById("enabled-toggle");
const tabText = document.getElementById("tab-text");
const tabColor = document.getElementById("tab-color");
const colorPreview = document.getElementById("color-preview");
const swatches = document.querySelectorAll(".swatch");

let activeTabId = null;

function setColor(hex) {
  tabColor.value = hex;
  colorPreview.style.background = hex;
  swatches.forEach((s) =>
    s.classList.toggle("selected", s.dataset.color === hex)
  );
}

// Load current settings when popup opens
async function loadSettings() {
  const { enabled, tabSettings = {} } = await browser.storage.local.get([
    "enabled",
    "tabSettings",
  ]);
  enabledToggle.checked = enabled ?? true;

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  activeTabId = tab?.id ?? null;

  const perTab = activeTabId != null ? tabSettings[activeTabId] : undefined;
  tabText.value = perTab?.text || "";
  setColor(perTab?.color || DEFAULT_COLOR);
}
loadSettings();

function saveTabSettings() {
  if (activeTabId == null) return;
  browser.runtime.sendMessage({
    type: "SET_TAB_SETTINGS",
    tabId: activeTabId,
    text: tabText.value,
    color: tabColor.value === DEFAULT_COLOR ? "" : tabColor.value,
  });
}

swatches.forEach((s) =>
  s.addEventListener("click", () => {
    setColor(s.dataset.color);
    saveTabSettings();
  })
);

tabColor.addEventListener("input", () => {
  const hex = tabColor.value;
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    setColor(hex);
    saveTabSettings();
  }
});

tabText.addEventListener("input", saveTabSettings);

enabledToggle.addEventListener("change", () => {
  browser.storage.local.set({ enabled: enabledToggle.checked });
});
