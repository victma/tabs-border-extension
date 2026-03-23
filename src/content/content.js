// content.js
// Injected into every page. Has access to the page DOM but limited browser.* API.
// Communicates with background.js via browser.runtime.sendMessage.

const OVERLAY_ID = "tabtint-overlay";
const FRAME_ID = "tabtint-border-frame";
const FAVICON_LINK_ID = "tabtint-favicon";

// The current configured title. Empty/undefined means "use tab title".
let configuredTitle = "";

const DEFAULT_BORDER_COLOR = "#a21c1c";
let borderColor = DEFAULT_BORDER_COLOR;

// Set by the background script so we can look up per-tab settings
let tabId = null;
const hostname = location.hostname;
let showTitle = true;
let showBorder = true;
let showFaviconBadge = true;

// Tracks whether the extension is actively rendering for this page
let isActive = false;

// Favicon badge state
let originalFaviconHref = null;
let disabledFaviconLinks = [];

function getDisplayTitle() {
  return configuredTitle || document.title;
}

function ensureOverlay() {
  if (document.getElementById(OVERLAY_ID)) return;
  const el = document.createElement("div");
  el.id = OVERLAY_ID;
  el.textContent = getDisplayTitle();
  el.style.backgroundColor = borderColor;
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

let whitelist = [];

function isWhitelisted() {
  return whitelist.length === 0 || whitelist.includes(hostname);
}

// --- Favicon badge ---

function findFaviconUrl() {
  // Check active favicon links (not our own)
  const links = document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"]');
  for (const link of links) {
    if (link.id !== FAVICON_LINK_ID && link.href) return link.href;
  }
  // Check links we already disabled from a previous badge application
  const disabled = document.querySelectorAll("link[data-tabtint-rel]");
  for (const link of disabled) {
    if (link.href) return link.href;
  }
  return `${location.origin}/favicon.ico`;
}

function setFaviconLink(dataUrl) {
  // Disable original favicon links so ours takes precedence
  disabledFaviconLinks.forEach(({ el, rel }) => { el.rel = rel; });
  disabledFaviconLinks = [];

  document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"]').forEach((link) => {
    if (link.id !== FAVICON_LINK_ID) {
      disabledFaviconLinks.push({ el: link, rel: link.rel });
      link.setAttribute("data-tabtint-rel", link.rel);
      link.rel = "tabtint-disabled-icon";
    }
  });

  let link = document.getElementById(FAVICON_LINK_ID);
  if (!link) {
    link = document.createElement("link");
    link.id = FAVICON_LINK_ID;
    link.rel = "icon";
    link.type = "image/png";
    document.head.appendChild(link);
  }
  link.href = dataUrl;
}

function removeFaviconBadge() {
  const ourLink = document.getElementById(FAVICON_LINK_ID);
  if (ourLink) ourLink.remove();

  // Restore original favicon links
  disabledFaviconLinks.forEach(({ el, rel }) => { el.rel = rel; });
  disabledFaviconLinks = [];
  originalFaviconHref = null;
}

function applyFaviconBadge(color) {
  if (!showFaviconBadge || !color) {
    removeFaviconBadge();
    return;
  }

  // Cache original favicon URL before modifying the DOM
  if (!originalFaviconHref) {
    originalFaviconHref = findFaviconUrl();
  }

  const SIZE = 32;
  const BORDER = 4;
  const innerSize = SIZE - BORDER * 2;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");

  function drawColorOnly() {
    ctx.clearRect(0, 0, SIZE, SIZE);
    // Rounded square filled with the border color
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(0, 0, SIZE, SIZE, 4);
    ctx.fill();
    setFaviconLink(canvas.toDataURL("image/png"));
  }

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    // Draw colored border background
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(0, 0, SIZE, SIZE, 4);
    ctx.fill();
    // Draw original favicon inside
    ctx.drawImage(img, BORDER, BORDER, innerSize, innerSize);
    try {
      setFaviconLink(canvas.toDataURL("image/png"));
    } catch (e) {
      // Canvas tainted by CORS — fall back to color-only icon
      drawColorOnly();
    }
  };
  img.onerror = () => drawColorOnly();
  img.src = originalFaviconHref;
}

// --- Visibility sync ---

