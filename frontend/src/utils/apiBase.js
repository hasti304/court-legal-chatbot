/** API origin for fetch(). In Vite dev, empty string = same origin → dev server proxy (no CORS). */
export function getApiBaseUrl() {
  const raw = String(import.meta.env.VITE_API_BASE_URL ?? "").trim();
  if (raw) {
    try {
      const parsed = new URL(raw);
      const isLoopbackHost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      // In local dev, prefer Vite proxy for loopback APIs to avoid localhost-vs-127 CORS mismatch.
      if (import.meta.env.DEV && isLoopbackHost) return "";
    } catch {
      /* ignore malformed URL and fall through */
    }
    return raw.replace(/\/+$/, "");
  }
  if (import.meta.env.DEV) return "";
  return String("https://court-legal-chatbot-1.onrender.com").replace(/\/+$/, "");
}
