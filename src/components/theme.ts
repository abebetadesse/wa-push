export type Theme = "light" | "dark";

export const themeStorageKey = "forma-theme";

// Runs before first paint (see the root layout) so a saved dark theme never flashes light.
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${themeStorageKey}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;

export function currentTheme(): Theme {
  const attribute = document.documentElement.getAttribute("data-theme");
  if (attribute === "light" || attribute === "dark") return attribute;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(themeStorageKey, theme);
  } catch {
    // Private windows may block storage; the theme still applies for this visit.
  }
}
