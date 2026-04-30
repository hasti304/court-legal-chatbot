/** API origin for fetch(). In Vite dev, empty string = same origin -> dev server proxy (no CORS). */
function normalizeUrl(value) {
  const input = String(value || "").trim();
  if (!input) return "";
  try {
    return new URL(input).toString().replace(/\/+$/, "");
  } catch {
    return input.replace(/\/+$/, "");
  }
}

/**
 * Backward-compatible helper kept for existing callsites.
 * Legacy Render hostname rewriting is no longer needed after migration.
 */
export function rewriteLegacyRenderFetchUrl(url) {
  if (typeof url !== "string") return url;
  return normalizeUrl(url);
}

export function getApiBaseUrl() {
  const raw = String(import.meta.env.VITE_API_BASE_URL ?? "").trim();
  if (raw) {
    try {
      const normalized = normalizeUrl(raw);
      const parsed = new URL(normalized);
      const isLoopbackHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      if (import.meta.env.DEV && isLoopbackHost) return "";
    } catch {
      /* ignore malformed URL and fall through */
    }
    return normalizeUrl(raw);
  }
  if (import.meta.env.DEV) return "";
  return "";
}
