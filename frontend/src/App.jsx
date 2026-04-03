import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import {
  FaPaperPlane,
  FaRedo,
  FaPhone,
  FaFileAlt,
  FaInfoCircle,
  FaRobot,
  FaArrowLeft,
  FaVolumeUp,
  FaStop,
  FaSignOutAlt,
  FaTrashAlt,
  FaUsers,
  FaGraduationCap,
  FaHome,
  FaBalanceScale,
  FaChild,
} from "react-icons/fa";
import "./App.css";
import EmergencyButton from "./components/EmergencyButton";
import calLogo from "./assets/cal_logo.png";

import { useTranslation } from "react-i18next";
import { setAppLanguage, getNormalizedLanguage } from "./i18n";

const AIChat = lazy(() => import("./components/AIChat"));

const STORAGE_KEY = "cal_chatbot_state_v1";
const FIRST_VISIT_KEY = "cal_first_visit_done_v1";
const INTAKE_ID_KEY = "cal_intake_id_v1";
const INTAKE_SAVED_KEY = "cal_intake_saved_v1";

const API_BASE = String(
  import.meta.env.VITE_API_BASE_URL ?? "https://court-legal-chatbot-1.onrender.com"
).replace(/\/+$/, "");

const SUPPORT_EMAIL = "cal@chicagoadvocatelegal.com";


function getDiscreetModeFromUrl() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("mode") === "discreet";
}

function setDiscreetModeInUrl(enabled) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (enabled) {
    url.searchParams.set("mode", "discreet");
  } else {
    url.searchParams.delete("mode");
  }
  window.history.replaceState({}, "", url.toString());
}

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

function fetchWithTimeout(url, options = {}, timeout = 8000) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), timeout)
    ),
  ]);
}

