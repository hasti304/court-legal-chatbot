export const THEME_STORAGE_KEY = "cal_theme";
const LEGACY_KEY = "cal_theme_v1";

/** @returns {"light" | "dark"} */
export function getStoredTheme() {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "dark" || v === "light") return v;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === "dark" || legacy === "light") return legacy;
  } catch {
    /* ignore */
  }
  return "light";
}

export function persistTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}
