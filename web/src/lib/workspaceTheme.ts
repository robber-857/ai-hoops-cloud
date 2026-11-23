export const themeStorageKey = "ai-hoops-theme";
export const themeChangeEvent = "ai-hoops-theme-change";

export const initializeTheme = `try {
  const root = document.documentElement;
  const theme = localStorage.getItem(${JSON.stringify(themeStorageKey)}) === "light" ? "light" : "dark";
  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark");
} catch {}`;
