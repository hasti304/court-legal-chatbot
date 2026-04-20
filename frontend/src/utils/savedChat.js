import { STORAGE_KEY } from "./storageKeys";

export { STORAGE_KEY };

/**
 * Returns saved triage session from localStorage if user has an in-progress (not complete) chat.
 */
export function getPendingTriageFromStorage() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    const step = saved?.conversationState?.step;
    if (!step || step === "complete") return null;
    if (!Array.isArray(saved.messages) || saved.messages.length === 0) return null;
    return {
      step,
      savedAt: saved.savedAt || null,
      topic: saved.conversationState?.topic || null,
    };
  } catch {
    return null;
  }
}

export function clearSavedChatState() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
