// content.js
// Injected into every page. Has access to the page DOM but limited browser.* API.
// Communicates with background.js via browser.runtime.sendMessage.

const OVERLAY_ID = "tabtint-overlay";
const FRAME_ID = "tabtint-border-frame";
const FAVICON_LINK_ID = "tabtint-favicon";
const FAVICON_LINK_SELECTOR = 'link[rel~="icon"], link[rel="shortcut icon"]';

// The current configured title. Empty/undefined means "use tab title".
let configuredTitle = "";

let borderColor = DEFAULT_COLOR;

// Set by the background script so we can look up per-tab settings
let tabId = null;
const hostname = location.hostname;
let showTitle = true;
let showBorder = true;

// Tracks whether the extension is actively rendering for this page
let isActive = false;
// Whether full settings have been applied (skipped for non-whitelisted domains)
let initialized = false;

// Favicon badge state
let originalFaviconHref = null;
let lastAppliedBadge = null;

function getDisplayTitle() {
  const raw = configuredTitle || document.title || hostname;
  return applyTitleTemplate(raw, whitelist, hostname);
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

// --- Favicon badge ---

function findFaviconUrl() {
  const links = document.querySelectorAll(FAVICON_LINK_SELECTOR);
  for (const link of links) {
    if (link.id !== FAVICON_LINK_ID && link.href) return link.href;
  }
  // Check links we already disabled
  for (const link of document.querySelectorAll("link[data-tabtint-rel]")) {
    if (link.href) return link.href;
  }
  return `${location.origin}/favicon.ico`;
}

function setFaviconLink(dataUrl) {
  // Disable original favicon links so ours takes precedence
  document.querySelectorAll(FAVICON_LINK_SELECTOR).forEach((link) => {
    if (link.id !== FAVICON_LINK_ID) {
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

function restoreOriginalFavicons() {
  document.querySelectorAll("link[data-tabtint-rel]").forEach((link) => {
    link.rel = link.getAttribute("data-tabtint-rel");
    link.removeAttribute("data-tabtint-rel");
  });
}

function removeFaviconBadge() {
  const ourLink = document.getElementById(FAVICON_LINK_ID);
  if (ourLink) ourLink.remove();
  restoreOriginalFavicons();
  originalFaviconHref = null;
  lastAppliedBadge = null;
}

function applyFaviconBadge(color) {
  if (!color) {
    removeFaviconBadge();
    return;
  }

  if (!originalFaviconHref) {
    originalFaviconHref = findFaviconUrl();
  }

  // Skip if nothing changed since last render
  const key = color + "|" + originalFaviconHref;
  if (lastAppliedBadge === key) return;

  const SIZE = 32;
  const BORDER = 4;
  const innerSize = SIZE - BORDER * 2;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");

  function drawColorOnly() {
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(0, 0, SIZE, SIZE, 4);
    ctx.fill();
    setFaviconLink(canvas.toDataURL("image/png"));
    lastAppliedBadge = key;
  }

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(0, 0, SIZE, SIZE, 4);
    ctx.fill();
    ctx.drawImage(img, BORDER, BORDER, innerSize, innerSize);
    try {
      setFaviconLink(canvas.toDataURL("image/png"));
      lastAppliedBadge = key;
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
  isActive = enabled && isWhitelisted(whitelist, hostname);

  if (isActive && showTitle) ensureOverlay();
  else document.getElementById(OVERLAY_ID)?.remove();

  if (isActive && showBorder) ensureFrame();
  else document.getElementById(FRAME_ID)?.remove();

  if (isActive && (showTitle || showBorder)) applyFaviconBadge(borderColor);
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
  if (!isActive || !(showTitle || showBorder)) return;
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

function applySettings(settings) {
  configuredTitle = settings?.overlayTitle ?? "";
  borderColor = settings?.borderColor || DEFAULT_COLOR;
  showTitle = settings?.showTitle !== false;
  showBorder = settings?.showBorder !== false;
  initialized = true;
  syncVisibility(settings?.enabled !== false);
}

// Fetch settings and initialise
browser.runtime.sendMessage({ type: "GET_SETTINGS", hostname }).then((settings) => {
  tabId = settings?.tabId ?? null;
  whitelist = settings?.whitelist || [];
  if (!isWhitelisted(whitelist, hostname)) return;
  applySettings(settings);
});

function applyBorderColor(color) {
  borderColor = color || DEFAULT_COLOR;
  const el = document.getElementById(OVERLAY_ID);
  if (el) el.style.backgroundColor = borderColor;
  const frame = document.getElementById(FRAME_ID);
  if (frame) frame.style.borderColor = borderColor;
  if (isActive && (showTitle || showBorder)) applyFaviconBadge(borderColor);
}

// React to storage changes in real time
browser.storage.onChanged.addListener((changes) => {
  // Always keep whitelist up to date
  if (changes.whitelist) {
    whitelist = changes.whitelist.newValue || [];
  }

  // Skip all processing if current domain is not whitelisted
  if (!isWhitelisted(whitelist, hostname)) {
    if (isActive) syncVisibility(false);
    initialized = false;
    return;
  }

  // Domain just became whitelisted — fetch full settings
  if (!initialized) {
    browser.runtime.sendMessage({ type: "GET_SETTINGS", hostname }).then(applySettings);
    return;
  }

  if (changes.tabSettings && tabId != null) {
    const newEntry = (changes.tabSettings.newValue || {})[tabId] || {};
    const oldEntry = (changes.tabSettings.oldValue || {})[tabId] || {};
    const titleChanged = newEntry.title !== oldEntry.title;
    const colorChanged = newEntry.color !== oldEntry.color;

    if (titleChanged && newEntry.title) {
      configuredTitle = newEntry.title;
      updateOverlay();
    }
    if (colorChanged && newEntry.color) {
      applyBorderColor(newEntry.color);
    }

    // Fall back to domain defaults for cleared values
    const needTitleFallback = titleChanged && !newEntry.title;
    const needColorFallback = colorChanged && !newEntry.color;
    if (needTitleFallback || needColorFallback) {
      browser.storage.local.get("domainDefaults").then(({ domainDefaults = {} }) => {
        const domain = resolveDomainDefaults(domainDefaults, hostname, whitelist);
        if (needTitleFallback) {
          configuredTitle = domain?.title || "";
          updateOverlay();
        }
        if (needColorFallback) {
          applyBorderColor(domain?.color || "");
        }
      });
    }
  }

  // Domain defaults changed — apply if this tab has no per-tab override
  if (changes.domainDefaults && hostname) {
    const newDomain = resolveDomainDefaults(changes.domainDefaults.newValue || {}, hostname, whitelist) || {};
    const oldDomain = resolveDomainDefaults(changes.domainDefaults.oldValue || {}, hostname, whitelist) || {};
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
      const domain = resolveDomainDefaults(domainDefaults, hostname, whitelist);
      if (!tabSettings[tabId]?.title && !domain?.title) {
        configuredTitle = changes.overlayTitle.newValue ?? "";
        updateOverlay();
      }
    });
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
