// background.js
// Runs in the background context — has access to full browser.* API but no DOM.
// Use this for: alarms, cross-tab state, network interception, etc.

browser.runtime.onInstalled.addListener(() => {
  // Set default storage values on first install
  browser.storage.local.set({
    overlayText: "Hello, world!",
    enabled: true,
  });
  console.log("[CornerText] Extension installed. Default settings written.");
});

// Listen for messages from content scripts or the popup
browser.runtime.onMessage.addListener((message, sender) => {
  console.log("[CornerText] Message received:", message, "from:", sender);

  if (message.type === "GET_SETTINGS") {
    // Return current settings to whoever asked
    return browser.storage.local.get(["overlayText", "enabled"]);
  }
});
