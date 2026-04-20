const STORAGE_KEY = "cal_admin_token_v1";

export function getAdminToken() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function setAdminToken(token) {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function clearAdminToken() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Headers for admin API calls (JWT from staff login). */
export function adminAuthHeaders() {
  const t = getAdminToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