function App() {
  const { t, i18n } = useTranslation();
  const normalizedLang = getNormalizedLanguage();

  const [view, setView] = useState("intakeChoice");
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

  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const [isDiscreetMode, setIsDiscreetMode] = useState(getDiscreetModeFromUrl());

  const apiUrl = (path) => `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  const speechSupported =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance !== "undefined";

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

  useEffect(() => {
    return () => {
      if (speechSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [speechSupported]);

  useEffect(() => {
    const handleEscExit = (e) => {
      if (e.key === "Escape") {
        quickExit();
      }
    };

    window.addEventListener("keydown", handleEscExit);
    return () => window.removeEventListener("keydown", handleEscExit);
  }, []);

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
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("dir", "ltr");
    document.documentElement.setAttribute("lang", normalizedLang);
  }, [i18n.language, i18n.resolvedLanguage, normalizedLang]);

  useEffect(() => {
    document.body.classList.toggle("discreet-mode", isDiscreetMode);
    document.title = isDiscreetMode ? "Resource Portal" : "CAL Legal Chatbot";
    setDiscreetModeInUrl(isDiscreetMode);

    return () => {
      document.body.classList.remove("discreet-mode");
    };
  }, [isDiscreetMode]);


  useEffect(() => {
    setView("intakeChoice");
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages]);

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
      if (Array.isArray(saved?.conversationHistory)) {
        setConversationHistory(saved.conversationHistory);
      }
    } catch (e) {
      console.error("Failed to restore session:", e);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [showChat]);

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

  useEffect(() => {
    if (!speechEnabled || !messages.length) return;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "bot") {
      const text = renderBotText(lastMessage);
      if (text) speakText(text);
    }
  }, [messages, speechEnabled]);


  const toggleDiscreetMode = () => {
    setIsDiscreetMode((prev) => !prev);
  };

  const discreetAppTitle = isDiscreetMode ? "Resource Portal" : t("app.title");
  const discreetSubtitle = isDiscreetMode
    ? "Private support and referral tool"
    : t("app.subtitle");
  const discreetPrivacyTitle = isDiscreetMode ? "Privacy & Safety" : t("privacy.title");
  const discreetPrivacyBody = isDiscreetMode
    ? "This private support tool is designed to reduce visible legal wording on screen. Quick Exit and Clear Session are available for safety."
    : t("privacy.body");
  const discreetIntakeChoiceTitle = isDiscreetMode
    ? "Welcome Back"
    : t("intake.samePersonTitle");
  const discreetIntakeChoiceSubtitle = isDiscreetMode
    ? hasSavedIntakeText()
    : intakeSaved && intakeId
      ? t("intake.samePersonBody")
      : "Create a login to begin.";
  const discreetIntakeTitle = isDiscreetMode ? "Create Access" : "Create Login";
  const discreetIntakeSubtitle = isDiscreetMode
    ? "Enter your details to save your progress securely."
    : t("intake.subtitle");
  const discreetWelcomeTitle = isDiscreetMode
    ? "Find Support Options"
    : t("landing.welcomeTitle");
  const discreetWelcomeTagline = isDiscreetMode
    ? "Answer a few questions to explore support and referral options."
    : t("landing.tagline");
  const discreetBeginLabel = isDiscreetMode ? "Open Support Tool" : t("landing.begin");
  const discreetBackToLoginLabel = isDiscreetMode ? "Back" : "Back to Login";
  const discreetContactHelpLabel = isDiscreetMode ? "Need help? Contact support:" : "Need help? Email:";
  const discreetImportantNoticeTitle = isDiscreetMode
    ? "Private Mode"
    : t("landing.importantNoticeTitle");
  const discreetInfoOnly = isDiscreetMode
    ? "This tool provides general support information and referrals."
    : t("landing.infoOnly");
  const discreetPrivacyWarning = isDiscreetMode
    ? "This screen uses neutral wording and keeps Quick Exit available."
    : `${t("landing.privacyTitle")} ${t("landing.privacyText")}`;
  const discreetChatHeaderTitle = isDiscreetMode
    ? "Resource Portal"
    : "CAL Legal Information and Resources Chatbot";
  const discreetChatHeaderSubtitle = isDiscreetMode
    ? "Support & Resources"
    : "Information & Referrals";
  const discreetFooterDisclaimer = isDiscreetMode
    ? "This tool provides general support information and referrals."
    : t("landing.infoOnly");
  const discreetFooterPrivacy = isDiscreetMode
    ? "Quick Exit and Clear Session are available if you need to leave quickly."
    : "Quick Exit is available if you need to leave this page quickly.";

  function hasSavedIntakeText() {
    return intakeSaved && intakeId
      ? "Continue with your saved access."
      : "Create access to begin.";
  }

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

    const normalized = String(optionCode || "").toLowerCase();

    const hardcodedMap = {
      unknown: "I don't know",
      connect: isDiscreetMode ? "Open Support Form" : "Connect with Chicago Advocate Legal, NFP",
    };

    if (hardcodedMap[normalized]) return hardcodedMap[normalized];

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

    const key = map[normalized];
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
    localStorage.removeItem(INTAKE_SAVED_KEY);
  };

  const clearSessionAndStorage = () => {
    stopSpeaking();
    setMessages([]);
    setConversationState({});
    setConversationHistory([]);
    setUserInput("");
    setCurrentTopic("");
    setShowAIChat(false);
    setShowChat(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  const quickExit = () => {
    try {
      clearSessionAndStorage();
      localStorage.removeItem(FIRST_VISIT_KEY);
      window.location.replace("https://www.google.com");
    } catch (e) {
      window.location.href = "https://www.google.com";
    }
  };

  const postIntakeEvent = async (eventType, eventValue) => {
    if (!intakeId) return;
    try {
      await fetchWithTimeout(apiUrl("/intake/event"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intake_id: intakeId,
          event_type: eventType,
          event_value: eventValue || "",
        }),
      });
    } catch (e) {}
  };

  const trackStepAnswer = async (step, value) => {
    const stepKey = String(step || "").toLowerCase();
    const answer = String(value || "").toLowerCase();

    if (stepKey === "emergency_check") {
      await postIntakeEvent("emergency_answer", answer);
      return;
    }

    if (stepKey === "court_status") {
      await postIntakeEvent("court_answer", answer);
      return;
    }

    if (stepKey === "income_check") {
      await postIntakeEvent("income_answer", answer);
      return;
    }

    if (stepKey === "get_zip" && /^\d{5}$/.test(answer)) {
      await postIntakeEvent("zip_entered", answer);
    }
  };

  const sendMessage = async (message, isBackAction = false) => {
    if (loading) return;
    setLoading(true);

    const userMessage = { role: "user", content: message };
    const nextUserMessages = [...messages, userMessage];
    setMessages((prev) => [...prev, userMessage]);
    setUserInput("");

    try {
      const response = await fetchWithTimeout(apiUrl("/chat"), {
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

      const previousStep = conversationState?.step || "";
      const nextStep = data?.conversation_state?.step || "";

      if (data.conversation_state && data.conversation_state.topic) {
        const topicCode = String(data.conversation_state.topic);
        setCurrentTopic(topicCode.replace("_", " "));

        if (previousStep === "topic_selection") {
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

      if (nextStep === "complete") {
        const zipCode = data?.conversation_state?.zip_code;
        const level = data?.conversation_state?.level;
        const referrals = Array.isArray(data?.referrals) ? data.referrals : [];
        const referralNames = referrals
          .map((r) => String(r?.name || "").trim())
          .filter(Boolean);

        if (zipCode) postIntakeEvent("zip_entered", String(zipCode));
        if (level !== undefined && level !== null) {
          postIntakeEvent("triage_level_assigned", String(level));
        }
        if (referralNames.length > 0) {
          postIntakeEvent("referrals_shown", JSON.stringify(referralNames));
        }
        postIntakeEvent("triage_completed", "true");
      }

      if (!isBackAction && data.conversation_state) {
        setConversationHistory((prev) => [
          ...prev,
          {
            state: newState,
            allMessages: [...nextUserMessages, botMessage],
          },
        ]);
      }
    } catch (error) {
      console.error("Connection error details:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content:
            "We’re having trouble connecting right now. Please try again in a moment or use the resource links below when available.",
          options: [],
        },
      ]);
    }

    setLoading(false);
  };

  const startChatFromCover = async () => {
    if (loading) return;
    localStorage.setItem(FIRST_VISIT_KEY, "1");
    setShowChat(true);
    setView("chat");
    await postIntakeEvent("triage_started", "cover_begin");
    sendMessage("start");
  };

  const goToCover = () => {
    setShowAIChat(false);
    setShowChat(false);
    setView("cover");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || loading) return;

    await trackStepAnswer(conversationState?.step, userInput.trim());
    sendMessage(userInput.trim());
  };

  const handleOptionClick = async (optionCode) => {
    if (loading) return;

    await trackStepAnswer(conversationState?.step, optionCode);
    sendMessage(optionCode);
  };

  const handleRestart = async () => {
    await postIntakeEvent("triage_restart", conversationState?.step || "");

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

  const handleBack = async () => {
    await postIntakeEvent("triage_back", conversationState?.step || "");

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
      setIntakeError("Please enter your first and last name.");
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
      const res = await fetchWithTimeout(apiUrl("/intake/start"), {
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

  const renderHeaderLogo = () => {
    if (isDiscreetMode) return null;

    return (
      <div className="brand-block">
        <img
          src={calLogo}
          alt="Chicago Advocate Legal, NFP logo"
          className="app-logo"
        />
      </div>
    );
  };

  const topicCards = [
    {
      key: "childSupport",
      title: isDiscreetMode ? "Family Support" : t("landing.topics.childSupportTitle"),
      desc: isDiscreetMode
        ? "Help exploring family support options and next steps."
        : t("landing.topics.childSupportDesc"),
      icon: <FaUsers />,
    },
    {
      key: "education",
      title: isDiscreetMode ? "School Help" : t("landing.topics.educationTitle"),
      desc: isDiscreetMode
        ? "Guidance for school-related support and referrals."
        : t("landing.topics.educationDesc"),
      icon: <FaGraduationCap />,
    },
    {
      key: "housing",
      title: isDiscreetMode ? "Housing Help" : t("landing.topics.housingTitle"),
      desc: isDiscreetMode
        ? "Support for housing concerns and trusted referrals."
        : t("landing.topics.housingDesc"),
      icon: <FaHome />,
    },
    {
      key: "divorce",
      title: isDiscreetMode ? "Family Changes" : t("landing.topics.divorceTitle"),
      desc: isDiscreetMode
        ? "Support related to family changes and next steps."
        : t("landing.topics.divorceDesc"),
      icon: <FaBalanceScale />,
    },
    {
      key: "custody",
      title: isDiscreetMode ? "Child Care Decisions" : t("landing.topics.custodyTitle"),
      desc: isDiscreetMode
        ? "Guidance for child care decisions and available referrals."
        : t("landing.topics.custodyDesc"),
      icon: <FaChild />,
    },
  ];

  if (showAIChat) {
    return (
      <Suspense
        fallback={
          <div className="ai-loading-screen">
            <div className="ai-loading-card">Loading AI assistant...</div>
          </div>
        }
      >
        <AIChat
          topic={currentTopic}
          intakeId={intakeId}
          onBack={() => setShowAIChat(false)}
          isDiscreetMode={isDiscreetMode}
        />
      </Suspense>
    );
  }

  if (view === "privacy") {
    return (
      <div className="landing">
        <div className="landing-background-accent"></div>
        <div className="landing-header">
          <div className="logo-container">
            {renderHeaderLogo()}
            <h1>{discreetPrivacyTitle}</h1>
            <p className="subtitle">{discreetSubtitle}</p>
            <LanguagePicker />
          </div>
                    <button
              type="button"
              className="btn btn-start discreet-toggle-btn"
              onClick={toggleDiscreetMode}
              disabled={loading}
            >
              {isDiscreetMode ? "Standard View" : "Discreet Mode"}
            </button>
          </div>

        <div className="landing-content">
          <p className="tagline left-text">{discreetPrivacyBody}</p>

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

  if (view === "intakeChoice") {
    const hasSaved = intakeSaved && intakeId;

    return (
      <div className="landing">
        <div className="landing-background-accent"></div>
        <div className="landing-header">
          <div className="logo-container">
            {renderHeaderLogo()}
            <h1>{discreetIntakeChoiceTitle}</h1>
            <p className="subtitle">
              {isDiscreetMode ? discreetIntakeChoiceSubtitle : hasSaved ? t("intake.samePersonBody") : "Create a login to begin."}
            </p>
            <LanguagePicker />
            <button
              type="button"
              className="btn btn-start discreet-toggle-btn"
              onClick={toggleDiscreetMode}
              disabled={loading}
            >
              {isDiscreetMode ? "Standard View" : "Discreet Mode"}
            </button>
          </div>
        </div>

        <div className="landing-content">
          <button
            className="btn btn-start"
            onClick={() => setView(hasSaved ? "cover" : "intake")}
            disabled={loading}
          >
            {isDiscreetMode ? (hasSaved ? "Continue" : "Start") : hasSaved ? t("intake.samePerson") : "Start"}
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
            Create Login
          </button>

          <div className="secondary-link-wrap">
            <button
              type="button"
              onClick={() => setView("privacy")}
              className="link-button"
            >
              {t("intake.privacyLink")}
            </button>
          </div>
        </div>

        <EmergencyButton />
      </div>
    );
  }

  if (view === "intake") {
    return (
      <div className="landing">
        <div className="landing-background-accent"></div>
        <div className="landing-header">
          <div className="logo-container">
            {renderHeaderLogo()}
            <h1>{discreetIntakeTitle}</h1>
            <p className="subtitle">{discreetIntakeSubtitle}</p>
            <LanguagePicker />
            <button
              type="button"
              className="btn btn-start discreet-toggle-btn"
              onClick={toggleDiscreetMode}
              disabled={loading}
            >
              {isDiscreetMode ? "Standard View" : "Discreet Mode"}
            </button>
          </div>
        </div>

        <div className="landing-content">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitIntake();
            }}
          >
            <div className="intake-grid">
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

              <label className="consent-label">
                <input
                  type="checkbox"
                  checked={intakeConsent}
                  onChange={(e) => setIntakeConsent(e.target.checked)}
                  disabled={loading}
                />
                <span>
                  {t("intake.consentText")}{" "}
                  <button
                    type="button"
                    onClick={() => setView("privacy")}
                    className="inline-link-button"
                  >
                    {t("intake.privacyLink")}
                  </button>
                </span>
              </label>

              {intakeError && (
                <div className="privacy-warning intake-error">{intakeError}</div>
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

  if (!showChat || view === "cover") {
    return (
      <div className="landing">
        <div className="landing-background-accent"></div>
        <div className="landing-header">
          <div className="logo-container">
            {renderHeaderLogo()}
            <h1>{discreetAppTitle}</h1>
            <p className="subtitle">{discreetSubtitle}</p>
            <LanguagePicker />
            <button
              type="button"
              className="btn btn-start discreet-toggle-btn"
              onClick={toggleDiscreetMode}
              disabled={loading}
            >
              {isDiscreetMode ? "Standard View" : "Discreet Mode"}
            </button>
          </div>
        </div>

        <div className="landing-content">
          <h2>{discreetWelcomeTitle}</h2>
          <p className="tagline">{discreetWelcomeTagline}</p>

          <div className="topic-cards">
            {topicCards.map((card) => (
              <div key={card.key} className="topic-card professional-topic-card">
                <div className="topic-card-icon">{card.icon}</div>
                <h3>{card.title}</h3>
                <p>{card.desc}</p>
              </div>
            ))}
          </div>

          <button
            className="btn btn-primary btn-large btn-start"
            onClick={startChatFromCover}
            disabled={loading}
          >
            {discreetBeginLabel}
          </button>

          <div className="contact-help-box">
            <p>
              {discreetContactHelpLabel}{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </p>
          </div>

          <div className="disclaimer-box">
            <p className="disclaimer-title">{discreetImportantNoticeTitle}</p>
            <p className="disclaimer-text">
              <strong>{discreetInfoOnly}</strong>
            </p>
            <p className="privacy-warning">
              ⚠️ {discreetPrivacyWarning}
            </p>
          </div>

          <div className="secondary-link-wrap">
            <button
              type="button"
              onClick={() => setView("intakeChoice")}
              className="link-button"
            >
              {discreetBackToLoginLabel}
            </button>
          </div>
        </div>

        <EmergencyButton />
      </div>
    );
  }

  const progress = conversationState?.progress || {};
  const progressCurrent = Number(progress.current || 1);
  const progressTotal = Number(progress.total || 5);

  const progressLabel =
    progress.label_key
      ? t(progress.label_key)
      : String(progress.label || t("progress.defaultLabel"));

  const progressPercent = Math.min(
    100,
    Math.max(0, (progressCurrent / progressTotal) * 100)
  );

  return (
    <div className="chat-page">
      <div className="chat-header">
        <div className="header-content">
          {!isDiscreetMode && (
            <img
              src={calLogo}
              alt="Chicago Advocate Legal, NFP logo"
              className="chat-header-logo"
            />
          )}
          <div className="header-text">
            <h2>{discreetChatHeaderTitle}</h2>
            <p>{discreetChatHeaderSubtitle}</p>
          </div>
          <div className="header-right">
            <LanguagePicker variant="dark" />
            <button
              type="button"
              className="btn btn-toolbar btn-discreet-toggle"
              onClick={toggleDiscreetMode}
            >
              {isDiscreetMode ? "Standard View" : "Discreet Mode"}
            </button>
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
            <div
              className="progress-bar-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      <div className="chat-container">
        <div className="safety-toolbar">
          <button
            type="button"
            className="btn btn-toolbar btn-quick-exit"
            onClick={quickExit}
          >
            <FaSignOutAlt /> Quick Exit
          </button>

          <button
            type="button"
            className="btn btn-toolbar btn-clear-session"
            onClick={clearSessionAndStorage}
          >
            <FaTrashAlt /> Clear Session
          </button>

          {speechSupported && (
            <button
              type="button"
              className="btn btn-toolbar btn-read-toggle"
              onClick={() => {
                if (speechEnabled) {
                  stopSpeaking();
                  setSpeechEnabled(false);
                } else {
                  setSpeechEnabled(true);
                }
              }}
            >
              {speechEnabled ? (
                <>
                  <FaStop /> Turn Off Read Aloud
                </>
              ) : (
                <>
                  <FaVolumeUp /> Turn On Read Aloud
                </>
              )}
            </button>
          )}
        </div>

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

                  {msg.role === "bot" && speechSupported && (
                    <div className="message-tools">
                      <button
                        type="button"
                        className="btn btn-read-aloud"
                        onClick={() => speakText(renderBotText(msg))}
                      >
                        <FaVolumeUp /> Read aloud
                      </button>
                    </div>
                  )}

                  {msg.referrals && msg.referrals.length > 0 && (
                    <div className="referrals">
                      <h4 className="referrals-title">{isDiscreetMode ? "Suggested Support Options" : t("chat.referralsTitle")}</h4>
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
                                  <strong>{isDiscreetMode ? "Phone:" : "Intake Phone:"}</strong> {ref.phone}
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
                                  {isDiscreetMode ? "Open Form" : "Direct Intake Form"}
                                </a>
                              </div>
                            )}

                            {ref.intake_instructions && ref.intake_instructions !== "" && (
                              <div className="intake-instructions">
                                <FaInfoCircle size={14} />
                                <span>{ref.intake_instructions}</span>
                              </div>
                            )}

                            {ref.special_education_helpline &&
                              ref.special_education_helpline !== "" && (
                                <div className="contact-item">
                                  <FaPhone size={14} />
                                  <span>
                                    <strong>{isDiscreetMode ? "Support Helpline:" : "Special Education Helpline:"}</strong>{" "}
                                    {ref.special_education_helpline}
                                  </span>
                                </div>
                              )}
                          </div>

                          {ref.is_nfp && (
                            <button
                              className="btn btn-nfp-intake"
                              onClick={() =>
                                window.open(
                                  ref.intake_form ||
                                    "https://www.chicagoadvocatelegal.com/contact.html",
                                  "_blank"
                                )
                              }
                            >
                              {isDiscreetMode ? "Open Support Form" : "Connect with Chicago Advocate Legal, NFP"}
                            </button>
                          )}

                          <a
                            href={ref.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-referral"
                          >
                            {isDiscreetMode ? "Open Website →" : "Visit Website →"}
                          </a>
                        </div>
                      ))}

                      {conversationState.step === "complete" && (
                        <div className="ai-assistant-prompt">
                          <button
                            className="btn btn-ai-assistant"
                            onClick={() => {
                              postIntakeEvent("ai_assistant_opened", currentTopic || "");
                              setShowAIChat(true);
                            }}
                          >
                            <FaRobot size={18} /> {isDiscreetMode ? "Open Assistant" : t("chat.aiButton")}
                          </button>
                          <p className="ai-assistant-hint">{isDiscreetMode ? "Ask general questions and get support information." : t("chat.aiHint")}</p>
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
              placeholder={isDiscreetMode ? "Type your message..." : t("chat.placeholder")}
              disabled={loading}
              className="chat-input"
            />
            <button type="submit" className="btn btn-send" disabled={loading}>
              <FaPaperPlane size={20} />
            </button>
          </form>
        </div>

        <div className="chat-footer">
          <p className="footer-disclaimer">{discreetFooterDisclaimer}</p>
          <p className="footer-privacy-warning">
            {discreetFooterPrivacy}
          </p>
        </div>
      </div>

      <EmergencyButton />
    </div>
  );
}

export default App;