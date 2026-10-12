// Single source of the app version shown in the UI. Bump together with VERSION + CHANGELOG.md.
window.JOTAT_VERSION = "1.3.0";
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-version]").forEach((el) => { el.textContent = "v" + window.JOTAT_VERSION; });
});
