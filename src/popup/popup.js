// popup.js
// Runs in its own page context (the popup window).
// Has access to full browser.* API but its own isolated DOM.

const DEFAULT_COLOR = "#a21c1c";

const enabledToggle = document.getElementById("enabled-toggle");
const showTitleToggle = document.getElementById("show-title-toggle");
const showBorderToggle = document.getElementById("show-border-toggle");
const tabTitle = document.getElementById("tab-title");
const tabColor = document.getElementById("tab-color");
const colorPreview = document.getElementById("color-preview");
const swatches = document.querySelectorAll(".swatch");
const domainNameEl = document.getElementById("domain-name");
const setDomainDefaultsBtn = document.getElementById("set-domain-defaults");
const clearDomainColorBtn = document.getElementById("clear-domain-color");

const whitelistHint = document.getElementById("whitelist-hint");
const whitelistList = document.getElementById("whitelist-list");
const whitelistInput = document.getElementById("whitelist-input");
const whitelistAddBtn = document.getElementById("whitelist-add");
const whitelistAddCurrentBtn = document.getElementById("whitelist-add-current");
const whitelistCurrentDomain = document.getElementById("whitelist-current-domain");

let activeTabId = null;
let activeHostname = "";
let currentWhitelist = [];

function setColor(hex) {
  tabColor.value = hex;
  colorPreview.style.background = hex;
  swatches.forEach((s) =>
    s.classList.toggle("selected", s.dataset.color === hex)
  );
}

// Load current settings when popup opens
async function loadSettings() {
  const { enabled, showTitle, showBorder, domainDefaults = {}, tabSettings = {}, whitelist = [] } =
    await browser.storage.local.get(["enabled", "showTitle", "showBorder", "domainDefaults", "tabSettings", "whitelist"]);
  enabledToggle.checked = enabled ?? true;
  showTitleToggle.checked = showTitle ?? true;
  showBorderToggle.checked = showBorder ?? true;

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  activeTabId = tab?.id ?? null;
  activeHostname = tab?.url ? new URL(tab.url).hostname : "";

  const perTab = activeTabId != null ? tabSettings[activeTabId] : undefined;
  const domain = domainDefaults[activeHostname];
  tabTitle.value = perTab?.title || domain?.title || "";
  setColor(perTab?.color || domain?.color || DEFAULT_COLOR);

  domainNameEl.textContent = activeHostname || "(unknown)";
  clearDomainColorBtn.hidden = !domain;

  currentWhitelist = whitelist;
  whitelistCurrentDomain.textContent = activeHostname || "(unknown)";
  renderWhitelist();
}
loadSettings();

function saveTabSettings() {
  if (activeTabId == null) return;
  browser.runtime.sendMessage({
    type: "SET_TAB_SETTINGS",
    tabId: activeTabId,
    title: tabTitle.value,
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

tabTitle.addEventListener("input", saveTabSettings);

enabledToggle.addEventListener("change", () => {
  browser.storage.local.set({ enabled: enabledToggle.checked });
});
showTitleToggle.addEventListener("change", () => {
  browser.storage.local.set({ showTitle: showTitleToggle.checked });
});
showBorderToggle.addEventListener("change", () => {
  browser.storage.local.set({ showBorder: showBorderToggle.checked });
});

setDomainDefaultsBtn.addEventListener("click", () => {
  if (!activeHostname) return;
  browser.runtime.sendMessage({
    type: "SET_DOMAIN_DEFAULTS",
    hostname: activeHostname,
    color: tabColor.value,
    title: tabTitle.value,
  });
  clearDomainColorBtn.hidden = false;
});

clearDomainColorBtn.addEventListener("click", () => {
  if (!activeHostname) return;
  browser.runtime.sendMessage({
    type: "SET_DOMAIN_DEFAULTS",
    hostname: activeHostname,
    color: "",
    title: "",
  });
  clearDomainColorBtn.hidden = true;
});

// --- Whitelist ---

function saveWhitelist() {
  browser.storage.local.set({ whitelist: currentWhitelist });
}

function renderWhitelist() {
  whitelistHint.hidden = currentWhitelist.length > 0;
  whitelistList.innerHTML = "";
  for (const domain of currentWhitelist) {
    const li = document.createElement("li");
    li.textContent = domain;
    const btn = document.createElement("button");
    btn.className = "remove-domain";
    btn.textContent = "\u00d7";
    btn.addEventListener("click", () => {
      currentWhitelist = currentWhitelist.filter((d) => d !== domain);
      saveWhitelist();
      renderWhitelist();
    });
    li.appendChild(btn);
    whitelistList.appendChild(li);
  }
  const alreadyListed = currentWhitelist.includes(activeHostname);
  whitelistAddCurrentBtn.disabled = alreadyListed || !activeHostname;
}

function addToWhitelist(domain) {
  domain = domain.trim().toLowerCase();
  if (!domain || currentWhitelist.includes(domain)) return;
  currentWhitelist.push(domain);
  currentWhitelist.sort();
  saveWhitelist();
  renderWhitelist();
}

whitelistAddCurrentBtn.addEventListener("click", () => {
  addToWhitelist(activeHostname);
});

whitelistAddBtn.addEventListener("click", () => {
  addToWhitelist(whitelistInput.value);
  whitelistInput.value = "";
});

whitelistInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    addToWhitelist(whitelistInput.value);
    whitelistInput.value = "";
  }
});
