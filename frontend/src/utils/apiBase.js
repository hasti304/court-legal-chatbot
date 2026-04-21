/** API origin for fetch(). In Vite dev, empty string = same origin → dev server proxy (no CORS). */
export function getApiBaseUrl() {
  const normalize = (value) => {
    const input = String(value || "").trim();
    if (!input) return "";
    try {
      const u = new URL(input);
      // Backward-compat for older env configs pointing at a retired Render hostname.
      if (u.hostname === "court-legal-chatbot.onrender.com") {
        u.hostname = "court-legal-chatbot-1.onrender.com";
      }
      return u.toString().replace(/\/+$/, "");
    } catch {
      return input.replace(/\/+$/, "");
    }
  };

  const raw = String(import.meta.env.VITE_API_BASE_URL ?? "").trim();
  if (raw) {
    try {
      const normalized = normalize(raw);
      const parsed = new URL(normalized);
      const isLoopbackHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      // In local dev, prefer Vite proxy for loopback APIs to avoid localhost-vs-127 CORS mismatch.
      if (import.meta.env.DEV && isLoopbackHost) return "";
    } catch {
      /* ignore malformed URL and fall through */
    }
    return normalize(raw);
  }
  if (import.meta.env.DEV) return "";
  return normalize("https://court-legal-chatbot-1.onrender.com");
}
