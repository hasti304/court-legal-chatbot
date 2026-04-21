/** API origin for fetch(). In Vite dev, empty string = same origin → dev server proxy (no CORS). */

const CANON_PUBLIC_API = "https://court-legal-chatbot-1.onrender.com";

/** Retired Render hostname; old builds or env still reference it and break CORS. */
function fixPinnedLegacyHost(url) {
  let s = String(url || "").trim();
  if (!s) return s;
  s = s.replace(/\/\/court-legal-chatbot\.onrender\.com\b/gi, "//court-legal-chatbot-1.onrender.com");
  return s.replace(/\/+$/, "");
}

export function getApiBaseUrl() {
  const normalize = (value) => {
    const input = String(value || "").trim();
    if (!input) return "";
    try {
      const u = new URL(input);
      if (u.hostname === "court-legal-chatbot.onrender.com") {
        u.hostname = "court-legal-chatbot-1.onrender.com";
      }
      return u.toString().replace(/\/+$/, "");
    } catch {
      return fixPinnedLegacyHost(input.replace(/\/+$/, ""));
    }
  };

  // GitHub Pages for this repo: always use the live API (survives old SW / wrong baked VITE_API_BASE_URL).
  if (typeof window !== "undefined" && import.meta.env.PROD) {
    const host = window.location.hostname || "";
    const path = window.location.pathname || "";
    if (host.endsWith(".github.io") && /court-legal-chatbot/i.test(path)) {
      return fixPinnedLegacyHost(CANON_PUBLIC_API);
    }
  }

  const raw = String(import.meta.env.VITE_API_BASE_URL ?? "").trim();
  if (raw) {
    try {
      const normalized = normalize(raw);
      const parsed = new URL(normalized);
      const isLoopbackHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      if (import.meta.env.DEV && isLoopbackHost) return "";
    } catch {
      /* ignore malformed URL and fall through */
    }
    return fixPinnedLegacyHost(normalize(raw));
  }
  if (import.meta.env.DEV) return "";
  return fixPinnedLegacyHost(normalize(CANON_PUBLIC_API));
}