function syncVisibility(enabled) {
  isActive = enabled && isWhitelisted();

  if (isActive && showTitle) ensureOverlay();
  else document.getElementById(OVERLAY_ID)?.remove();

  if (isActive && showBorder) ensureFrame();
  else document.getElementById(FRAME_ID)?.remove();

  if (isActive && showFaviconBadge) applyFaviconBadge(borderColor);
  else removeFaviconBadge();
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

// Watch for favicon changes (SPAs may swap favicons dynamically)
new MutationObserver((mutations) => {
  if (!isActive || !showFaviconBadge) return;
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node.nodeName === "LINK" && node.id !== FAVICON_LINK_ID && /icon/i.test(node.rel || "")) {
        // Page added a new favicon — cache the new URL and re-apply badge
        originalFaviconHref = node.href || null;
        applyFaviconBadge(borderColor);
        return;
      }
    }
  }
}).observe(document.head, { childList: true });

// Fetch settings and initialise
browser.runtime.sendMessage({ type: "GET_SETTINGS", hostname }).then((settings) => {
  configuredTitle = settings?.overlayTitle ?? "";
  borderColor = settings?.borderColor || DEFAULT_BORDER_COLOR;
  tabId = settings?.tabId ?? null;
  showTitle = settings?.showTitle !== false;
  showBorder = settings?.showBorder !== false;
  showFaviconBadge = settings?.showFaviconBadge !== false;
  whitelist = settings?.whitelist || [];
  syncVisibility(settings?.enabled !== false);
});

function applyBorderColor(color) {
  borderColor = color || DEFAULT_BORDER_COLOR;
  const el = document.getElementById(OVERLAY_ID);
  if (el) el.style.backgroundColor = borderColor;
  const frame = document.getElementById(FRAME_ID);
  if (frame) frame.style.borderColor = borderColor;
  if (isActive && showFaviconBadge) applyFaviconBadge(borderColor);
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
    if (newEntry.title !== oldEntry.title && !newEntry.title) {
      // Per-tab title cleared — fall back to domain then global
      browser.storage.local.get("domainDefaults").then(({ domainDefaults = {} }) => {
        configuredTitle = domainDefaults[hostname]?.title || "";
        updateOverlay();
      });
    }
    if (newEntry.color !== oldEntry.color) {
      // Per-tab color changed — resolve full fallback chain
      if (newEntry.color) {
        applyBorderColor(newEntry.color);
      } else {
        browser.storage.local.get("domainDefaults").then(({ domainDefaults = {} }) => {
          applyBorderColor(domainDefaults[hostname]?.color || "");
        });
      }
    }
  }

  // Domain defaults changed — apply if this tab has no per-tab override
  if (changes.domainDefaults && hostname) {
    const newDomain = (changes.domainDefaults.newValue || {})[hostname] || {};
    const oldDomain = (changes.domainDefaults.oldValue || {})[hostname] || {};
    browser.storage.local.get("tabSettings").then(({ tabSettings = {} }) => {
      const perTab = tabSettings[tabId] || {};
      if (newDomain.color !== oldDomain.color && !perTab.color) {
        applyBorderColor(newDomain.color || "");
      }
      if (newDomain.title !== oldDomain.title && !perTab.title) {
        configuredTitle = newDomain.title || "";
        updateOverlay();
      }
    });
  }

  // Global defaults changed — apply only if no per-tab or per-domain override
  if (changes.overlayTitle) {
    browser.storage.local.get(["tabSettings", "domainDefaults"]).then(({ tabSettings = {}, domainDefaults = {} }) => {
      if (!tabSettings[tabId]?.title && !domainDefaults[hostname]?.title) {
        configuredTitle = changes.overlayTitle.newValue ?? "";
        updateOverlay();
      }
    });
  }

  let needSync = false;
  if (changes.showTitle) { showTitle = changes.showTitle.newValue !== false; needSync = true; }
  if (changes.showBorder) { showBorder = changes.showBorder.newValue !== false; needSync = true; }
  if (changes.showFaviconBadge) { showFaviconBadge = changes.showFaviconBadge.newValue !== false; needSync = true; }
  if (changes.whitelist) { whitelist = changes.whitelist.newValue || []; needSync = true; }
  if (changes.enabled || needSync) {
    browser.storage.local.get("enabled").then(({ enabled }) => {
      syncVisibility(enabled !== false);
    });
  }
});
