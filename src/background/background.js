// background.js
// Runs in the background context — has access to full browser.* API but no DOM.
// Use this for: alarms, cross-tab state, network interception, etc.

browser.runtime.onInstalled.addListener(() => {
  // Set default storage values on first install
  browser.storage.local.set({
    overlayTitle: "",
    domainDefaults: {},
    tabSettings: {},
    enabled: true,
    showTitle: true,
    showBorder: true,
    whitelist: [],
  });
  console.log("[TabTint] Extension installed. Default settings written.");
});

// Listen for messages from content scripts or the popup
browser.runtime.onMessage.addListener((message, sender) => {
  console.log("[TabTint] Message received:", message, "from:", sender);

  if (message.type === "GET_SETTINGS") {
    const hostname = message.hostname || "";
    return browser.storage.local
      .get(["overlayTitle", "domainDefaults", "tabSettings", "enabled", "showTitle", "showBorder", "whitelist"])
      .then((settings) => {
        const tabId = sender.tab?.id;
        const perTab = tabId != null ? settings.tabSettings?.[tabId] : undefined;
        const domain = hostname ? settings.domainDefaults?.[hostname] : undefined;
        return {
          overlayTitle: perTab?.title || domain?.title || settings.overlayTitle,
          borderColor: perTab?.color || domain?.color || "",
          enabled: settings.enabled,
          showTitle: settings.showTitle,
          showBorder: settings.showBorder,
          whitelist: settings.whitelist,
          tabId,
        };
      });
  }

  if (message.type === "SET_DOMAIN_DEFAULTS") {
    const { hostname, color, title } = message;
    return browser.storage.local.get("domainDefaults").then(({ domainDefaults = {} }) => {
      if (color || title) {
        domainDefaults[hostname] = { color, title };
      } else {
        delete domainDefaults[hostname];
      }
      return browser.storage.local.set({ domainDefaults });
    });
  }

  if (message.type === "SET_TAB_SETTINGS") {
    const { tabId, color, title } = message;
    return browser.storage.local.get("tabSettings").then(({ tabSettings = {} }) => {
      const entry = { ...tabSettings[tabId] };
      if (color !== undefined) entry.color = color;
      if (title !== undefined) entry.title = title;
      if (entry.color || entry.title) {
        tabSettings[tabId] = entry;
      } else {
        delete tabSettings[tabId];
      }
      return browser.storage.local.set({ tabSettings });
    });
  }
});

// Clean up per-tab settings when a tab is closed
browser.tabs.onRemoved.addListener((tabId) => {
  browser.storage.local.get("tabSettings").then(({ tabSettings = {} }) => {
    if (tabId in tabSettings) {
      delete tabSettings[tabId];
      browser.storage.local.set({ tabSettings });
    }
  });
});
