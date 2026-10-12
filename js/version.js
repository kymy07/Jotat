// Single source of the app version shown in the UI. Bump together with VERSION + CHANGELOG.md.
window.SNIPPIT_VERSION = "1.0.0";
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-version]").forEach((el) => { el.textContent = "v" + window.SNIPPIT_VERSION; });
});
