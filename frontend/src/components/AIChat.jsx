import React, { useState, useEffect, useRef, useMemo } from "react";
import "./AIChat.css";
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

  return (
    <aside className="ai-dashboard-sidebar">
      <div className="ai-dashboard-sidebar-header">
        <FaBalanceScale className="db-header-icon" />
        <span>Legal Dashboard</span>
        {onClose && (
          <button className="db-close-btn" onClick={onClose} type="button" aria-label="Close dashboard">
            <FaTimes />
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="db-stats-grid">
        <div className="db-stat-card">
          <div className="db-stat-value">{history.length}</div>
          <div className="db-stat-label">Total Queries</div>
        </div>
        <div className="db-stat-card">
          <div className="db-stat-value">{hasSavedSession ? "Active" : "Guest"}</div>
          <div className="db-stat-label">Session</div>
        </div>
        <div className="db-stat-card">
          <div className="db-stat-value">{Object.keys(topicCounts).length}</div>
          <div className="db-stat-label">Topics</div>
        </div>
        <div className="db-stat-card highlight">
          <div className="db-stat-value">{TOPIC_LABELS[topic] || "General"}</div>
          <div className="db-stat-label">Current</div>
        </div>
      </div>

      {/* Risk Alerts */}
      {riskAlerts.length > 0 && (
        <div className="db-section">
          <div className="db-section-title danger">
            <FaExclamationTriangle /> Risk Alerts
          </div>
          {riskAlerts.map((alert, i) => (
            <div key={i} className="db-alert-item">{alert}</div>
          ))}
        </div>
      )}

      {/* Recent Queries */}
      {history.length > 0 && (
        <div className="db-section">
          <div className="db-section-title">Recent Queries</div>
          {history.slice(0, 6).map((item, i) => (
            <div key={i} className="db-query-item">
              <span className="db-query-topic">{TOPIC_LABELS[item.topic] || item.topic}</span>
              <span className="db-query-text">{item.snippet || "—"}</span>
              <span className="db-query-time">{formatTimeAgo(item.ts)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Topic Breakdown */}
      {Object.keys(topicCounts).length > 0 && (
        <div className="db-section">
          <div className="db-section-title">Topic Breakdown</div>
          {Object.entries(topicCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([t, count]) => (
              <div key={t} className="db-topic-row">
                <span className="db-topic-name">{TOPIC_LABELS[t] || t}</span>
                <div className="db-topic-bar-wrap">
                  <div className="db-topic-bar" style={{ width: `${(count / maxCount) * 100}%` }} />
                </div>
                <span className="db-topic-count">{count}</span>
              </div>
            ))}
        </div>
      )}

      {history.length === 0 && (
        <div className="db-empty">
          <div className="db-empty-icon">💼</div>
          <p>Start a conversation to see your legal activity here.</p>
        </div>
      )}

      <div className="db-footer-note">
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

  const urlDiscreet =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("mode") === "discreet";
  const showCalDarkChrome = useCalDark && !isDiscreetMode && !urlDiscreet;

  const lastAssistantIdx = messages.map((m) => m.role).lastIndexOf("assistant");
  const hasUserMessages = messages.some((m) => m.role === "user");
  const isBusy = isLoading || streamingContent !== null;

  return (
    <div className={`ai-chat-page${showCalDarkChrome ? " cal-app-dark" : ""}`}>
      <div className="ai-chat-container">

        {/* Dashboard Sidebar */}
        {showDashboard && !isDiscreetMode && (
          <DashboardSidebar
            topic={topic}
            intakeId={intakeId}
            onClose={() => setShowDashboard(false)}
          />
        )}

        {/* Main chat column */}
        <div className="ai-chat-main">

          {/* Header */}
          <div className="ai-chat-header">
            <div className="ai-header-top">
              <button onClick={onBack} className="back-button" type="button">
                <FaArrowLeft /> {t("ai.back")}
              </button>

              <div className="ai-header-title-group">
                <span className="ai-header-icon" aria-hidden>⚖️</span>
                <h2>{headerTitle}</h2>
                {!isDiscreetMode && (
                  <span className="ai-header-badge">Legal AI</span>
                )}
              </div>

              <div className="ai-header-actions">
                {!isDiscreetMode && (
                  <button
                    type="button"
                    className={`ai-toolbar-button icon-btn${showDashboard ? " active" : ""}`}
                    onClick={() => setShowDashboard((v) => !v)}
                    title="Toggle dashboard"
                    aria-pressed={showDashboard}
                  >
                    <FaChartBar />
                  </button>
                )}
              </div>
            </div>

            <div className="ai-toolbar">
              <button type="button" className="ai-toolbar-button danger" onClick={quickExit}>
                <FaSignOutAlt /> Quick Exit
              </button>

              <button type="button" className="ai-toolbar-button neutral" onClick={clearAIConversation}>
                <FaTrashAlt /> Clear
              </button>

              {hasUserMessages && !isBusy && (
                <button type="button" className="ai-toolbar-button regen" onClick={regenerateAnswer}>
                  <FaRedo /> Regenerate
                </button>
              )}

              {speechSupported && (
                <button
                  type="button"
                  className="ai-toolbar-button dark"
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
          <div className="ai-chat-messages">
            {requestError && (
              <StatusBanner type="error" className="ai-status-banner" role="alert">
                {requestError}
              </StatusBanner>
            )}

            {messages.map((message, index) => {
              const isUser = message.role === "user";
              const isLastAssistant = !isUser && index === lastAssistantIdx;
              const confidence = !isUser ? getConfidenceLevel(message.content) : null;

              return (
                <div
                  key={index}
                  className={`ai-message ${isUser ? "user-message" : "assistant-message"}`}
                >
                  {!isUser && (
                    <div className="ai-avatar" aria-hidden>
                      <FaBalanceScale />
                    </div>
                  )}

                  <div className="ai-message-body">
                    <div
                      className="message-content"
                      dangerouslySetInnerHTML={renderMessageContent(message.content)}
                    />

                    {!isUser && (
                      <div className="ai-message-meta">
                        {confidence && !isDiscreetMode && (
                          <span
                            className="ai-confidence-badge"
                            style={{ color: confidence.color, background: confidence.bg }}
                          >
                            ⚖️ Confidence: {confidence.level}
                          </span>
                        )}

                        <div className="ai-message-actions">
                          <button
                            type="button"
                            className={`ai-action-btn${copiedIdx === index ? " copied" : ""}`}
                            onClick={() => copyMessage(message.content, index)}
                            title="Copy response"
                          >
                            {copiedIdx === index ? <><FaCheck /> Copied</> : <><FaCopy /> Copy</>}
                          </button>

                          {speechSupported && (
                            <button
                              type="button"
                              className="ai-action-btn"
                              onClick={() => speakText(message.content)}
                              title="Read aloud"
                            >
                              <FaVolumeUp /> Read
                            </button>
                          )}

                          {isLastAssistant && hasUserMessages && !isBusy && (
                            <button
                              type="button"
                              className="ai-action-btn regen"
                              onClick={regenerateAnswer}
                              title="Regenerate answer"
                            >
                              <FaRedo /> Regenerate
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {isUser && (
                    <div className="user-avatar" aria-hidden>
                      <FaUser />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Streaming message bubble */}
            {streamingContent !== null && (
              <div className="ai-message assistant-message streaming">
                <div className="ai-avatar" aria-hidden>
                  <FaBalanceScale />
                </div>
                <div className="ai-message-body">
                  <div
                    className="message-content streaming-content"
                    dangerouslySetInnerHTML={renderMessageContent(streamingContent)}
                  />
                  <span className="streaming-cursor" aria-hidden />
                </div>
              </div>
            )}

            {/* Typing indicator while fetching */}
            {isLoading && streamingContent === null && (
              <div className="ai-message assistant-message">
                <div className="ai-avatar" aria-hidden>
                  <FaBalanceScale />
                </div>
                <div className="ai-message-body">
                  <div className="message-content">
                    <div className="typing-indicator">
                      <span /><span /><span />
                    </div>
                  </div>
                  <div className="ai-typing-label">AI is thinking…</div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="ai-chat-input-container">
            <div className="ai-input-wrapper">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("ai.placeholder")}
                className="ai-chat-input"
                rows={2}
                disabled={isBusy}
                aria-label="Message input"
              />
              <button
                onClick={sendMessage}
                disabled={isBusy || !inputValue.trim()}
                className="ai-send-button"
                type="button"
                title="Send message"
                aria-label="Send"
              >
                {isLoading ? <span className="ai-spinner" /> : <FaPaperPlane />}
              </button>
            </div>
            <div className="ai-input-hint">
              <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for new line
            </div>
          </div>

          {/* Footer */}
          <div className="ai-chat-footer">
            <p className="help-text">{helpText}</p>
            <div className="footer-contacts">
              <div className="footer-contact-item">
                <strong>{orgLabel}</strong>{" "}
                <a href="tel:+13128015918">(312) 801-5918</a>
                {" | "}
                <a
                  href="https://www.chicagoadvocatelegal.com/intake.html"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Direct Intake Form
                </a>
              </div>
              <div className="footer-contact-item">
                <strong>Email:</strong>{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
              </div>
              <div className="footer-contact-item">
                <strong>Justice Entrepreneurs Project (JEP):</strong>{" "}
                <a href="tel:+13125463282">(312) 546-3282</a>
                {" | "}
                <a
                  href="https://jepchicago.org/connect-with-a-lawyer/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Find a Lawyer
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChat;
