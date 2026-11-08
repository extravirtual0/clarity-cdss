"use strict";

(() => {
  const storageKey = "clarity-cdss-theme";
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  let savedTheme = null;
  try {
    savedTheme = window.localStorage.getItem(storageKey);
  } catch {
    savedTheme = null;
  }

  const setTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.content = theme === "dark" ? "#111a22" : "#f5f7f8";
    const button = document.getElementById("theme-toggle");
    if (!button) return;
    const isDark = theme === "dark";
    button.setAttribute("aria-pressed", String(isDark));
    button.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
    button.querySelector(".theme-toggle-icon").textContent = isDark ? "☀" : "☾";
    button.querySelector(".theme-toggle-label").textContent = isDark ? "Light mode" : "Dark mode";
  };

  setTheme(savedTheme === "light" || savedTheme === "dark" ? savedTheme : media.matches ? "dark" : "light");

  document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("theme-toggle");
    if (!button) return;
    setTheme(document.documentElement.dataset.theme);
    button.addEventListener("click", () => {
      const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      setTheme(theme);
      try {
        window.localStorage.setItem(storageKey, theme);
      } catch {
        button.title = "Theme changed for this page only; browser storage is unavailable.";
      }
    });
  });
})();
