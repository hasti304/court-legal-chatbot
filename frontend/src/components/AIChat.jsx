import React, { useState, useEffect, useRef, useMemo } from "react";
import StatusBanner from "./StatusBanner";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { useTranslation } from "react-i18next";
import { getNormalizedLanguage } from "../i18n";
import {
  FaArrowLeft,
  FaPaperPlane,
  FaVolumeUp,
  FaStop,
  FaSignOutAlt,
  FaTrashAlt,
  FaRedo,
  FaCopy,
  FaCheck,
  FaBalanceScale,
  FaUser,
  FaChartBar,
  FaTimes,
  FaExclamationTriangle,
} from "react-icons/fa";
import { getApiBaseUrl, rewriteLegacyRenderFetchUrl } from "../utils/apiBase";

const SUPPORT_EMAIL = "intake@chicagoadvocatelegal.com";
const AI_CHAT_FETCH_TIMEOUT_MS = 30000;
const QUERY_HISTORY_KEY = "cal_ai_query_history_v1";
const INTAKE_SAVED_KEY = "cal_intake_saved_v1";

const TOPIC_LABELS = {
  housing: "Housing",
  divorce: "Divorce",
  custody: "Child Custody",
  child_support: "Child Support",
  education: "Education",
  general: "General Legal",
};

const RISK_KEYWORDS = {
  "Urgent housing matter detected": ["eviction", "lockout", "locked out", "no place to live"],
  "Child safety concern flagged": ["child safety", "abuse", "custody emergency", "child in danger"],
  "Possible court deadline": ["court date", "hearing date", "filing deadline", "order of protection"],
};

function trackQuery(topic, snippet) {
  try {
    const existing = JSON.parse(localStorage.getItem(QUERY_HISTORY_KEY) || "[]");
    const entry = {
      topic: topic || "general",
      snippet: String(snippet || "").slice(0, 100),
      ts: Date.now(),
    };
    localStorage.setItem(QUERY_HISTORY_KEY, JSON.stringify([entry, ...existing].slice(0, 30)));
  } catch (e) { /* ignore */ }
}

