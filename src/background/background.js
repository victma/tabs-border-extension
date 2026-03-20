// background.js
// Runs in the background context — has access to full browser.* API but no DOM.
// Use this for: alarms, cross-tab state, network interception, etc.

browser.runtime.onInstalled.addListener(() => {
  // Set default storage values on first install
  browser.storage.local.set({
    overlayTitle: "",
    borderColor: "",
    tabSettings: {},
    enabled: true,
    showTitle: true,
    showBorder: true,
  });
  console.log("[TabTint] Extension installed. Default settings written.");
});

// Listen for messages from content scripts or the popup
browser.runtime.onMessage.addListener((message, sender) => {
  console.log("[TabTint] Message received:", message, "from:", sender);

  if (message.type === "GET_SETTINGS") {
    return browser.storage.local
      .get(["overlayTitle", "borderColor", "tabSettings", "enabled", "showTitle", "showBorder"])
      .then((settings) => {
        const tabId = sender.tab?.id;
        const perTab = tabId != null ? settings.tabSettings?.[tabId] : undefined;
        return {
          overlayTitle: perTab?.title || settings.overlayTitle,
          borderColor: perTab?.color || settings.borderColor,
          enabled: settings.enabled,
          showTitle: settings.showTitle,
          showBorder: settings.showBorder,
          tabId,
        };
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
