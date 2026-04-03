// popup.js
// Runs in its own page context (the popup window).
// Has access to full browser.* API but its own isolated DOM.

const headerAccent = document.getElementById("header-accent");
const activateDomainBtn = document.getElementById("activate-domain");
const activateDomainName = document.getElementById("activate-domain-name");
const domainSettings = document.getElementById("domain-settings");
const enabledToggle = document.getElementById("enabled-toggle");
const settingsBody = document.getElementById("settings-body");
const showTitleToggle = document.getElementById("show-title-toggle");
const showBorderToggle = document.getElementById("show-border-toggle");
const tabTitle = document.getElementById("tab-title");
const tabColor = document.getElementById("tab-color");
const colorPreview = document.getElementById("color-preview");
const swatches = document.querySelectorAll(".swatch");
const domainNameEl = document.getElementById("domain-name");
const setDomainDefaultsBtn = document.getElementById("set-domain-defaults");
const clearDomainColorBtn = document.getElementById("clear-domain-color");

const whitelistCount = document.getElementById("whitelist-count");
const whitelistHint = document.getElementById("whitelist-hint");
const whitelistList = document.getElementById("whitelist-list");
const whitelistInput = document.getElementById("whitelist-input");
const whitelistAddBtn = document.getElementById("whitelist-add");
const whitelistAddCurrentBtn = document.getElementById("whitelist-add-current");
const whitelistCurrentDomain = document.getElementById("whitelist-current-domain");

let activeTabId = null;
let activeHostname = "";
let currentWhitelist = [];
let defaultsKey = "";

function isHostWhitelisted(host) {
  return isWhitelisted(currentWhitelist, host);
}

function setColor(hex) {
  tabColor.value = hex;
  colorPreview.style.background = hex;
  headerAccent.style.background = hex;
  swatches.forEach((s) =>
    s.classList.toggle("selected", s.dataset.color === hex)
  );
}

function syncEnabledState() {
  settingsBody.classList.toggle("disabled", !enabledToggle.checked);
}

function syncActiveState() {
  const active = isHostWhitelisted(activeHostname);
  activateDomainBtn.hidden = active || !activeHostname;
  domainSettings.hidden = !active;
}

// Load current settings when popup opens
async function loadSettings() {
  const { enabled, showTitle, showBorder, domainDefaults = {}, tabSettings = {}, whitelist = [] } =
    await browser.storage.local.get(["enabled", "showTitle", "showBorder", "domainDefaults", "tabSettings", "whitelist"]);
  enabledToggle.checked = enabled ?? true;
  showTitleToggle.checked = showTitle ?? true;
  showBorderToggle.checked = showBorder ?? true;
  syncEnabledState();

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  activeTabId = tab?.id ?? null;
  activeHostname = tab?.url ? new URL(tab.url).hostname : "";

  currentWhitelist = whitelist;

  const perTab = activeTabId != null ? tabSettings[activeTabId] : undefined;
  const domain = resolveDomainDefaults(domainDefaults, activeHostname, whitelist);
  tabTitle.value = perTab?.title || domain?.title || "";
  setColor(perTab?.color || domain?.color || DEFAULT_COLOR);

  clearDomainColorBtn.hidden = !domain;
  whitelistCurrentDomain.textContent = activeHostname || "(unknown)";
  activateDomainName.textContent = activeHostname || "(unknown)";
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
  syncEnabledState();
});
showTitleToggle.addEventListener("change", () => {
  browser.storage.local.set({ showTitle: showTitleToggle.checked });
});
showBorderToggle.addEventListener("change", () => {
  browser.storage.local.set({ showBorder: showBorderToggle.checked });
});
activateDomainBtn.addEventListener("click", () => {
  addToWhitelist(activeHostname);
  syncActiveState();
});

setDomainDefaultsBtn.addEventListener("click", () => {
  if (!defaultsKey) return;
  browser.runtime.sendMessage({
    type: "SET_DOMAIN_DEFAULTS",
    hostname: defaultsKey,
    color: tabColor.value,
    title: tabTitle.value,
  });
  clearDomainColorBtn.hidden = false;
});

clearDomainColorBtn.addEventListener("click", () => {
  if (!defaultsKey) return;
  browser.runtime.sendMessage({
    type: "SET_DOMAIN_DEFAULTS",
    hostname: defaultsKey,
    color: "",
    title: "",
  });
  clearDomainColorBtn.hidden = true;
});

// --- Whitelist ---

function saveWhitelist() {
  browser.storage.local.set({ whitelist: currentWhitelist });
}

async function renderWhitelist() {
  defaultsKey = currentWhitelist.includes(activeHostname)
    ? activeHostname
    : findMatchingPattern(currentWhitelist, activeHostname) || activeHostname;
  domainNameEl.textContent = defaultsKey || "(unknown)";

  const count = currentWhitelist.length;
  whitelistHint.hidden = count > 0;
  whitelistCount.hidden = count === 0;
  whitelistCount.textContent = count;

  const { domainDefaults = {} } = await browser.storage.local.get("domainDefaults");

  whitelistList.innerHTML = "";
  for (const entry of currentWhitelist) {
    const li = document.createElement("li");
    const defaults = domainDefaults[entry];

    const preview = document.createElement("span");
    preview.className = "domain-preview";
    if (defaults?.color) {
      preview.style.background = defaults.color;
      if (defaults.title) preview.title = defaults.title;
    }
    li.appendChild(preview);

    const name = document.createElement("span");
    name.className = "domain-name-text";
    name.textContent = entry;
    li.appendChild(name);

    const btn = document.createElement("button");
    btn.className = "remove-domain";
    btn.textContent = "\u00d7";
    btn.addEventListener("click", () => {
      currentWhitelist = currentWhitelist.filter((d) => d !== entry);
      saveWhitelist();
      renderWhitelist();
    });
    li.appendChild(btn);
    whitelistList.appendChild(li);
  }
  whitelistAddCurrentBtn.disabled = currentWhitelist.includes(activeHostname) || !activeHostname;
  syncActiveState();
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
