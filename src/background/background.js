// background.js
// Runs in the background context — has access to full browser.* API but no DOM.
// Use this for: alarms, cross-tab state, network interception, etc.

browser.runtime.onInstalled.addListener(() => {
  // Set default storage values on first install
  browser.storage.local.set({
    overlayText: "",
    borderColor: "",
    tabSettings: {},
    enabled: true,
    showText: true,
    showBorder: true,
  });
  console.log("[TabTint] Extension installed. Default settings written.");
});

// Listen for messages from content scripts or the popup
browser.runtime.onMessage.addListener((message, sender) => {
  console.log("[TabTint] Message received:", message, "from:", sender);

  if (message.type === "GET_SETTINGS") {
    return browser.storage.local
      .get(["overlayText", "borderColor", "tabSettings", "enabled", "showText", "showBorder"])
      .then((settings) => {
        const tabId = sender.tab?.id;
        const perTab = tabId != null ? settings.tabSettings?.[tabId] : undefined;
        return {
          overlayText: perTab?.text || settings.overlayText,
          borderColor: perTab?.color || settings.borderColor,
          enabled: settings.enabled,
          showText: settings.showText,
          showBorder: settings.showBorder,
          tabId,
        };
      });
  }

  if (message.type === "SET_TAB_SETTINGS") {
    const { tabId, color, text } = message;
    return browser.storage.local.get("tabSettings").then(({ tabSettings = {} }) => {
      const entry = { ...tabSettings[tabId] };
      if (color !== undefined) entry.color = color;
      if (text !== undefined) entry.text = text;
      if (entry.color || entry.text) {
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
