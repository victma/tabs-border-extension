// popup.js
// Runs in its own page context (the popup window).
// Has access to full browser.* API but its own isolated DOM.

const enabledToggle = document.getElementById("enabled-toggle");
const saveBtn = document.getElementById("save-btn");
const status = document.getElementById("status");

// Load current settings when popup opens
browser.storage.local.get(["enabled"]).then(({ enabled }) => {
  enabledToggle.checked = enabled ?? true;
});

// Save settings and show feedback
saveBtn.addEventListener("click", async () => {
  await browser.storage.local.set({
    enabled: enabledToggle.checked,
  });

  status.textContent = "Saved!";
  setTimeout(() => (status.textContent = ""), 1500);
});