function formatTimeAgo(ts) {
  if (!ts) return "";
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getConfidenceLevel(content) {
  if (!content) return null;
  const lower = content.toLowerCase();
  const highSignals = ["must", "required by law", "statute", "under illinois law", "code requires", "legally required", "court order requires"];
  const lowSignals = ["consult an attorney", "varies by", "depends on the judge", "may or may not", "case by case", "unclear", "speak with a lawyer", "recommend you speak"];
  const highCount = highSignals.filter(w => lower.includes(w)).length;
  const lowCount = lowSignals.filter(w => lower.includes(w)).length;
  if (lowCount >= 2 || (lowCount > 0 && lowCount > highCount)) return { level: "Low", color: "#b45309", bg: "#fef3c7" };
  if (highCount >= 2) return { level: "High", color: "#047857", bg: "#d1fae5" };
  return { level: "Medium", color: "#1d4ed8", bg: "#eff6ff" };
}

/* ─── Dashboard Sidebar ─────────────────────────────────────────── */

function DashboardSidebar({ topic, intakeId, onClose }) {
  const history = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(QUERY_HISTORY_KEY) || "[]"); } catch { return []; }
  }, []);

  const topicCounts = useMemo(() => {
    const c = {};
    history.forEach(h => { c[h.topic] = (c[h.topic] || 0) + 1; });
    return c;
  }, [history]);

  const maxCount = Math.max(1, ...Object.values(topicCounts));

  const riskAlerts = useMemo(() => {
    const recentText = history.slice(0, 10).map(h => h.snippet.toLowerCase()).join(" ");
    return Object.entries(RISK_KEYWORDS)
      .filter(([, kws]) => kws.some(k => recentText.includes(k)))
      .map(([label]) => label);
  }, [history]);

  const hasSavedSession = !!intakeId || localStorage.getItem(INTAKE_SAVED_KEY) === "1";

  const stats = [
    { value: history.length, label: "Total Queries" },
    { value: hasSavedSession ? "Active" : "Guest", label: "Session" },
    { value: Object.keys(topicCounts).length, label: "Topics" },
    { value: TOPIC_LABELS[topic] || "General", label: "Current", highlight: true },
  ];

  return (
    <aside className="w-64 shrink-0 border-r border-border bg-card overflow-y-auto flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <FaBalanceScale className="text-foreground text-sm" />
        <span className="font-semibold text-sm text-foreground">Legal Dashboard</span>
        {onClose && (
          <button
            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
            onClick={onClose}
            type="button"
            aria-label="Close dashboard"
          >
            <FaTimes className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 p-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`rounded-xl p-3 text-center ${s.highlight ? "bg-foreground text-background" : "bg-muted"}`}
          >
            <div className={`text-sm font-bold truncate ${s.highlight ? "text-background" : "text-foreground"}`}>{s.value}</div>
            <div className={`text-[10px] mt-0.5 ${s.highlight ? "text-background/70" : "text-muted-foreground"}`}>{s.label}</div>
          </div>
        ))}
      </div>

      {riskAlerts.length > 0 && (
        <div className="px-3 pb-3">
          <p className="text-[10px] font-semibold text-destructive uppercase tracking-wide mb-2 flex items-center gap-1">
            <FaExclamationTriangle /> Risk Alerts
          </p>
          {riskAlerts.map((alert, i) => (
            <div key={i} className="text-xs bg-destructive/10 text-destructive rounded-lg px-2 py-1.5 mb-1 leading-snug">{alert}</div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div className="px-3 pb-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recent Queries</p>
          {history.slice(0, 6).map((item, i) => (
            <div key={i} className="mb-2.5">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-medium text-foreground truncate">{TOPIC_LABELS[item.topic] || item.topic}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{formatTimeAgo(item.ts)}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{item.snippet || "—"}</p>
            </div>
          ))}
        </div>
      )}

      {Object.keys(topicCounts).length > 0 && (
        <div className="px-3 pb-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Topic Breakdown</p>
          {Object.entries(topicCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([t, count]) => (
              <div key={t} className="flex items-center gap-2 mb-2">
                <span className="text-xs text-foreground w-20 shrink-0 truncate">{TOPIC_LABELS[t] || t}</span>
                <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                  <div className="h-full bg-foreground rounded-full" style={{ width: `${(count / maxCount) * 100}%` }} />
                </div>
                <span className="text-xs text-muted-foreground w-4 text-right">{count}</span>
              </div>
            ))}
        </div>
      )}

      {history.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 text-center">
          <div className="text-3xl mb-3">💼</div>
          <p className="text-xs text-muted-foreground leading-relaxed">Start a conversation to see your legal activity here.</p>
        </div>
      )}

      <div className="mt-auto px-4 py-3 text-[10px] text-muted-foreground border-t border-border leading-relaxed">
        AI responses are for informational purposes only and do not constitute legal advice.
      </div>
    </aside>
  );
}

/* ─── Main AIChat Component ─────────────────────────────────────── */

