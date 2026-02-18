import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import {
  FaGavel,
  FaPaperPlane,
  FaRedo,
  FaPhone,
  FaFileAlt,
  FaInfoCircle,
  FaRobot,
  FaArrowLeft,
} from "react-icons/fa";
import "./App.css";
import EmergencyButton from "./components/EmergencyButton";

import { useTranslation } from "react-i18next";
import { setAppLanguage, getNormalizedLanguage } from "./i18n";

const AIChat = lazy(() => import("./components/AIChat"));

const STORAGE_KEY = "cal_chatbot_state_v1";
const FIRST_VISIT_KEY = "cal_first_visit_done_v1";

const INTAKE_ID_KEY = "cal_intake_id_v1";
const INTAKE_SAVED_KEY = "cal_intake_saved_v1";

const API_BASE = String(
  import.meta.env.VITE_API_BASE_URL ?? "https://court-legal-chatbot.onrender.com"
).replace(/\/+$/, "");

function isValidEmail(email) {
  const v = String(email || "").trim();
  return v.includes("@") && v.includes(".");
}

function normalizePhoneDigits(phone) {
  const digits = String(phone || "").replace(/[^0-9]/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

function isValidUSPhone(phone) {
  const digits = normalizePhoneDigits(phone);
  return digits.length === 10;
}

function isValidZip(zip) {
  return /^\d{5}$/.test(String(zip || "").trim());
}

function App() {
  const { t, i18n } = useTranslation();
  const normalizedLang = getNormalizedLanguage();

  // Always start at chooser
  const [view, setView] = useState("intakeChoice"); // intakeChoice | intake | privacy | cover | chat
  const [loading, setLoading] = useState(false);

  const [showChat, setShowChat] = useState(
    () => localStorage.getItem(FIRST_VISIT_KEY) === "1"
  );
  const [showAIChat, setShowAIChat] = useState(false);

  const [messages, setMessages] = useState([]);
  const [conversationState, setConversationState] = useState({});
  const [conversationHistory, setConversationHistory] = useState([]);

  const [userInput, setUserInput] = useState("");
  const [currentTopic, setCurrentTopic] = useState("");

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Intake form state
  const [intakeId, setIntakeId] = useState(
    () => localStorage.getItem(INTAKE_ID_KEY) || ""
  );
  const [intakeSaved, setIntakeSaved] = useState(
    () => localStorage.getItem(INTAKE_SAVED_KEY) === "1"
  );

  const [intakeFirstName, setIntakeFirstName] = useState("");
  const [intakeLastName, setIntakeLastName] = useState("");
  const [intakeEmail, setIntakeEmail] = useState("");
  const [intakePhone, setIntakePhone] = useState("");
  const [intakeZip, setIntakeZip] = useState("");
  const [intakeConsent, setIntakeConsent] = useState(false);

  const [intakeError, setIntakeError] = useState("");

  const apiUrl = (path) => `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  // QR-safe mode: ?fresh=1 always starts fresh (cover + chat reset)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fresh = params.get("fresh") === "1";

    if (fresh) {
      localStorage.removeItem(FIRST_VISIT_KEY);
      localStorage.removeItem(STORAGE_KEY);

      setShowAIChat(false);
      setShowChat(false);
      setMessages([]);
      setConversationState({});
      setConversationHistory([]);
      setUserInput("");
      setCurrentTopic("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set html attributes (LTR)
  useEffect(() => {
    document.documentElement.setAttribute("dir", "ltr");
    document.documentElement.setAttribute("lang", normalizedLang);
  }, [i18n.language, i18n.resolvedLanguage, normalizedLang]);

  // Ensure we always start on chooser view
  useEffect(() => {
    setView("intakeChoice");
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages]);

  // Restore chat session
  useEffect(() => {
    if (!showChat) return;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const saved = JSON.parse(raw);

      if (Array.isArray(saved?.messages)) setMessages(saved.messages);
      if (saved?.conversationState && typeof saved.conversationState === "object") {
        setConversationState(saved.conversationState);
        if (saved.conversationState.topic) {
          setCurrentTopic(String(saved.conversationState.topic).replace("_", " "));
        }
      }
      if (Array.isArray(saved?.conversationHistory)) setConversationHistory(saved.conversationHistory);
    } catch (e) {
      console.error("Failed to restore session:", e);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [showChat]);

  // Persist chat session
  useEffect(() => {
    if (!showChat) return;

    try {
      const payload = {
        messages,
        conversationState,
        conversationHistory,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error("Failed to persist session:", e);
    }
  }, [showChat, messages, conversationState, conversationHistory]);

  const LanguagePicker = ({ variant = "light" }) => {
    const isDark = variant === "dark";
    const style = {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      justifyContent: "center",
      marginTop: isDark ? 0 : "14px",
      marginBottom: isDark ? 0 : "6px",
      color: isDark ? "white" : "#1f2937",
      fontWeight: 700,
      fontSize: "0.95rem",
      flexWrap: "wrap",
    };

    const selectStyle = {
      padding: "8px 10px",
      borderRadius: "10px",
      border: "2px solid rgba(229,231,235,1)",
      background: "white",
      fontWeight: 700,
      cursor: "pointer",
      color: "#111827",
    };

    return (
      <div style={style}>
        <span>{t("lang.label")}:</span>
        <select
          value={normalizedLang}
          onChange={(e) => setAppLanguage(e.target.value)}
          style={selectStyle}
          aria-label={t("lang.label")}
        >
          <option value="en">{t("lang.english")}</option>
          <option value="es">{t("lang.spanish")}</option>
        </select>
      </div>
    );
  };

  const optionLabel = (optionCode) => {
    if (["child_support", "education", "housing", "divorce", "custody"].includes(optionCode)) {
      return t(`triage.options.topic_${optionCode}`);
    }

    const map = {
      yes: "triage.options.yes",
      no: "triage.options.no",
      unknown: "triage.options.unknown",
      not_sure: "triage.options.notSure",
      continue: "triage.options.continue",
      restart: "triage.options.restart",
      connect: "triage.options.connect",
      continue_to_legal_resources: "triage.options.continueToLegalResources",
    };

    const key = map[String(optionCode || "").toLowerCase()];
    return key ? t(key) : String(optionCode);
  };

  const renderBotText = (msg) => {
    if (!msg) return "";

    if (typeof msg.content === "string" && msg.content.trim().length > 0) return msg.content;

    if (msg.response_key) {
      const params =
        msg.response_params && typeof msg.response_params === "object" ? msg.response_params : {};
      const hydrated = { ...params };

      if (hydrated.topic && !hydrated.topicLabel) {
        hydrated.topicLabel = t(`triage.options.topic_${hydrated.topic}`);
      }

      return t(msg.response_key, hydrated);
    }

    return "";
  };

  const clearSavedIntake = () => {
    setIntakeId("");
    setIntakeSaved(false);
    localStorage.removeItem(INTAKE_ID_KEY);
    localStorage.removeItem(INTAKE_SAVED_KEY); // removeItem deletes a specific key
  };

  const postIntakeEvent = async (eventType, eventValue) => {
    if (!intakeId) return;
    try {
      await fetch(apiUrl("/intake/event"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intake_id: intakeId,
          event_type: eventType,
          event_value: eventValue || "",
        }),
      });
    } catch (e) {
      // best-effort
    }
  };

  const sendMessage = async (message, isBackAction = false) => {
    setLoading(true);

    const userMessage = { role: "user", content: message };
    setMessages((prev) => [...prev, userMessage]);
    setUserInput("");

    try {
      const response = await fetch(apiUrl("/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: String(message).toLowerCase(),
          conversation_state: conversationState,
          language: normalizedLang,
          intake_id: intakeId || null,
        }),
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const data = await response.json();

      if (data.conversation_state && data.conversation_state.topic) {
        const topicCode = String(data.conversation_state.topic);
        setCurrentTopic(topicCode.replace("_", " "));
        if (conversationState?.step === "topic_selection") {
          postIntakeEvent("topic_selected", topicCode);
        }
      }

      const botMessage = {
        role: "bot",
        content: data.response || "",
        response_key: data.response_key,
        response_params: data.response_params,
        options: data.options || [],
        referrals: data.referrals || [],
      };

      setMessages((prev) => [...prev, botMessage]);

      const newState = {
        ...(data.conversation_state || {}),
        progress: data.progress || (data.conversation_state?.progress ?? {}),
      };
      setConversationState(newState);

      if (!isBackAction && data.conversation_state) {
        setConversationHistory((prev) => [
          ...prev,
          {
            state: newState,
            allMessages: [...messages, userMessage, botMessage],
          },
        ]);
      }
    } catch (error) {
      console.error("Connection error details:", error);
      setMessages((prev) => [...prev, { role: "bot", content: t("chat.serverDown"), options: [] }]);
    }

    setLoading(false);
  };

  const startChatFromCover = () => {
    if (loading) return;
    localStorage.setItem(FIRST_VISIT_KEY, "1");
    setShowChat(true);
    setView("chat");
    sendMessage("start");
  };

  const goToCover = () => {
    setShowAIChat(false);
    setShowChat(false);
    setView("cover");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (userInput.trim() && !loading) sendMessage(userInput.trim());
  };

  const handleOptionClick = (optionCode) => {
    if (!loading) sendMessage(optionCode);
  };

  const handleRestart = () => {
    setMessages([]);
    setConversationState({});
    setConversationHistory([]);
    setUserInput("");
    setCurrentTopic("");
    setShowAIChat(false);

    localStorage.removeItem(STORAGE_KEY);

    setShowChat(true);
    setView("chat");
    sendMessage("start");
  };

  const handleBack = () => {
    if (conversationHistory.length < 2) {
      goToCover();
      return;
    }

    const newHistory = conversationHistory.slice(0, -1);
    const previousState = newHistory[newHistory.length - 1];

    setConversationHistory(newHistory);
    setConversationState(previousState.state);
    setMessages(previousState.allMessages);
  };

  const submitIntake = async () => {
    setIntakeError("");

    if (!intakeConsent) {
      setIntakeError(t("intake.consentRequired"));
      return;
    }
    if (!intakeFirstName.trim() || !intakeLastName.trim()) {
      setIntakeError(t("intake.serverError"));
      return;
    }
    if (!isValidEmail(intakeEmail)) {
      setIntakeError(t("intake.invalidEmail"));
      return;
    }
    if (!isValidUSPhone(intakePhone)) {
      setIntakeError(t("intake.invalidPhone"));
      return;
    }
    if (!isValidZip(intakeZip)) {
      setIntakeError(t("intake.invalidZip"));
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(apiUrl("/intake/start"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: intakeFirstName.trim(),
          last_name: intakeLastName.trim(),
          email: intakeEmail.trim().toLowerCase(),
          phone: intakePhone.trim(),
          zip: intakeZip.trim(),
          language: normalizedLang,
          consent: true,
        }),
      });

      if (!res.ok) throw new Error("intake failed");

      const data = await res.json();

      const newId = data.intake_id;
      setIntakeId(newId);
      setIntakeSaved(true);

      localStorage.setItem(INTAKE_ID_KEY, newId);
      localStorage.setItem(INTAKE_SAVED_KEY, "1");

      setView("cover");
    } catch (e) {
      setIntakeError(t("intake.serverError"));
    } finally {
      setLoading(false);
    }
  };

  // AI chat view
  if (showAIChat) {
    return (
      <Suspense
        fallback={
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
            Loading AI Chat...
          </div>
        }
      >
        <AIChat topic={currentTopic} onBack={() => setShowAIChat(false)} />
      </Suspense>
    );
  }

  // Privacy Notice view
  if (view === "privacy") {
    return (
      <div className="landing">
        <div className="landing-header">
          <div className="logo-container">
            <div className="icon-circle">
              <FaGavel color="#fff" size={50} />
            </div>
            <h1>{t("privacy.title")}</h1>
            <p className="subtitle">{t("app.subtitle")}</p>
            <LanguagePicker />
          </div>
        </div>

        <div className="landing-content">
          <p className="tagline" style={{ textAlign: "left", lineHeight: 1.7 }}>
            {t("privacy.body")}
          </p>

          <button
            className="btn btn-primary btn-large btn-start"
            onClick={() => setView("intakeChoice")}
            disabled={loading}
          >
            {t("privacy.back")}
          </button>
        </div>

        <EmergencyButton />
      </div>
    );
  }

  // Always-first chooser ("login") view
  if (view === "intakeChoice") {
    const hasSaved = intakeSaved && intakeId;

    return (
      <div className="landing">
        <div className="landing-header">
          <div className="logo-container">
            <div className="icon-circle">
              <FaGavel color="#fff" size={50} />
            </div>
            <h1>{t("intake.samePersonTitle")}</h1>
            <p className="subtitle">
              {hasSaved ? t("intake.samePersonBody") : "Start a new inquiry to begin."}
            </p>
            <LanguagePicker />
          </div>
        </div>

        <div className="landing-content">
          <button
            className="btn btn-start"
            onClick={() => setView(hasSaved ? "cover" : "intake")}
            disabled={loading}
          >
            {hasSaved ? t("intake.samePerson") : "Start"}
          </button>

          <button
            className="btn btn-start"
            onClick={() => {
              clearSavedIntake();
              setIntakeFirstName("");
              setIntakeLastName("");
              setIntakeEmail("");
              setIntakePhone("");
              setIntakeZip("");
              setIntakeConsent(false);
              setIntakeError("");
              setView("intake");
            }}
            disabled={loading}
            style={{ marginTop: 12, background: "#6b7280" }}
          >
            {t("intake.newInquiry")}
          </button>

          <div style={{ marginTop: 18, textAlign: "center" }}>
            <button
              type="button"
              onClick={() => setView("privacy")}
              style={{
                background: "transparent",
                border: "none",
                color: "#667eea",
                fontWeight: 700,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              {t("intake.privacyLink")}
            </button>
          </div>
        </div>

        <EmergencyButton />
      </div>
    );
  }

  // Intake form view
  if (view === "intake") {
    return (
      <div className="landing">
        <div className="landing-header">
          <div className="logo-container">
            <div className="icon-circle">
              <FaGavel color="#fff" size={50} />
            </div>
            <h1>{t("intake.title")}</h1>
            <p className="subtitle">{t("intake.subtitle")}</p>
            <LanguagePicker />
          </div>
        </div>

        <div className="landing-content">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitIntake();
            }}
          >
            <div style={{ display: "grid", gap: 12 }}>
              <input
                className="chat-input"
                type="text"
                value={intakeFirstName}
                onChange={(e) => setIntakeFirstName(e.target.value)}
                placeholder={t("intake.firstName")}
                disabled={loading}
              />
              <input
                className="chat-input"
                type="text"
                value={intakeLastName}
                onChange={(e) => setIntakeLastName(e.target.value)}
                placeholder={t("intake.lastName")}
                disabled={loading}
              />
              <input
                className="chat-input"
                type="email"
                value={intakeEmail}
                onChange={(e) => setIntakeEmail(e.target.value)}
                placeholder={t("intake.email")}
                disabled={loading}
              />
              <input
                className="chat-input"
                type="tel"
                value={intakePhone}
                onChange={(e) => setIntakePhone(e.target.value)}
                placeholder={t("intake.phone")}
                disabled={loading}
              />
              <input
                className="chat-input"
                type="text"
                value={intakeZip}
                onChange={(e) => setIntakeZip(e.target.value)}
                placeholder={t("intake.zip")}
                disabled={loading}
              />

              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", lineHeight: 1.4, color: "#374151" }}>
                <input
                  type="checkbox"
                  checked={intakeConsent}
                  onChange={(e) => setIntakeConsent(e.target.checked)}
                  disabled={loading}
                  style={{ marginTop: 4 }}
                />
                <span>
                  {t("intake.consentText")}{" "}
                  <button
                    type="button"
                    onClick={() => setView("privacy")}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#667eea",
                      fontWeight: 700,
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                      marginLeft: 6,
                    }}
                  >
                    {t("intake.privacyLink")}
                  </button>
                </span>
              </label>

              {intakeError && (
                <div className="privacy-warning" style={{ marginTop: 6 }}>
                  {intakeError}
                </div>
              )}

              <button className="btn btn-start" type="submit" disabled={loading}>
                {loading ? t("intake.submitting") : t("intake.submit")}
              </button>

              <button
                type="button"
                className="btn btn-start"
                onClick={() => setView("intakeChoice")}
                disabled={loading}
                style={{ background: "#6b7280" }}
              >
                Back
              </button>
            </div>
          </form>
        </div>

        <EmergencyButton />
      </div>
    );
  }

  // Cover view
  if (!showChat || view === "cover") {
    return (
      <div className="landing">
        <div className="landing-header">
          <div className="logo-container">
            <div className="icon-circle">
              <FaGavel color="#fff" size={50} />
            </div>
            <h1>{t("app.title")}</h1>
            <p className="subtitle">{t("app.subtitle")}</p>

            <LanguagePicker />
          </div>
        </div>

        <div className="landing-content">
          <h2>{t("landing.welcomeTitle")}</h2>
          <p className="tagline">{t("landing.tagline")}</p>

          <div className="topic-cards">
            <div className="topic-card">
              <div className="topic-icon">👨‍👩‍👧‍👦</div>
              <h3>{t("landing.topics.childSupportTitle")}</h3>
              <p>{t("landing.topics.childSupportDesc")}</p>
            </div>
            <div className="topic-card">
              <div className="topic-icon">🎓</div>
              <h3>{t("landing.topics.educationTitle")}</h3>
              <p>{t("landing.topics.educationDesc")}</p>
            </div>
            <div className="topic-card">
              <div className="topic-icon">🏠</div>
              <h3>{t("landing.topics.housingTitle")}</h3>
              <p>{t("landing.topics.housingDesc")}</p>
            </div>
            <div className="topic-card">
              <div className="topic-icon">⚖️</div>
              <h3>{t("landing.topics.divorceTitle")}</h3>
              <p>{t("landing.topics.divorceDesc")}</p>
            </div>
            <div className="topic-card">
              <div className="topic-icon">👶🏾</div>
              <h3>{t("landing.topics.custodyTitle")}</h3>
              <p>{t("landing.topics.custodyDesc")}</p>
            </div>
          </div>

          <button className="btn btn-primary btn-large btn-start" onClick={startChatFromCover} disabled={loading}>
            {t("landing.begin")}
          </button>

          <div className="disclaimer-box">
            <p className="disclaimer-title">{t("landing.importantNoticeTitle")}</p>
            <p className="disclaimer-text">
              <strong>{t("landing.infoOnly")}</strong>
            </p>
            <p className="privacy-warning">
              ⚠️ <strong>{t("landing.privacyTitle")}</strong> {t("landing.privacyText")}
            </p>
          </div>

          <div style={{ marginTop: 14, textAlign: "center" }}>
            <button
              type="button"
              onClick={() => setView("intakeChoice")}
              style={{
                background: "transparent",
                border: "none",
                color: "#667eea",
                fontWeight: 700,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Back to Login
            </button>
          </div>
        </div>

        <EmergencyButton />
      </div>
    );
  }

  // Chat view
  const progress = conversationState?.progress || {};
  const progressCurrent = Number(progress.current || 1);
  const progressTotal = Number(progress.total || 5);

  const progressLabel =
    progress.label_key ? t(progress.label_key) : String(progress.label || t("progress.defaultLabel"));

  const progressPercent = Math.min(100, Math.max(0, (progressCurrent / progressTotal) * 100));

  return (
    <div className="chat-page">
      <div className="chat-header">
        <div className="header-content">
          <FaGavel size={28} color="#fff" />
          <div className="header-text">
            <h2>{t("app.title")}</h2>
            <p>{t("app.infoReferrals")}</p>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <LanguagePicker variant="dark" />
          </div>
        </div>
      </div>

      {messages.length > 0 && conversationState?.step !== "complete" && (
        <div className="progress-bar-container">
          <div className="progress-info">
            <span className="progress-step">
              {t("progress.stepOf", { current: progressCurrent, total: progressTotal })}
            </span>
            <span className="progress-label">{progressLabel}</span>
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      )}

      <div className="chat-container">
        <div className="messages-container" ref={messagesContainerRef}>
          {messages.length === 0 && !loading && (
            <div className="empty-state">
              <p>{t("chat.starting")}</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`message-wrapper ${msg.role}`}>
              <div className={`message ${msg.role}`}>
                <div className="message-content">
                  {msg.role === "bot" ? renderBotText(msg) : msg.content}

                  {msg.referrals && msg.referrals.length > 0 && (
                    <div className="referrals">
                      <h4 className="referrals-title">{t("chat.referralsTitle")}</h4>
                      {msg.referrals.map((ref, i) => (
                        <div key={i} className="referral-card">
                          <div className="referral-header">
                            <h3>{ref.name}</h3>
                          </div>
                          <p className="referral-description">{ref.description}</p>

                          <div className="referral-contact">
                            {ref.phone && ref.phone !== "" && (
                              <div className="contact-item">
                                <FaPhone size={14} />
                                <span>
                                  <strong>Intake Phone:</strong> {ref.phone}
                                </span>
                              </div>
                            )}

                            {ref.intake_form && ref.intake_form !== "" && (
                              <div className="contact-item">
                                <FaFileAlt size={14} />
                                <a
                                  href={ref.intake_form}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="intake-link"
                                >
                                  Direct Intake Form
                                </a>
                              </div>
                            )}

                            {ref.intake_instructions && ref.intake_instructions !== "" && (
                              <div className="intake-instructions">
                                <FaInfoCircle size={14} />
                                <span>{ref.intake_instructions}</span>
                              </div>
                            )}
                          </div>

                          {ref.is_nfp && (
                            <button
                              className="btn btn-nfp-intake"
                              onClick={() =>
                                window.open("https://www.chicagoadvocatelegal.com/contact.html", "_blank")
                              }
                            >
                              📅 Schedule Intake Appointment with Cindy
                            </button>
                          )}

                          <a
                            href={ref.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-referral"
                          >
                            Visit Website →
                          </a>
                        </div>
                      ))}

                      {conversationState.step === "complete" && (
                        <div className="ai-assistant-prompt">
                          <button className="btn btn-ai-assistant" onClick={() => setShowAIChat(true)}>
                            <FaRobot size={18} /> {t("chat.aiButton")}
                          </button>
                          <p className="ai-assistant-hint">{t("chat.aiHint")}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {msg.options && msg.options.length > 0 && (
                    <div className="options">
                      {msg.options.map((option, i) => (
                        <button
                          key={i}
                          className="btn btn-option"
                          onClick={() => handleOptionClick(option)}
                          disabled={loading}
                        >
                          {optionLabel(option)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="message-wrapper bot">
              <div className="message bot">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="input-container">
          <button
            onClick={handleBack}
            className="btn btn-back"
            title={t("chat.backTitle")}
            disabled={loading}
          >
            <FaArrowLeft size={24} />
          </button>

          <button
            onClick={handleRestart}
            className="btn btn-restart"
            title={t("chat.restartTitle")}
            disabled={loading}
          >
            <FaRedo size={24} />
          </button>

          <form onSubmit={handleSubmit} className="input-form">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder={t("chat.placeholder")}
              disabled={loading}
              className="chat-input"
            />
            <button
              type="submit"
              className="btn btn-send"
              disabled={loading || !userInput.trim()}
              title={t("chat.sendTitle")}
            >
              <FaPaperPlane size={18} />
            </button>
          </form>
        </div>

        <div className="chat-footer">
          <p className="footer-disclaimer">
            <strong>{t("chat.footerInfoOnly")}</strong>
          </p>
          <p className="footer-privacy-warning">
            ⚠️ <strong>{t("chat.footerPrivacyTitle")}</strong> {t("chat.footerPrivacyText")}
          </p>
        </div>
      </div>

      <EmergencyButton />
    </div>
  );
}

export default App;
