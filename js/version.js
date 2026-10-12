// Single source of the app version shown in the UI. Bump together with VERSION + CHANGELOG.md.
window.JOTARA_VERSION = "1.1.0";
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-version]").forEach((el) => { el.textContent = "v" + window.JOTARA_VERSION; });
});