const AIChat = ({ topic, onBack, intakeId = null, isDiscreetMode = false, useCalDark = true }) => {
  const { t, i18n } = useTranslation();

  const [messages, setMessages] = useState([
    { role: "assistant", content: t("ai.placeholder") },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [requestError, setRequestError] = useState("");

  const [streamingContent, setStreamingContent] = useState(null);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [showDashboard, setShowDashboard] = useState(false);

  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const messagesEndRef = useRef(null);
  const streamTimerRef = useRef(null);
  const inputRef = useRef(null);

  const speechSupported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance !== "undefined";

  const apiUrl = (path) => {
    const base = getApiBaseUrl();
    return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  };

  const fetchWithTimeout = (url, options = {}, timeout = 8000) =>
    Promise.race([
      fetch(typeof url === "string" ? rewriteLegacyRenderFetchUrl(url) : url, options),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Request timeout")), timeout)
      ),
    ]);

  useEffect(() => {
    if (messages.length === 1 && messages[0]?.role === "assistant") {
      setMessages([{ role: "assistant", content: t("ai.placeholder") }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  useEffect(() => {
    const handleEscExit = (e) => {
      if (e.key === "Escape") quickExit();
    };
    window.addEventListener("keydown", handleEscExit);
    return () => window.removeEventListener("keydown", handleEscExit);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading, streamingContent]);

  useEffect(() => {
    return () => {
      if (speechSupported) window.speechSynthesis.cancel();
      clearTimeout(streamTimerRef.current);
    };
  }, [speechSupported]);

  useEffect(() => {
    if (!speechEnabled || !messages.length) return;
    const last = messages[messages.length - 1];
    if (last?.role === "assistant" && last?.content) speakText(last.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, speechEnabled]);

  const renderMessageContent = (content) => {
    const rawHtml = marked.parse(content || "", { breaks: true });
    const cleanHtml = DOMPurify.sanitize(rawHtml);
    return { __html: cleanHtml };
  };

  const streamText = (fullText, onComplete) => {
    setStreamingContent("");
    let i = 0;
    const tick = () => {
      const chunk = Math.ceil(Math.random() * 6 + 3);
      i = Math.min(i + chunk, fullText.length);
      setStreamingContent(fullText.slice(0, i));
      if (i >= fullText.length) {
        streamTimerRef.current = setTimeout(() => {
          setStreamingContent(null);
          onComplete(fullText);
        }, 80);
      } else {
        streamTimerRef.current = setTimeout(tick, 18);
      }
    };
    streamTimerRef.current = setTimeout(tick, 120);
  };

  const stopSpeaking = () => {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  const speakText = (text) => {
    if (!speechSupported || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(String(text));
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const clearAIConversation = () => {
    stopSpeaking();
    clearTimeout(streamTimerRef.current);
    setStreamingContent(null);
    setMessages([{ role: "assistant", content: t("ai.placeholder") }]);
    setInputValue("");
    setRequestError("");
  };

  const quickExit = () => {
    try {
      stopSpeaking();
      clearTimeout(streamTimerRef.current);
      window.location.replace("https://www.google.com");
    } catch (e) {
      window.location.href = "https://www.google.com";
    }
  };

  const copyMessage = async (content, idx) => {
    try {
      const plain = content.replace(/[#*`_~]/g, "").replace(/\n{3,}/g, "\n\n");
      await navigator.clipboard.writeText(plain);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch (e) { /* ignore */ }
  };

  const regenerateAnswer = () => {
    const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
    if (!lastUserMsg || isLoading || streamingContent !== null) return;

    const withoutLastAssistant = [...messages];
    for (let i = withoutLastAssistant.length - 1; i >= 0; i--) {
      if (withoutLastAssistant[i].role === "assistant") {
        withoutLastAssistant.splice(i, 1);
        break;
      }
    }
    setMessages(withoutLastAssistant);
    sendMessageWithHistory(withoutLastAssistant);
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading || streamingContent !== null) return;
    setRequestError("");

    const userContent = inputValue.trim();
    const userMessage = { role: "user", content: userContent };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInputValue("");
    trackQuery(topic || "general", userContent);

    await sendMessageWithHistory(updatedMessages);
  };

  const sendMessageWithHistory = async (history) => {
    setIsLoading(true);
    setRequestError("");

    try {
      const response = await fetchWithTimeout(
        apiUrl("/ai-chat"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history.map((m) => ({ role: m.role, content: m.content })),
            topic: topic || "general",
            language: getNormalizedLanguage(),
            intake_id: intakeId || null,
          }),
        },
        AI_CHAT_FETCH_TIMEOUT_MS
      );

      if (!response.ok) {
        let detail = "";
        try {
          const payload = await response.json();
          detail = payload?.detail ? String(payload.detail) : "";
        } catch (e) {
          detail = String((await response.text()) || "").trim();
        }
        throw new Error(detail || `Unable to process request right now (status ${response.status}).`);
      }

      const data = await response.json();
      const fullContent =
        data.response ||
        "I'm sorry, I couldn't generate a response right now. Please try again.";

      setIsLoading(false);

      streamText(fullContent, (completed) => {
        setMessages((prev) => [...prev, { role: "assistant", content: completed }]);
      });
    } catch (error) {
      console.error("AI request failed:", error);
      const errorContent = isDiscreetMode
        ? "I'm having trouble connecting right now. Please try again in a moment, or use the support contact information below."
        : "I'm having trouble connecting right now. Please try again in a moment, or contact Chicago Advocate Legal, NFP directly using the information below.";

      setRequestError(
        error?.message && String(error.message).trim().length > 0
          ? String(error.message)
          : "Unable to connect to the AI assistant right now."
      );
      setMessages((prev) => [...prev, { role: "assistant", content: errorContent }]);
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const headerTitle = isDiscreetMode ? "Support Assistant" : t("ai.title");
  const helpText = isDiscreetMode
    ? "Need immediate help? Contact support:"
    : "Need immediate help? Contact:";
  const orgLabel = isDiscreetMode ? "Support Team:" : "Chicago Advocate Legal, NFP:";

  const lastAssistantIdx = messages.map((m) => m.role).lastIndexOf("assistant");
  const hasUserMessages = messages.some((m) => m.role === "user");
  const isBusy = isLoading || streamingContent !== null;

  const toolbarBtn = "flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5 font-medium transition-colors";

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {showDashboard && !isDiscreetMode && (
        <DashboardSidebar
          topic={topic}
          intakeId={intakeId}
          onClose={() => setShowDashboard(false)}
        />
      )}

      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="border-b border-border bg-background/95 px-4 py-3 shrink-0">
          <div className="flex items-center gap-3 mb-2.5">
            <button
              onClick={onBack}
              type="button"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <FaArrowLeft className="w-3 h-3" /> {t("ai.back")}
            </button>

            <div className="flex items-center gap-2 mx-auto">
              <span aria-hidden>⚖️</span>
              <h2 className="font-semibold text-sm text-foreground">{headerTitle}</h2>
              {!isDiscreetMode && (
                <span className="text-[10px] bg-foreground text-background px-2 py-0.5 rounded-full font-medium">
                  Legal AI
                </span>
              )}
            </div>

            {!isDiscreetMode && (
              <button
                type="button"
                onClick={() => setShowDashboard((v) => !v)}
                className={`text-sm px-2 py-1 rounded-lg transition-colors shrink-0 ${showDashboard ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                title="Toggle dashboard"
                aria-pressed={showDashboard}
              >
                <FaChartBar />
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              className={`${toolbarBtn} bg-destructive/10 text-destructive hover:bg-destructive/20`}
              onClick={quickExit}
            >
              <FaSignOutAlt /> Quick Exit
            </button>
            <button
              type="button"
              className={`${toolbarBtn} bg-muted text-muted-foreground hover:text-foreground`}
              onClick={clearAIConversation}
            >
              <FaTrashAlt /> Clear
            </button>
            {hasUserMessages && !isBusy && (
              <button
                type="button"
                className={`${toolbarBtn} bg-muted text-muted-foreground hover:text-foreground`}
                onClick={regenerateAnswer}
              >
                <FaRedo /> Regenerate
              </button>
            )}
            {speechSupported && (
              <button
                type="button"
                className={`${toolbarBtn} bg-muted text-muted-foreground hover:text-foreground`}
                onClick={() => {
                  if (speechEnabled) { stopSpeaking(); setSpeechEnabled(false); }
                  else setSpeechEnabled(true);
                }}
              >
                {speechEnabled ? <><FaStop /> Mute</> : <><FaVolumeUp /> Read Aloud</>}
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {requestError && (
            <StatusBanner type="error" role="alert" className="mb-2">
              {requestError}
            </StatusBanner>
          )}

          {messages.map((message, index) => {
            const isUser = message.role === "user";
            const isLastAssistant = !isUser && index === lastAssistantIdx;
            const confidence = !isUser ? getConfidenceLevel(message.content) : null;

            if (isUser) {
              return (
                <div key={index} className="flex justify-end">
                  <div className="flex items-end gap-2 max-w-[80%] xl:max-w-2xl">
                    <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-md px-4 py-3 text-sm leading-relaxed">
                      {message.content}
                    </div>
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs text-muted-foreground mb-0.5">
                      <FaUser />
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={index} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center shrink-0 mt-0.5 text-xs">
                  <FaBalanceScale />
                </div>
                <div className="max-w-[80%] xl:max-w-2xl min-w-0">
                  <div
                    className="bg-muted rounded-2xl rounded-tl-md px-4 py-3 text-sm text-foreground leading-relaxed prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={renderMessageContent(message.content)}
                  />
                  <div className="flex items-center flex-wrap gap-2 mt-1.5 px-1">
                    {confidence && !isDiscreetMode && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium border"
                        style={{ color: confidence.color, background: confidence.bg, borderColor: confidence.color + "33" }}
                      >
                        ⚖️ Confidence: {confidence.level}
                      </span>
                    )}
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => copyMessage(message.content, index)}
                      title="Copy response"
                    >
                      {copiedIdx === index ? <><FaCheck /> Copied</> : <><FaCopy /> Copy</>}
                    </button>
                    {speechSupported && (
                      <button
                        type="button"
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => speakText(message.content)}
                        title="Read aloud"
                      >
                        <FaVolumeUp /> Read
                      </button>
                    )}
                    {isLastAssistant && hasUserMessages && !isBusy && (
                      <button
                        type="button"
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={regenerateAnswer}
                        title="Regenerate answer"
                      >
                        <FaRedo /> Regenerate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Streaming bubble */}
          {streamingContent !== null && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center shrink-0 mt-0.5 text-xs">
                <FaBalanceScale />
              </div>
              <div className="max-w-[80%] xl:max-w-2xl min-w-0">
                <div className="bg-muted rounded-2xl rounded-tl-md px-4 py-3 text-sm text-foreground leading-relaxed prose prose-sm max-w-none relative">
                  <div dangerouslySetInnerHTML={renderMessageContent(streamingContent)} />
                  <span
                    className="inline-block w-0.5 h-4 bg-foreground ml-0.5 animate-pulse align-middle"
                    aria-hidden
                  />
                </div>
              </div>
            </div>
          )}

          {/* Typing indicator */}
          {isLoading && streamingContent === null && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center shrink-0 mt-0.5 text-xs">
                <FaBalanceScale />
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-md px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "-0.3s" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "-0.15s" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">AI is thinking…</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border bg-background px-4 pt-3 pb-4 shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("ai.placeholder")}
              className="flex-1 min-h-[44px] max-h-40 resize-none rounded-2xl py-2.5 px-3 text-sm leading-relaxed border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 disabled:opacity-50"
              rows={2}
              disabled={isBusy}
              aria-label="Message input"
            />
            <button
              onClick={sendMessage}
              disabled={isBusy || !inputValue.trim()}
              type="button"
              title="Send message"
              aria-label="Send"
              className="w-11 h-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              {isLoading
                ? <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                : <FaPaperPlane className="w-3.5 h-3.5" />
              }
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            <kbd className="text-[10px] border border-border rounded px-1 py-0.5">Enter</kbd>
            {" "}to send · {" "}
            <kbd className="text-[10px] border border-border rounded px-1 py-0.5">Shift+Enter</kbd>
            {" "}for new line
          </p>
        </div>

        {/* Footer */}
        <div className="border-t border-border bg-muted/30 px-4 py-3 shrink-0">
          <p className="text-xs text-muted-foreground mb-2">{helpText}</p>
          <div className="space-y-1">
            <p className="text-xs text-foreground">
              <strong>{orgLabel}</strong>{" "}
              <a href="tel:+13128015918" className="hover:underline">(312) 801-5918</a>
              {" | "}
              <a
                href="https://www.chicagoadvocatelegal.com/intake.html"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                Direct Intake Form
              </a>
            </p>
            <p className="text-xs text-foreground">
              <strong>Email:</strong>{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:underline">{SUPPORT_EMAIL}</a>
            </p>
            <p className="text-xs text-foreground">
              <strong>Justice Entrepreneurs Project (JEP):</strong>{" "}
              <a href="tel:+13125463282" className="hover:underline">(312) 546-3282</a>
              {" | "}
              <a
                href="https://jepchicago.org/connect-with-a-lawyer/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                Find a Lawyer
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChat;
