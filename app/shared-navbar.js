/* Shared Navbar - Theme Management for all pages */

(function () {
  const THEME_KEY = "yt-gonderi-uzmani:theme";

  function setTheme(theme) {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }

    // Toggle moon/sun icons
    const moonIcon = document.querySelector(".icon-moon");
    const sunIcon = document.querySelector(".icon-sun");
    if (moonIcon && sunIcon) {
      moonIcon.style.display = theme === "dark" ? "none" : "block";
      sunIcon.style.display = theme === "dark" ? "block" : "none";
    }

    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  }

  function getStoredTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch { return null; }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "light" : "dark");
  }

  // Apply stored theme immediately
  const storedTheme = getStoredTheme();
  if (storedTheme) {
    setTheme(storedTheme);
  } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    setTheme("dark");
  } else {
    setTheme("light");
  }

  // Bind theme toggle button
  document.addEventListener("DOMContentLoaded", function () {
    const btn = document.getElementById("themeToggle");
    if (btn) {
      btn.addEventListener("click", toggleTheme);
    }
  });
})();
