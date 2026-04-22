import React, { useState, useEffect, useLayoutEffect, useRef, lazy, Suspense } from "react";
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
  FaPrint,
  FaSun,
  FaMoon,
} from "react-icons/fa";
import "./App.css";
import "./cal-app-dark.css";
import EmergencyButton from "./components/EmergencyButton";
import StatusBanner from "./components/StatusBanner";
import SiteFooter from "./components/SiteFooter";
import TrustPanel from "./components/TrustPanel";
import { printReferralsSummary } from "./utils/printReferrals";
import { STORAGE_KEY } from "./utils/storageKeys";
import { getApiBaseUrl, rewriteLegacyRenderFetchUrl } from "./utils/apiBase";
import {
  getPendingTriageFromStorage,
  clearSavedChatState,
} from "./utils/savedChat";
import { getStoredTheme, persistTheme } from "./utils/themeStorage";
import TopicResourcesPanel from "./components/TopicResourcesPanel";
import DocumentGeneratorPanel from "./components/DocumentGeneratorPanel";
import GuidedCaseTimelinePanel from "./components/GuidedCaseTimelinePanel";
import ReferralMap from "./components/ReferralMap";
import LegalGlossary from "./components/LegalGlossary";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import calLogo from "./assets/cal_logo.png";
import { Eye, EyeOff } from "lucide-react";

import { useTranslation } from "react-i18next";
import i18n, { setAppLanguage, getNormalizedLanguage } from "./i18n";

const AIChat = lazy(() => import("./components/AIChat"));

const FIRST_VISIT_KEY = "cal_first_visit_done_v1";
const INTAKE_ID_KEY = "cal_intake_id_v1";
const INTAKE_SAVED_KEY = "cal_intake_saved_v1";
const LARGE_TEXT_KEY = "cal_large_text_v1";
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

const SUPPORT_EMAIL = "intake@chicagoadvocatelegal.com";

function isLocalDevHost() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname || "";
  return h === "localhost" || h === "127.0.0.1";
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

const DEFAULT_FETCH_TIMEOUT_MS = 8000;
/** Backend / DB (e.g. Render cold start, remote Postgres) often needs more than 8s. */
const INTAKE_FETCH_TIMEOUT_MS = 45000;
const CHAT_FETCH_TIMEOUT_MS = 30000;
const WARMUP_TIMEOUT_MS = 15000;

function initialAuthView() {
  try {
    if (
      localStorage.getItem(INTAKE_SAVED_KEY) === "1" &&
      localStorage.getItem(INTAKE_ID_KEY)
    ) {
      return "intakeChoice";
    }
  } catch {
    /* ignore */
  }
  return "intake";
}

function fetchWithTimeout(url, options = {}, timeout = DEFAULT_FETCH_TIMEOUT_MS) {
  const target = typeof url === "string" ? rewriteLegacyRenderFetchUrl(url) : url;
  return Promise.race([
    fetch(target, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), timeout)
    ),
  ]);
}

async function postIntakeStartWithRetry(url, payload, onRetryStart) {
  const run = () =>
    fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      INTAKE_FETCH_TIMEOUT_MS
    );

  try {
    return await run();
  } catch (error) {
    if (String(error?.message || "").toLowerCase().includes("timeout")) {
      if (typeof onRetryStart === "function") onRetryStart();
      const base = getApiBaseUrl();
      await fetchWithTimeout(`${base}/health`, {}, WARMUP_TIMEOUT_MS).catch(() => null);
      return run();
    }
    throw error;
  }
}

function inferTopicFromFreeText(input) {
  const text = String(input || "")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";

  const topicMatchers = [
    {
      topic: "housing",
      patterns: [
        "apartment",
        "landlord",
        "tenant",
        "eviction",
        "lockout",
        "locked out",
        "can't get into my apartment",
        "cant get into my apartment",
        "cannot get into my apartment",
        "can't access my apartment",
        "cannot access my apartment",
        "housing",
        "lease",
        "rent",
        "utilities",
        "repair",
      ],
    },
    {
      topic: "education",
      patterns: [
        "school",
        "student",
        "special education",
        "iep",
        "504",
        "bullying",
        "discipline",
        "education",
        "suspension",
        "expulsion",
      ],
    },
    {
      topic: "child_support",
      patterns: [
        "child support",
        "support payment",
        "support order",
        "pay child support",
        "receive child support",
      ],
    },
    {
      topic: "divorce",
      patterns: [
        "divorce",
        "separation",
        "spouse",
        "marriage",
        "dissolution",
      ],
    },
    {
      topic: "custody",
      patterns: [
        "custody",
        "parenting time",
        "visitation",
        "child care decisions",
        "my child",
      ],
    },
  ];

  for (const matcher of topicMatchers) {
    if (matcher.patterns.some((pattern) => text.includes(pattern))) {
      return matcher.topic;
    }
  }

  return "";
}

function normalizeFreeTextMessageForStep(message, step) {
  const raw = String(message || "").trim();
  const lowered = raw.toLowerCase();
  const currentStep = String(step || "").toLowerCase();

  if (currentStep === "problem_summary") {
    return raw.slice(0, 4000);
  }

  if (currentStep === "topic_selection") {
    const inferredTopic = inferTopicFromFreeText(lowered);
    if (inferredTopic) return inferredTopic;
  }

  if (currentStep === "emergency_check") {
    if (/(i don't know|dont know|do not know|not sure|unsure|unknown)/i.test(raw)) return "unknown";
    if (/(yes|yep|yeah|urgent|emergency|danger|unsafe)/i.test(raw)) return "yes";
    if (/(no|nope|not an emergency|safe)/i.test(raw)) return "no";
  }

  if (currentStep === "court_status") {
    if (/(yes|i do|already|have a court case|in court)/i.test(raw)) return "yes";
    if (/(no|not in court|don't have a court case|do not have a court case)/i.test(raw)) return "no";
  }

  if (currentStep === "income_check") {
    if (/(not sure|unsure|don't know|do not know)/i.test(raw)) return "not_sure";
    if (/(yes|qualify|low income|free legal help)/i.test(raw)) return "yes";
    if (/(no|do not qualify|don't qualify)/i.test(raw)) return "no";
  }

  if (currentStep === "summary_topic_confirm") {
    if (lowered === "summary_topic_same" || lowered === "summary_topic_change") return lowered;
    if (/(different|another topic|change topic|wrong topic|not the same|other topic)/i.test(lowered)) {
      return "summary_topic_change";
    }
    if (/(^|\b)(yes|yep|yeah|same|still|correct)\b/i.test(lowered)) return "summary_topic_same";
    return lowered.replace(/\s+/g, "_");
  }

  if (currentStep === "topic_reconfirm") {
    if (lowered === "summary_topic_same" || lowered === "summary_topic_change") return lowered;
    if (/(different|another topic|change topic|wrong topic|not the same|other topic)/i.test(lowered)) {
      return "summary_topic_change";
    }
    if (/(^|\b)(yes|yep|yeah|same|still|correct)\b/i.test(lowered)) return "summary_topic_same";
    return lowered.replace(/\s+/g, "_");
  }

  return raw;
}

function App() {
  const { t, i18n } = useTranslation();
  const normalizedLang = getNormalizedLanguage();

  const [view, setView] = useState(initialAuthView);
  const [loading, setLoading] = useState(false);
  const [chatError, setChatError] = useState("");

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
  const [intakePassword, setIntakePassword] = useState("");
  const [intakePasswordConfirm, setIntakePasswordConfirm] = useState("");
  const [intakePhone, setIntakePhone] = useState("");
  const [intakeConsent, setIntakeConsent] = useState(false);

  const [intakeError, setIntakeError] = useState("");
  const [intakeSubmitPhase, setIntakeSubmitPhase] = useState("idle");

  const [magicLinkEmail, setMagicLinkEmail] = useState("");
  const [magicLinkBusy, setMagicLinkBusy] = useState(false);
  const [magicLinkSentTo, setMagicLinkSentTo] = useState("");
  const [magicLinkError, setMagicLinkError] = useState("");
  const [magicVerifyError, setMagicVerifyError] = useState("");
  const [magicTokenPending, setMagicTokenPending] = useState("");
  const [magicVerifyBusy, setMagicVerifyBusy] = useState(false);
  const [magicDevLink, setMagicDevLink] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [passwordLoginBusy, setPasswordLoginBusy] = useState(false);
  const [passwordLoginError, setPasswordLoginError] = useState("");
  const [passwordResetNotice, setPasswordResetNotice] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotNotice, setForgotNotice] = useState("");
  const [forgotDevLink, setForgotDevLink] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetPassword1, setResetPassword1] = useState("");
  const [resetPassword2, setResetPassword2] = useState("");
  const [showResetPassword1, setShowResetPassword1] = useState(false);
  const [showResetPassword2, setShowResetPassword2] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState("");
  const [showIntakePassword, setShowIntakePassword] = useState(false);
  const [showIntakePasswordConfirm, setShowIntakePasswordConfirm] = useState(false);

  const [largeText, setLargeText] = useState(
    () => localStorage.getItem(LARGE_TEXT_KEY) === "1"
  );
  const [triageFeedback, setTriageFeedback] = useState(null);
  const [pendingTriage, setPendingTriage] = useState(null);

  const [theme, setTheme] = useState(getStoredTheme);
  const isDark = theme === "dark";

  useLayoutEffect(() => {
    persistTheme(theme);
    document.documentElement.setAttribute("data-cal-theme", theme);
  }, [theme]);

  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const apiUrl = (path) => {
    const base = getApiBaseUrl();
    return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  };

  const passwordStrengthKey = (passwordRaw) => {
    const password = String(passwordRaw || "");
    if (!password) return "";
    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    if (score <= 2) return "weak";
    if (score <= 4) return "medium";
    return "strong";
  };

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
    const apiPath = (path) => {
      const base = getApiBaseUrl();
      return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
    };
    const params = new URLSearchParams(window.location.search);
    const fresh = params.get("fresh") === "1";

    if (fresh) {
      localStorage.removeItem(FIRST_VISIT_KEY);
      clearSavedChatState();

      setShowAIChat(false);
      setShowChat(false);
      setMessages([]);
      setConversationState({});
      setConversationHistory([]);
      setUserInput("");
      setCurrentTopic("");
      setView("intake");
    }

    const resetTokenParam = params.get("reset_token");
    if (resetTokenParam) {
      setResetToken(String(resetTokenParam).trim());
      setResetError("");
      setView("resetPassword");
      return undefined;
    }

    const token = params.get("magic_token");
    if (!token) return undefined;
    setMagicTokenPending(String(token).trim());
    setMagicVerifyError("");
    setView("login");
    return undefined;
  }, []);

  const verifyPendingMagicLink = async () => {
    const token = String(magicTokenPending || "").trim();
    if (!token || magicVerifyBusy) return;
    setMagicVerifyBusy(true);
    setMagicVerifyError("");
    try {
      const res = await fetchWithTimeout(
        apiUrl("/auth/magic-link/verify"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        },
        INTAKE_FETCH_TIMEOUT_MS
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail ? String(data.detail) : i18n.t("login.verifyFailed"));
      }
      const p = new URLSearchParams(window.location.search);
      p.delete("magic_token");
      const qs = p.toString();
      const newUrl = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash || ""}`;
      window.history.replaceState({}, "", newUrl);
      setMagicTokenPending("");
      completeLogin(data.intake_id);
    } catch (err) {
      setMagicVerifyError(
        err?.message && String(err.message).trim().length > 0
          ? String(err.message)
          : i18n.t("login.verifyFailed")
      );
    } finally {
      setMagicVerifyBusy(false);
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute("dir", "ltr");
    document.documentElement.setAttribute("lang", normalizedLang);
  }, [i18n.language, i18n.resolvedLanguage, normalizedLang]);

  useEffect(() => {
    document.documentElement.classList.toggle("large-text-mode", largeText);
    localStorage.setItem(LARGE_TEXT_KEY, largeText ? "1" : "0");
  }, [largeText]);

  useEffect(() => {
    if (conversationState?.step !== "complete") {
      setTriageFeedback(null);
    }
  }, [conversationState?.step]);

  useEffect(() => {
    if (view === "intakeChoice" && !(intakeSaved && intakeId)) {
      setView("intake");
    }
  }, [view, intakeSaved, intakeId]);

  useEffect(() => {
    if (view === "cover") {
      setPendingTriage(getPendingTriageFromStorage());
    }
  }, [view]);

  useEffect(() => {
    if (!["cover", "intake", "intakeChoice", "login", "magicSent", "forgotPassword", "resetPassword"].includes(view)) return;
    fetchWithTimeout(apiUrl("/health"), {}, WARMUP_TIMEOUT_MS).catch(() => null);
  }, [view]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  useEffect(() => {
    if (messages.length === 0) return;

    const timer = window.setTimeout(() => {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === "bot" && Array.isArray(lastMessage?.referrals) && lastMessage.referrals.length > 0) {
        return;
      }

      const container = messagesContainerRef.current;
      if (container) {
        const distanceFromBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight;
        if (distanceFromBottom > 220) {
          return;
        }
      }

      scrollToBottom();
    }, 120);

    return () => window.clearTimeout(timer);
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
      clearSavedChatState();
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

  const LanguagePicker = ({ variant = "light", labelOnDarkBackground = false }) => {
    const isDark = variant === "dark";
    const labelColor = labelOnDarkBackground
      ? "#f0f6fc"
      : isDark
        ? "#ffffff"
        : "#1f2937";
    const style = {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      justifyContent: "center",
      marginTop: isDark ? 0 : "14px",
      marginBottom: isDark ? 0 : "6px",
      color: labelColor,
      fontWeight: 700,
      fontSize: "0.95rem",
      flexWrap: "wrap",
    };

    const selectStyle = isDark
      ? {
          padding: "8px 10px",
          borderRadius: "8px",
          border: "1px solid #30363d",
          background: "#161b22",
          fontWeight: 700,
          cursor: "pointer",
          color: "#f0f6fc",
        }
      : {
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

  const ThemeToggle = () => (
    <button
      type="button"
      className="theme-toggle-btn"
      onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
      aria-pressed={isDark}
      title={isDark ? t("theme.useLight") : t("theme.useDark")}
      aria-label={isDark ? t("theme.useLight") : t("theme.useDark")}
    >
      {isDark ? <FaSun size={15} aria-hidden /> : <FaMoon size={15} aria-hidden />}
    </button>
  );

  const landingClass = isDark ? "landing cal-app-dark" : "landing";
  const chatShellClass = isDark ? "chat-page cal-app-dark" : "chat-page";
  const authPageClass = isDark ? "auth-github-page" : "auth-github-page auth-github-page--light";
  const lpVariant = isDark ? "dark" : "light";
  const footerAuthClass = isDark ? "site-footer--auth-dark" : "";
  const chatFooterClassName = isDark
    ? "site-footer-chat site-footer--auth-dark"
    : "site-footer-chat site-footer-chat--light";

  const optionLabel = (optionCode) => {
    const normalized = String(optionCode || "").trim().toLowerCase();
    if (["child_support", "education", "housing", "divorce", "custody"].includes(normalized)) {
      return t(`triage.options.topic_${normalized}`);
    }

    const hardcodedMap = {
      unknown: "I don't know",
      connect: "Connect with Chicago Advocate Legal, NFP",
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
      summary_topic_same: "triage.options.summaryTopicSame",
      summary_topic_change: "triage.options.summaryTopicChange",
    };

    const key = map[normalized];
    if (key) {
      const translated = t(key);
      if (translated && translated !== key) return translated;
    }
    return String(optionCode || "")
      .trim()
      .replace(/_/g, " ")
      .replace(/\s+/g, " ");
  };

  const safeOptionLabel = (optionCode) => {
    const base = String(optionCode || "").trim();
    if (!base) return "Option";
    const translated = optionLabel(base);
    const clean = String(translated || "").trim();
    if (!clean) return base.replace(/_/g, " ");
    // Final guard: never render raw snake_case tokens to user.
    if (/^[a-z0-9]+(?:_[a-z0-9]+)+$/i.test(clean)) {
      return clean.replace(/_/g, " ");
    }
    return clean;
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

      if (hydrated.selectedTopic && !hydrated.selectedTopicLabel) {
        hydrated.selectedTopicLabel = t(`triage.options.topic_${hydrated.selectedTopic}`);
      }
      if (hydrated.inferredTopic && !hydrated.inferredTopicLabel) {
        hydrated.inferredTopicLabel = t(`triage.options.topic_${hydrated.inferredTopic}`);
      }

      const translated = t(msg.response_key, hydrated);
      if (translated && translated !== msg.response_key) return translated;
    }

    if (typeof msg.content === "string" && msg.content.trim()) return msg.content.trim();
    return t("triage.fallback.prompt");
  };

  const clearSavedIntake = () => {
    setIntakeId("");
    setIntakeSaved(false);
    localStorage.removeItem(INTAKE_ID_KEY);
    localStorage.removeItem(INTAKE_SAVED_KEY);
  };

  const completeLogin = (nextIntakeId) => {
    const safeId = String(nextIntakeId || "").trim();
    if (!safeId) return;
    localStorage.setItem(INTAKE_ID_KEY, safeId);
    localStorage.setItem(INTAKE_SAVED_KEY, "1");
    localStorage.setItem(FIRST_VISIT_KEY, "1");
    setIntakeId(safeId);
    setIntakeSaved(true);
    setShowChat(false);
    setView("cover");
  };

  const handlePasswordLoginSubmit = async (e) => {
    e.preventDefault();
    if (passwordLoginBusy || magicLinkBusy) return;
    const email = String(magicLinkEmail || "").trim().toLowerCase();
    const password = String(loginPassword || "");
    if (!isValidEmail(email)) {
      setPasswordLoginError(t("intake.invalidEmail"));
      return;
    }
    if (password.length < 8) {
      setPasswordLoginError(t("login.passwordTooShort"));
      return;
    }
    setPasswordLoginBusy(true);
    setPasswordLoginError("");
    setMagicVerifyError("");
    try {
      const res = await fetchWithTimeout(
        apiUrl("/auth/password/login"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        },
        INTAKE_FETCH_TIMEOUT_MS
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail ? String(data.detail) : t("login.passwordLoginFailed"));
      }
      completeLogin(data.intake_id);
      setLoginPassword("");
      setPasswordResetNotice("");
    } catch (err) {
      setPasswordLoginError(
        err?.message && String(err.message).trim().length > 0
          ? String(err.message)
          : t("login.passwordLoginFailed")
      );
    } finally {
      setPasswordLoginBusy(false);
    }
  };

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    const email = String(forgotEmail || "").trim().toLowerCase();
    if (!isValidEmail(email)) {
      setForgotError(t("intake.invalidEmail"));
      return;
    }
    setForgotBusy(true);
    setForgotError("");
    setForgotNotice("");
    setForgotDevLink("");
    try {
      const res = await fetchWithTimeout(
        apiUrl("/auth/password/forgot"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
        INTAKE_FETCH_TIMEOUT_MS
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail ? String(data.detail) : t("login.requestFailed"));
      }
      if (data && data.email_sent === false) {
        const hint =
          typeof data.delivery_hint === "string" && data.delivery_hint.trim()
            ? ` ${data.delivery_hint.trim()}`
            : "";
        setForgotError(`Reset email could not be delivered.${hint}`);
      } else {
        setForgotNotice(t("login.forgotNotice"));
      }
      setForgotDevLink(typeof data?.dev_reset_link === "string" ? data.dev_reset_link : "");
    } catch (err) {
      setForgotError(
        err?.message && String(err.message).trim().length > 0
          ? String(err.message)
          : t("login.requestFailed")
      );
    } finally {
      setForgotBusy(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!resetToken) {
      setResetError(t("login.resetInvalid"));
      return;
    }
    if (resetPassword1.length < 8) {
      setResetError(t("login.passwordTooShort"));
      return;
    }
    if (resetPassword1 !== resetPassword2) {
      setResetError(t("login.passwordMismatch"));
      return;
    }
    setResetBusy(true);
    setResetError("");
    try {
      const res = await fetchWithTimeout(
        apiUrl("/auth/password/reset"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: resetToken, new_password: resetPassword1 }),
        },
        INTAKE_FETCH_TIMEOUT_MS
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail ? String(data.detail) : t("login.resetInvalid"));
      }
      const p = new URLSearchParams(window.location.search);
      p.delete("reset_token");
      const qs = p.toString();
      const newUrl = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash || ""}`;
      window.history.replaceState({}, "", newUrl);
      setResetToken("");
      setResetPassword1("");
      setResetPassword2("");
      setPasswordResetNotice(t("login.resetDone"));
      setMagicLinkEmail("");
      setView("login");
    } catch (err) {
      setResetError(
        err?.message && String(err.message).trim().length > 0
          ? String(err.message)
          : t("login.resetInvalid")
      );
    } finally {
      setResetBusy(false);
    }
  };

  const sendMagicLinkRequest = async (emailRaw) => {
    const email = String(emailRaw ?? magicLinkEmail).trim();
    if (!isValidEmail(email)) {
      setMagicLinkError(t("intake.invalidEmail"));
      return false;
    }
    setMagicLinkBusy(true);
    setMagicLinkError("");
    try {
      const res = await fetchWithTimeout(
        apiUrl("/auth/magic-link/request"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
        INTAKE_FETCH_TIMEOUT_MS
      );
      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (!res.ok) {
        const detail = data?.detail;
        let msg = t("login.requestFailed");
        if (Array.isArray(detail)) {
          msg = detail
            .map((d) => (typeof d?.msg === "string" ? d.msg : JSON.stringify(d)))
            .join(" ");
        } else if (typeof detail === "string") {
          msg = detail;
        }
        setMagicLinkError(msg);
        return false;
      }
      if (data && data.email_sent === false) {
        const hint =
          typeof data.delivery_hint === "string" && data.delivery_hint.trim()
            ? ` ${data.delivery_hint.trim()}`
            : "";
        setMagicLinkError(`Sign-in email could not be delivered.${hint}`);
      }
      setMagicLinkSentTo(email);
      setMagicDevLink(typeof data?.dev_magic_link === "string" ? data.dev_magic_link : "");
      setView("magicSent");
      return true;
    } catch {
      setMagicLinkError(t("login.requestFailed"));
      return false;
    } finally {
      setMagicLinkBusy(false);
    }
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
    clearSavedChatState();
  };

  useEffect(() => {
    if (!(intakeSaved && intakeId)) return undefined;

    const activityEvents = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    let timer = 0;
    const resetInactivityTimer = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        clearSessionAndStorage();
        clearSavedIntake();
        setMagicLinkEmail("");
        setLoginPassword("");
        setPasswordLoginError("");
        setMagicLinkError("");
        setMagicVerifyError("");
        setView("login");
      }, INACTIVITY_TIMEOUT_MS);
    };

    for (const eventName of activityEvents) {
      window.addEventListener(eventName, resetInactivityTimer, { passive: true });
    }
    resetInactivityTimer();

    return () => {
      if (timer) window.clearTimeout(timer);
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, resetInactivityTimer);
      }
    };
  }, [intakeSaved, intakeId]);

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
      await fetchWithTimeout(
        apiUrl("/intake/event"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intake_id: intakeId,
            event_type: eventType,
            event_value: eventValue || "",
          }),
        },
        INTAKE_FETCH_TIMEOUT_MS
      );
    } catch (e) {}
  };

  const getLastReferralsFromMessages = () => {
    const msg = [...messages]
      .reverse()
      .find((m) => m.role === "bot" && m.referrals?.length);
    return msg?.referrals || [];
  };

  const topicLabelForPrint = () => {
    const topic = conversationState?.topic;
    if (!topic) return "";
    return t(`triage.options.topic_${topic}`);
  };

  const handlePrintReferrals = () => {
    printReferralsSummary({
      referrals: getLastReferralsFromMessages(),
      topicLabel: topicLabelForPrint(),
      zipCode: String(conversationState?.zip_code || ""),
      t,
    });
  };

  const handleTriageFeedback = async (positive) => {
    await postIntakeEvent("triage_feedback", positive ? "helpful_yes" : "helpful_no");
    setTriageFeedback("done");
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

  const sendMessage = async (message, isBackAction = false, displayOverride = "") => {
    if (loading) return;
    setChatError("");
    setLoading(true);

    const userDisplayText = displayOverride
      ? String(displayOverride)
          .replace(/_/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      : message;
    const userMessage = { role: "user", content: userDisplayText };
    const nextUserMessages = [...messages, userMessage];
    setMessages((prev) => [...prev, userMessage]);
    setUserInput("");

    try {
      const response = await fetchWithTimeout(
        apiUrl("/chat"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message:
              String(conversationState?.step || "").toLowerCase() === "problem_summary"
                ? String(message || "").trim()
                : String(message || "").toLowerCase(),
            conversation_state: conversationState,
            language: normalizedLang,
            intake_id: intakeId || null,
          }),
        },
        CHAT_FETCH_TIMEOUT_MS
      );

      if (!response.ok) {
        let detail = "";
        try {
          const payload = await response.json();
          detail = payload?.detail ? String(payload.detail) : "";
        } catch (e) {}
        throw new Error(
          detail || `Server error: ${response.status}. Please try again.`
        );
      }

      const data = await response.json();

      const nextStep = data?.conversation_state?.step || "";

      if (data.conversation_state && data.conversation_state.topic) {
        const topicCode = String(data.conversation_state.topic);
        setCurrentTopic(topicCode.replace("_", " "));
      }

      const botMessage = {
        role: "bot",
        content: data.response || "",
        response_key: data.response_key,
        response_params: data.response_params,
        options: data.options || [],
        referrals: data.referrals || [],
        decision_support:
          data.decision_support && typeof data.decision_support === "object"
            ? data.decision_support
            : null,
      };

      setMessages((prev) => [...prev, botMessage]);

      const newState = {
        ...(data.conversation_state || {}),
        progress: data.progress || (data.conversation_state?.progress ?? {}),
      };
      setConversationState(newState);

      if (nextStep === "complete") {
        // Completion state can trigger UI tools; analytics are logged server-side.
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
      const friendlyError =
        error?.message && String(error.message).trim().length > 0
          ? String(error.message)
          : "We’re having trouble connecting right now.";
      setChatError(friendlyError);
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
    setChatError("");
    clearSavedChatState();
    setMessages([]);
    setConversationState({});
    setConversationHistory([]);
    setUserInput("");
    setCurrentTopic("");
    localStorage.setItem(FIRST_VISIT_KEY, "1");
    setShowChat(true);
    setView("chat");
    await postIntakeEvent("triage_started", "cover_begin");
    sendMessage("start");
  };

  const resumeTriageFromCover = async () => {
    if (loading) return;
    setChatError("");
    localStorage.setItem(FIRST_VISIT_KEY, "1");
    setShowChat(true);
    setView("chat");
    await postIntakeEvent("session_resume", pendingTriage?.step || "");
  };

  const discardPendingAndStartFresh = async () => {
    if (loading) return;
    clearSavedChatState();
    setPendingTriage(null);
    await startChatFromCover();
  };

  const goToCover = () => {
    setShowAIChat(false);
    setShowChat(false);
    setView("cover");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || loading) return;

    const normalizedMessage = normalizeFreeTextMessageForStep(
      userInput.trim(),
      conversationState?.step
    );

    await trackStepAnswer(conversationState?.step, normalizedMessage);
    const shouldPrettyPrintChoice =
      ["summary_topic_confirm", "topic_reconfirm"].includes(
        String(conversationState?.step || "").toLowerCase()
      ) &&
      ["summary_topic_same", "summary_topic_change"].includes(
        String(normalizedMessage || "").toLowerCase()
      );
    sendMessage(
      normalizedMessage,
      false,
      shouldPrettyPrintChoice ? safeOptionLabel(normalizedMessage) : ""
    );
  };

  const handleOptionClick = async (optionCode) => {
    if (loading) return;

    await trackStepAnswer(conversationState?.step, optionCode);
    sendMessage(optionCode, false, safeOptionLabel(optionCode));
  };

  const handleRestart = async () => {
    setChatError("");
    await postIntakeEvent("triage_restart", conversationState?.step || "");

    setMessages([]);
    setConversationState({});
    setConversationHistory([]);
    setUserInput("");
    setCurrentTopic("");
    setShowAIChat(false);

    clearSavedChatState();

    setShowChat(true);
    setView("chat");
    sendMessage("start");
  };

  const handleBack = async () => {
    setChatError("");
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
    if (String(intakePassword || "").trim().length < 8) {
      setIntakeError(t("login.passwordTooShort"));
      return;
    }
    if (String(intakePasswordConfirm || "").trim() !== String(intakePassword || "").trim()) {
      setIntakeError(t("login.passwordMismatch"));
      return;
    }

    setLoading(true);
    setIntakeSubmitPhase("saving");

    try {
      const res = await postIntakeStartWithRetry(
        apiUrl("/intake/start"),
        {
          first_name: intakeFirstName.trim(),
          last_name: intakeLastName.trim(),
          email: intakeEmail.trim().toLowerCase(),
          password: intakePassword,
          phone: intakePhone.trim(),
          zip: "",
          language: normalizedLang,
          consent: true,
        },
        () => setIntakeSubmitPhase("retrying")
      );

      if (!res.ok) {
        let detail = "";
        try {
          const payload = await res.json();
          detail = payload?.detail ? String(payload.detail) : "";
        } catch (e) {}
        throw new Error(detail || "Unable to save intake right now.");
      }

      const data = await res.json();
      const newId = data.intake_id;

      setIntakeId(newId);
      setIntakeSaved(true);

      localStorage.setItem(INTAKE_ID_KEY, newId);
      localStorage.setItem(INTAKE_SAVED_KEY, "1");
      setIntakePassword("");
      setIntakePasswordConfirm("");

      setView("intakeSuccess");
    } catch (e) {
      setIntakeError(
        e?.message && String(e.message).trim().length > 0
          ? String(e.message)
          : t("intake.serverError")
      );
    } finally {
      setLoading(false);
      setIntakeSubmitPhase("idle");
    }
  };

  const renderHeaderLogo = () => (
    <div className="brand-block">
      <img
        src={calLogo}
        alt="Chicago Advocate Legal, NFP logo"
        className="app-logo"
      />
    </div>
  );

  const renderAuthAside = () => (
    <aside className="auth-split-aside" aria-label={t("login.authAside.ariaLabel")}>
      <div className="auth-split-aside-brand">{renderHeaderLogo()}</div>
      <p className="auth-split-aside-kicker">{t("login.authAside.kicker")}</p>
      <h2 className="auth-split-aside-headline">{t("login.authAside.headline")}</h2>
      <p className="auth-split-aside-body">{t("login.authAside.body")}</p>
      <ul className="auth-split-aside-list">
        <li>{t("login.authAside.item1")}</li>
        <li>{t("login.authAside.item2")}</li>
        <li>{t("login.authAside.item3")}</li>
        <li>{t("login.authAside.item4")}</li>
      </ul>
    </aside>
  );

  const topicCards = [
    {
      key: "childSupport",
      title: t("landing.topics.childSupportTitle"),
      desc: t("landing.topics.childSupportDesc"),
      icon: <FaUsers />,
    },
    {
      key: "education",
      title: t("landing.topics.educationTitle"),
      desc: t("landing.topics.educationDesc"),
      icon: <FaGraduationCap />,
    },
    {
      key: "housing",
      title: t("landing.topics.housingTitle"),
      desc: t("landing.topics.housingDesc"),
      icon: <FaHome />,
    },
    {
      key: "divorce",
      title: t("landing.topics.divorceTitle"),
      desc: t("landing.topics.divorceDesc"),
      icon: <FaBalanceScale />,
    },
    {
      key: "custody",
      title: t("landing.topics.custodyTitle"),
      desc: t("landing.topics.custodyDesc"),
      icon: <FaChild />,
    },
  ];

  if (showAIChat) {
    return (
      <Suspense
        fallback={
          <div className="ai-loading-screen ai-loading-screen--dark">
            <div className="ai-loading-card ai-loading-card--dark">Loading AI assistant...</div>
          </div>
        }
      >
        <AIChat
          topic={currentTopic}
          intakeId={intakeId}
          onBack={() => setShowAIChat(false)}
          useCalDark={isDark}
        />
      </Suspense>
    );
  }

  if (view === "privacy") {
    return (
      <div className={landingClass}>
        <div className="landing-background-accent"></div>
        <div className="landing-header">
          <div className="logo-container">
            {renderHeaderLogo()}
            <h1>{t("privacy.title")}</h1>
            <p className="subtitle">{t("app.subtitle")}</p>
            <div className="landing-lang-theme-row">
              <ThemeToggle />
              <LanguagePicker variant={lpVariant} />
            </div>
          </div>
        </div>

        <main className="landing-main" id="main-content">
          <div className="landing-content">
            <p className="tagline left-text">{t("privacy.body")}</p>

            <button
              className="btn btn-primary btn-large btn-start"
              onClick={() => setView(intakeSaved && intakeId ? "intakeChoice" : "intake")}
              disabled={loading}
            >
              {t("privacy.back")}
            </button>
          </div>
        </main>

        <SiteFooter
          className={footerAuthClass}
          supportEmail={SUPPORT_EMAIL}
          showStaffSignIn
        />
        <EmergencyButton />
      </div>
    );
  }

  if (view === "login") {
    return (
      <div className={authPageClass}>
        <div className="auth-github-lang-row">
          <ThemeToggle />
          <LanguagePicker variant={lpVariant} />
        </div>

        <main className="auth-github-main auth-github-main--split" id="main-content">
          <div className="auth-split-inner">
            {renderAuthAside()}
            <div className="auth-split-form-col">
          <h1 className="auth-github-title">{t("login.heading")}</h1>
          <p className="auth-github-sub">{t("login.lead")}</p>

          <form className="auth-github-card" onSubmit={handlePasswordLoginSubmit}>
            {magicVerifyError ? (
              <div className="auth-github-alert" role="alert">
                {magicVerifyError}
              </div>
            ) : null}
            {magicTokenPending ? (
              <div className="auth-github-success" role="status">
                Email link detected. Click below to complete sign-in.
              </div>
            ) : null}
            {passwordResetNotice ? (
              <div className="auth-github-success" role="status">
                {passwordResetNotice}
              </div>
            ) : null}
            {passwordLoginError ? (
              <div className="auth-github-alert" role="alert">
                {passwordLoginError}
              </div>
            ) : null}
            {magicLinkError ? (
              <div className="auth-github-alert" role="alert">
                {magicLinkError}
              </div>
            ) : null}

            <Label className="auth-github-label" htmlFor="auth-signin-email">
              {t("login.emailLabel")}
            </Label>
            <Input
              id="auth-signin-email"
              className="auth-github-input"
              type="email"
              name="login"
              autoComplete="email"
              value={magicLinkEmail}
              onChange={(e) => {
                setMagicLinkEmail(e.target.value);
                setMagicLinkError("");
                setMagicVerifyError("");
                setPasswordLoginError("");
              }}
              disabled={magicLinkBusy || passwordLoginBusy}
            />
            <Label className="auth-github-label" htmlFor="auth-signin-password">
              {t("login.passwordLabel")}
            </Label>
            <div className="auth-password-wrap">
              <Input
                id="auth-signin-password"
                className="auth-github-input auth-github-input--in-password-wrap"
                type={showLoginPassword ? "text" : "password"}
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => {
                  setLoginPassword(e.target.value);
                  setPasswordLoginError("");
                }}
                disabled={magicLinkBusy || passwordLoginBusy}
              />
              <Button
                type="button"
                className="auth-password-toggle"
                size="icon"
                onClick={() => setShowLoginPassword((s) => !s)}
                disabled={magicLinkBusy || passwordLoginBusy}
                aria-label={showLoginPassword ? t("login.hidePassword") : t("login.showPassword")}
                variant="outline"
              >
                {showLoginPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </Button>
            </div>
            {loginPassword ? (
              <p className={`auth-password-strength auth-password-strength--${passwordStrengthKey(loginPassword)}`}>
                {t(`login.passwordStrength.${passwordStrengthKey(loginPassword)}`)}
              </p>
            ) : null}

            <Button
              type="submit"
              className="auth-github-btn-primary"
              disabled={magicLinkBusy || passwordLoginBusy}
              size="lg"
            >
              {passwordLoginBusy ? t("login.signingIn") : t("login.passwordLoginButton")}
            </Button>
            {magicTokenPending ? (
              <Button
                type="button"
                className="auth-github-btn-primary"
                disabled={magicLinkBusy || passwordLoginBusy || magicVerifyBusy}
                onClick={() => void verifyPendingMagicLink()}
                size="lg"
              >
                {magicVerifyBusy ? "Verifying link..." : "Complete sign-in from email link"}
              </Button>
            ) : null}
            <Button
              type="button"
              className="auth-github-btn-secondary"
              disabled={magicLinkBusy || passwordLoginBusy}
              onClick={() => {
                setForgotEmail(String(magicLinkEmail || "").trim().toLowerCase());
                setForgotError("");
                setForgotNotice("");
                setForgotDevLink("");
                setView("forgotPassword");
              }}
              variant="secondary"
              size="lg"
            >
              {t("login.forgotPassword")}
            </Button>
            <Button
              type="button"
              className="auth-github-btn-ghost"
              disabled={magicLinkBusy || passwordLoginBusy}
              onClick={() => sendMagicLinkRequest(magicLinkEmail)}
              variant="ghost"
              size="lg"
            >
              {magicLinkBusy ? t("login.sending") : t("login.emailLoginButton")}
            </Button>
          </form>

          <p className="auth-github-foot">
            {t("login.newUserPrompt")}{" "}
            <Button
              type="button"
              className="auth-github-text-link"
              onClick={() => {
                setMagicLinkError("");
                setMagicVerifyError("");
                setView("intake");
              }}
              variant="link"
            >
              {t("login.createAccount")}
            </Button>
          </p>
          <Button
            type="button"
            className="auth-github-text-link auth-github-foot-solo"
            onClick={() => setView("privacy")}
            variant="link"
          >
            {t("intake.privacyLink")}
          </Button>
            </div>
          </div>
        </main>

        <SiteFooter
          className={footerAuthClass}
          supportEmail={SUPPORT_EMAIL}
          onPrivacyClick={() => setView("privacy")}
          showStaffSignIn
        />
        <EmergencyButton />
      </div>
    );
  }

  if (view === "magicSent") {
    return (
      <div className={authPageClass}>
        <div className="auth-github-lang-row">
          <ThemeToggle />
          <LanguagePicker variant={lpVariant} />
        </div>

        <main className="auth-github-main auth-github-main--split" id="main-content">
          <div className="auth-split-inner">
            {renderAuthAside()}
            <div className="auth-split-form-col">
          <h1 className="auth-github-title">{t("login.checkTitle")}</h1>
          <p className="auth-github-sub">
            {t("login.checkBody", { email: magicLinkSentTo || "—" })}
          </p>

          {magicDevLink && isLocalDevHost() ? (
            <div className="auth-github-dev-box">
              <p className="auth-github-dev-label">{t("login.devLinkLabel")}</p>
              <a className="auth-github-text-link auth-github-dev-link" href={magicDevLink}>
                {magicDevLink}
              </a>
            </div>
          ) : null}

          <div className="auth-github-card auth-github-card--plain">
            <Button
              type="button"
              className="auth-github-btn-primary"
              disabled={magicLinkBusy}
              onClick={() => sendMagicLinkRequest(magicLinkSentTo)}
              size="lg"
            >
              {magicLinkBusy ? t("login.sending") : t("login.resend")}
            </Button>
            <Button
              type="button"
              className="auth-github-btn-secondary"
              onClick={() => {
                setMagicLinkError("");
                setMagicDevLink("");
                setView("login");
              }}
              variant="secondary"
              size="lg"
            >
              {t("login.backToSignIn")}
            </Button>
          </div>

          <Button
            type="button"
            className="auth-github-text-link auth-github-foot-solo"
            onClick={() => setView("privacy")}
            variant="link"
          >
            {t("intake.privacyLink")}
          </Button>
            </div>
          </div>
        </main>

        <SiteFooter
          className={footerAuthClass}
          supportEmail={SUPPORT_EMAIL}
          onPrivacyClick={() => setView("privacy")}
          showStaffSignIn
        />
        <EmergencyButton />
      </div>
    );
  }

  if (view === "forgotPassword") {
    return (
      <div className={authPageClass}>
        <div className="auth-github-lang-row">
          <ThemeToggle />
          <LanguagePicker variant={lpVariant} />
        </div>
        <main className="auth-github-main auth-github-main--split" id="main-content">
          <div className="auth-split-inner">
            {renderAuthAside()}
            <div className="auth-split-form-col">
          <h1 className="auth-github-title">{t("login.forgotTitle")}</h1>
          <p className="auth-github-sub">{t("login.forgotBody")}</p>
          <form className="auth-github-card" onSubmit={handleForgotPasswordSubmit}>
            {forgotError ? (
              <div className="auth-github-alert" role="alert">
                {forgotError}
              </div>
            ) : null}
            {forgotNotice ? (
              <div className="auth-github-success" role="status">
                {forgotNotice}
              </div>
            ) : null}
            {forgotDevLink && isLocalDevHost() ? (
              <div className="auth-github-dev-box">
                <p className="auth-github-dev-label">{t("login.resetDevLinkLabel")}</p>
                <a className="auth-github-text-link auth-github-dev-link" href={forgotDevLink}>
                  {forgotDevLink}
                </a>
              </div>
            ) : null}
            <Label className="auth-github-label" htmlFor="auth-forgot-email">
              {t("login.emailLabel")}
            </Label>
            <Input
              id="auth-forgot-email"
              className="auth-github-input"
              type="email"
              autoComplete="email"
              value={forgotEmail}
              onChange={(e) => {
                setForgotEmail(e.target.value);
                setForgotError("");
              }}
              disabled={forgotBusy}
            />
            <Button type="submit" className="auth-github-btn-primary" disabled={forgotBusy} size="lg">
              {forgotBusy ? t("login.sending") : t("login.sendReset")}
            </Button>
            <Button
              type="button"
              className="auth-github-btn-secondary"
              onClick={() => setView("login")}
              disabled={forgotBusy}
              variant="secondary"
              size="lg"
            >
              {t("login.backToSignIn")}
            </Button>
          </form>
            </div>
          </div>
        </main>
        <SiteFooter
          className={footerAuthClass}
          supportEmail={SUPPORT_EMAIL}
          onPrivacyClick={() => setView("privacy")}
          showStaffSignIn
        />
        <EmergencyButton />
      </div>
    );
  }

  if (view === "resetPassword") {
    return (
      <div className={authPageClass}>
        <div className="auth-github-lang-row">
          <ThemeToggle />
          <LanguagePicker variant={lpVariant} />
        </div>
        <main className="auth-github-main auth-github-main--split" id="main-content">
          <div className="auth-split-inner">
            {renderAuthAside()}
            <div className="auth-split-form-col">
          <h1 className="auth-github-title">{t("login.resetTitle")}</h1>
          <p className="auth-github-sub">{t("login.resetBody")}</p>
          <form className="auth-github-card" onSubmit={handleResetPasswordSubmit}>
            {resetError ? (
              <div className="auth-github-alert" role="alert">
                {resetError}
              </div>
            ) : null}
            <Label className="auth-github-label" htmlFor="auth-reset-password-1">
              {t("login.newPassword")}
            </Label>
            <div className="auth-password-wrap">
              <Input
                id="auth-reset-password-1"
                className="auth-github-input auth-github-input--in-password-wrap"
                type={showResetPassword1 ? "text" : "password"}
                autoComplete="new-password"
                value={resetPassword1}
                onChange={(e) => {
                  setResetPassword1(e.target.value);
                  setResetError("");
                }}
                disabled={resetBusy}
              />
              <Button
                type="button"
                className="auth-password-toggle"
                size="icon"
                onClick={() => setShowResetPassword1((s) => !s)}
                disabled={resetBusy}
                aria-label={showResetPassword1 ? t("login.hidePassword") : t("login.showPassword")}
                variant="outline"
              >
                {showResetPassword1 ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </Button>
            </div>
            {resetPassword1 ? (
              <p className={`auth-password-strength auth-password-strength--${passwordStrengthKey(resetPassword1)}`}>
                {t(`login.passwordStrength.${passwordStrengthKey(resetPassword1)}`)}
              </p>
            ) : null}
            <Label className="auth-github-label" htmlFor="auth-reset-password-2">
              {t("login.confirmPassword")}
            </Label>
            <div className="auth-password-wrap">
              <Input
                id="auth-reset-password-2"
                className="auth-github-input auth-github-input--in-password-wrap"
                type={showResetPassword2 ? "text" : "password"}
                autoComplete="new-password"
                value={resetPassword2}
                onChange={(e) => {
                  setResetPassword2(e.target.value);
                  setResetError("");
                }}
                disabled={resetBusy}
              />
              <Button
                type="button"
                className="auth-password-toggle"
                size="icon"
                onClick={() => setShowResetPassword2((s) => !s)}
                disabled={resetBusy}
                aria-label={showResetPassword2 ? t("login.hidePassword") : t("login.showPassword")}
                variant="outline"
              >
                {showResetPassword2 ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </Button>
            </div>
            <Button type="submit" className="auth-github-btn-primary" disabled={resetBusy} size="lg">
              {resetBusy ? t("login.savingPassword") : t("login.resetPasswordButton")}
            </Button>
            <Button
              type="button"
              className="auth-github-btn-secondary"
              onClick={() => setView("login")}
              disabled={resetBusy}
              variant="secondary"
              size="lg"
            >
              {t("login.backToSignIn")}
            </Button>
          </form>
            </div>
          </div>
        </main>
        <SiteFooter
          className={footerAuthClass}
          supportEmail={SUPPORT_EMAIL}
          onPrivacyClick={() => setView("privacy")}
          showStaffSignIn
        />
        <EmergencyButton />
      </div>
    );
  }

  if (view === "intakeChoice") {
    const hasSaved = intakeSaved && intakeId;

    return (
      <div className={authPageClass}>
        <div className="auth-github-lang-row">
          <ThemeToggle />
          <LanguagePicker variant={lpVariant} />
        </div>

        <main className="auth-github-main auth-github-main--split" id="main-content">
          <div className="auth-split-inner">
            {renderAuthAside()}
            <div className="auth-split-form-col">
          <h1 className="auth-github-title">{t("login.welcomeBackTitle")}</h1>
          <p className="auth-github-sub">{t("login.welcomeBackBody")}</p>

          <div className="auth-github-card auth-github-card--plain">
            <button
              type="button"
              className="auth-github-btn-primary"
              onClick={() => setView("cover")}
              disabled={loading || !hasSaved}
            >
              {t("login.continueThisDevice")}
            </button>
            <button
              type="button"
              className="auth-github-btn-secondary"
              onClick={() => {
                setMagicLinkEmail("");
                setMagicLinkError("");
                setMagicVerifyError("");
                setView("login");
              }}
              disabled={loading}
            >
              {t("login.useDifferentEmail")}
            </button>
            <button
              type="button"
              className="auth-github-btn-ghost"
              onClick={() => {
                clearSavedIntake();
                setMagicLinkEmail("");
                setMagicLinkError("");
                setMagicVerifyError("");
                setView("login");
              }}
              disabled={loading}
            >
              {t("login.signOutDevice")}
            </button>
          </div>

          <button
            type="button"
            className="auth-github-text-link auth-github-foot-solo"
            onClick={() => setView("privacy")}
          >
            {t("intake.privacyLink")}
          </button>
            </div>
          </div>
        </main>

        <SiteFooter
          className={footerAuthClass}
          supportEmail={SUPPORT_EMAIL}
          onPrivacyClick={() => setView("privacy")}
          showStaffSignIn
        />
        <EmergencyButton />
      </div>
    );
  }

  if (view === "intake") {
    return (
      <div className={authPageClass}>
        <div className="auth-github-lang-row">
          <ThemeToggle />
          <LanguagePicker variant={lpVariant} />
        </div>

        <main className="auth-github-main auth-github-main--split" id="main-content">
          <div className="auth-split-inner">
            {renderAuthAside()}
            <div className="auth-split-form-col auth-split-form-col--intake">
          <h1 className="auth-github-title">{t("login.createAccountTitle")}</h1>
          <p className="auth-github-sub">{t("intake.subtitle")}</p>

          <div className="auth-github-intake-role-row" role="group" aria-label={t("login.intakeLoginChoiceAria")}>
            <button
              type="button"
              className="auth-github-btn-secondary auth-github-intake-role-btn"
              onClick={() => {
                setMagicLinkError("");
                setMagicVerifyError("");
                setView("login");
              }}
              disabled={loading}
            >
              {t("login.clientLogin")}
            </button>
            <button
              type="button"
              className="auth-github-btn-secondary auth-github-intake-role-btn"
              onClick={() => {
                window.location.hash = "#/admin";
              }}
              disabled={loading}
            >
              {t("login.staffLogin")}
            </button>
          </div>

          <p className="auth-github-returning">
            {t("login.returningPrompt")}{" "}
            <button
              type="button"
              className="auth-github-text-link"
              onClick={() => {
                setMagicLinkError("");
                setMagicVerifyError("");
                setView("login");
              }}
            >
              {t("login.signInWithEmail")}
            </button>
          </p>

          <form
            className="auth-github-card"
            onSubmit={(e) => {
              e.preventDefault();
              submitIntake();
            }}
          >
            <div className="intake-grid auth-github-intake-grid">
              <input
                className="auth-github-input"
                type="text"
                value={intakeFirstName}
                onChange={(e) => setIntakeFirstName(e.target.value)}
                placeholder={t("intake.firstName")}
                disabled={loading}
              />
              <input
                className="auth-github-input"
                type="text"
                value={intakeLastName}
                onChange={(e) => setIntakeLastName(e.target.value)}
                placeholder={t("intake.lastName")}
                disabled={loading}
              />
              <input
                className="auth-github-input"
                type="tel"
                value={intakePhone}
                onChange={(e) => setIntakePhone(e.target.value)}
                placeholder={t("intake.phone")}
                disabled={loading}
              />
              <input
                className="auth-github-input"
                type="email"
                value={intakeEmail}
                onChange={(e) => setIntakeEmail(e.target.value)}
                placeholder={t("intake.email")}
                disabled={loading}
              />
              <div className="auth-password-wrap">
                <input
                  className="auth-github-input auth-github-input--in-password-wrap"
                  type={showIntakePassword ? "text" : "password"}
                  value={intakePassword}
                  onChange={(e) => setIntakePassword(e.target.value)}
                  placeholder={t("login.createPassword")}
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="auth-password-toggle auth-password-toggle--icon"
                  onClick={() => setShowIntakePassword((s) => !s)}
                  disabled={loading}
                  aria-label={showIntakePassword ? t("login.hidePassword") : t("login.showPassword")}
                >
                  {showIntakePassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                </button>
              </div>
              <div className="auth-password-wrap">
                <input
                  className="auth-github-input auth-github-input--in-password-wrap"
                  type={showIntakePasswordConfirm ? "text" : "password"}
                  value={intakePasswordConfirm}
                  onChange={(e) => setIntakePasswordConfirm(e.target.value)}
                  placeholder={t("login.confirmAccountPassword")}
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="auth-password-toggle auth-password-toggle--icon"
                  onClick={() => setShowIntakePasswordConfirm((s) => !s)}
                  disabled={loading}
                  aria-label={showIntakePasswordConfirm ? t("login.hidePassword") : t("login.showPassword")}
                >
                  {showIntakePasswordConfirm ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </button>
              </div>
              {intakePassword ? (
                <p className={`auth-password-strength auth-password-strength--${passwordStrengthKey(intakePassword)}`}>
                  {t(`login.passwordStrength.${passwordStrengthKey(intakePassword)}`)}
                </p>
              ) : null}

              <label className="consent-label auth-github-consent">
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
                    className="auth-github-inline-link"
                  >
                    {t("intake.privacyLink")}
                  </button>
                </span>
              </label>

              {intakeError ? (
                <div className="auth-github-alert" role="alert">
                  {intakeError}
                </div>
              ) : null}

              <button className="auth-github-btn-primary" type="submit" disabled={loading}>
                {loading
                  ? intakeSubmitPhase === "retrying"
                    ? t("intake.retryingDetail")
                    : t("intake.savingDetail")
                  : t("intake.submit")}
              </button>
            </div>
          </form>
            </div>
          </div>
        </main>

        <SiteFooter
          className={footerAuthClass}
          supportEmail={SUPPORT_EMAIL}
          onPrivacyClick={() => setView("privacy")}
        />
        <EmergencyButton />
      </div>
    );
  }

  if (view === "intakeSuccess") {
    return (
      <div className={landingClass}>
        <div className="landing-background-accent"></div>
        <div className="landing-header">
          <div className="logo-container">
            {renderHeaderLogo()}
            <h1>{t("intake.successTitle")}</h1>
            <p className="subtitle">{t("app.subtitle")}</p>
            <div className="landing-lang-theme-row">
              <ThemeToggle />
              <LanguagePicker variant={lpVariant} />
            </div>
          </div>
        </div>

        <main className="landing-main intake-success-main" id="main-content">
          <div className="landing-content">
            <p className="tagline intake-success-body">{t("intake.successBody")}</p>
            <button
              type="button"
              className="btn btn-primary btn-large btn-start"
              onClick={() => setView("cover")}
            >
              {t("intake.continueToPortal")}
            </button>
          </div>
        </main>

        <SiteFooter
          className={footerAuthClass}
          supportEmail={SUPPORT_EMAIL}
          onPrivacyClick={() => setView("privacy")}
          showStaffSignIn
        />
        <EmergencyButton />
      </div>
    );
  }

  if (!showChat || view === "cover") {
    return (
      <div className={landingClass}>
        <div className="landing-background-accent"></div>
        <div className="landing-header">
          <div className="logo-container">
            {renderHeaderLogo()}
            <h1>{t("app.title")}</h1>
            <p className="subtitle">{t("app.subtitle")}</p>
            <div className="landing-lang-theme-row">
              <ThemeToggle />
              <LanguagePicker variant={lpVariant} />
            </div>
          </div>
        </div>

        <main className="landing-main" id="main-content">
          <div className="landing-content">
          <h2>{t("landing.welcomeTitle")}</h2>
          <p className="tagline">{t("landing.tagline")}</p>

          <TrustPanel className="trust-panel-landing" />

          <LegalGlossary className="legal-glossary-landing" />

          <div className="topic-cards">
            {topicCards.map((card) => (
              <div key={card.key} className="topic-card professional-topic-card">
                <div className="topic-card-icon">{card.icon}</div>
                <h3>{card.title}</h3>
                <p>{card.desc}</p>
              </div>
            ))}
          </div>

          {pendingTriage ? (
            <div className="resume-session-card">
              <h3 className="resume-session-title">{t("resume.title")}</h3>
              <p className="resume-session-detail">{t("resume.detail")}</p>
              <div className="resume-session-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-large btn-start"
                  onClick={resumeTriageFromCover}
                  disabled={loading}
                >
                  {t("resume.continueBtn")}
                </button>
                <button
                  type="button"
                  className="btn btn-start btn-cover-secondary"
                  onClick={discardPendingAndStartFresh}
                  disabled={loading}
                >
                  {t("resume.startNewBtn")}
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn btn-primary btn-large btn-start"
              onClick={startChatFromCover}
              disabled={loading}
            >
              {t("landing.begin")}
            </button>
          )}

          <div className="contact-help-box">
            <p>
              Need help? Email:{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </p>
          </div>

          <div className="disclaimer-box">
            <p className="disclaimer-title">{t("landing.importantNoticeTitle")}</p>
            <p className="disclaimer-text">
              <strong>{t("landing.infoOnly")}</strong>
            </p>
            <p className="privacy-warning">
              ⚠️ <strong>{t("landing.privacyTitle")}</strong> {t("landing.privacyText")}
            </p>
          </div>

          <div className="secondary-link-wrap secondary-link-wrap--split">
            <button
              type="button"
              onClick={() => setView(intakeSaved && intakeId ? "intakeChoice" : "intake")}
              className="link-button"
            >
              {t("login.backToSignIn")}
            </button>
            <span className="secondary-link-sep" aria-hidden="true">
              ·
            </span>
            <button
              type="button"
              onClick={() => {
                setMagicLinkError("");
                setMagicVerifyError("");
                setView("login");
              }}
              className="link-button"
            >
              {t("login.signInWithEmail")}
            </button>
          </div>
          </div>
        </main>

        <SiteFooter
          className={footerAuthClass}
          supportEmail={SUPPORT_EMAIL}
          onPrivacyClick={() => setView("privacy")}
          showStaffSignIn
        />
        <EmergencyButton />
      </div>
    );
  }

  const progress = conversationState?.progress || {};
  const progressCurrent = Number(progress.current || 1);
  const progressTotal = Number(progress.total || 6);

  const progressLabel =
    progress.label_key
      ? t(progress.label_key)
      : String(progress.label || t("progress.defaultLabel"));

  const progressPercent = Math.min(
    100,
    Math.max(0, (progressCurrent / progressTotal) * 100)
  );

  const referralMatchLine = () => {
    const lv = Number(conversationState?.level);
    if (lv === 3) return t("referral.matchLevel3");
    if (lv === 2) return t("referral.matchLevel2");
    return t("referral.matchLevel1");
  };

  return (
    <div className={chatShellClass}>
      <div className="chat-header">
        <div className="header-content">
          <img
            src={calLogo}
            alt="Chicago Advocate Legal, NFP logo"
            className="chat-header-logo"
          />
          <div className="header-text">
            <h2>CAL Legal Information and Resources Chatbot</h2>
            <p>Information & Referrals</p>
          </div>
          <div className="header-right">
            <button
              type="button"
              className="btn btn-large-text-toggle"
              onClick={() => setLargeText((v) => !v)}
              aria-pressed={largeText}
            >
              {largeText ? t("accessibility.largeTextOff") : t("accessibility.largeText")}
            </button>
            <ThemeToggle />
            <LanguagePicker variant={lpVariant} labelOnDarkBackground />
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

        <main className="chat-main" id="main-content">
        <div className="messages-container" ref={messagesContainerRef}>
          {chatError && (
            <StatusBanner type="error" className="chat-status-banner" role="alert">
              {chatError}
            </StatusBanner>
          )}

          {loading && (
            <StatusBanner type="info" className="chat-status-banner">
              {t("chat.loadingBanner")}
            </StatusBanner>
          )}

          {messages.length === 0 && !loading && (
            <div className="empty-state">
              <p>{t("chat.starting")}</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`message-wrapper ${msg.role} ${
                msg.role === "bot" && msg.referrals?.length ? "has-referrals" : ""
              }`}
            >
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
                      {msg.decision_support && (
                        <div className="decision-support-card" role="status" aria-live="polite">
                          <h4 className="decision-support-title">Decision support snapshot</h4>
                          <p className="decision-support-disclaimer">
                            Informational triage support only - not legal advice.
                          </p>
                          <div className="decision-support-metrics">
                            <div className="decision-metric">
                              <span className="decision-metric-label">Overall risk</span>
                              <span className="decision-metric-value">
                                {Number(msg.decision_support?.overall_risk ?? 0)}/100 (
                                {String(msg.decision_support?.overall_band || "low")})
                              </span>
                            </div>
                            <div className="decision-metric">
                              <span className="decision-metric-label">Urgency</span>
                              <span className="decision-metric-value">
                                {Number(msg.decision_support?.urgency?.score ?? 0)}/100 (
                                {String(msg.decision_support?.urgency?.band || "low")})
                              </span>
                            </div>
                            <div className="decision-metric">
                              <span className="decision-metric-label">Complexity</span>
                              <span className="decision-metric-value">
                                {Number(msg.decision_support?.complexity?.score ?? 0)}/100 (
                                {String(msg.decision_support?.complexity?.band || "low")})
                              </span>
                            </div>
                            <div className="decision-metric">
                              <span className="decision-metric-label">Self-help suitability</span>
                              <span className="decision-metric-value">
                                {Number(msg.decision_support?.self_help?.score ?? 0)}/100 (
                                {String(msg.decision_support?.self_help?.band || "low")})
                              </span>
                            </div>
                          </div>
                          <div className="decision-support-why">
                            <p className="decision-support-why-title">Why these scores:</p>
                            <ul>
                              {[
                                ...(Array.isArray(msg.decision_support?.urgency?.reasons)
                                  ? msg.decision_support.urgency.reasons
                                  : []),
                                ...(Array.isArray(msg.decision_support?.complexity?.reasons)
                                  ? msg.decision_support.complexity.reasons
                                  : []),
                                ...(Array.isArray(msg.decision_support?.self_help?.reasons)
                                  ? msg.decision_support.self_help.reasons
                                  : []),
                              ]
                                .slice(0, 5)
                                .map((reason, rIdx) => (
                                  <li key={`${reason}-${rIdx}`}>{String(reason)}</li>
                                ))}
                            </ul>
                          </div>
                        </div>
                      )}
                      <h4 className="referrals-title">{t("chat.referralsTitle")}</h4>
                      {msg.referrals.map((ref, i) => (
                        <div key={i} className="referral-card">
                          <div className="referral-header">
                            <h3>{ref.name}</h3>
                          </div>
                          <p className="referral-why">{referralMatchLine()}</p>
                          <p className="referral-description">{ref.description}</p>

                          <div className="referral-summary-row">
                            {ref.phone && ref.phone !== "" && (
                              <span className="referral-summary-pill">
                                <FaPhone size={12} />
                                <span>{ref.phone}</span>
                              </span>
                            )}

                            {ref.intake_form && ref.intake_form !== "" && (
                              <span className="referral-summary-pill">
                                <FaFileAlt size={12} />
                                <span>Intake Form</span>
                              </span>
                            )}

                            {ref.url && ref.url !== "" && (
                              <span className="referral-summary-pill">
                                <FaInfoCircle size={12} />
                                <span>Website Available</span>
                              </span>
                            )}
                          </div>

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

                            {ref.special_education_helpline &&
                              ref.special_education_helpline !== "" && (
                                <div className="contact-item">
                                  <FaPhone size={14} />
                                  <span>
                                    <strong>Special Education Helpline:</strong>{" "}
                                    {ref.special_education_helpline}
                                  </span>
                                </div>
                              )}
                          </div>

                          <ReferralMap
                            referral={ref}
                            userZip={conversationState?.zip_code}
                            t={t}
                          />

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
                              Connect with Chicago Advocate Legal, NFP
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

                      {conversationState.step === "complete" &&
                        msg.referrals?.length > 0 &&
                        idx ===
                          messages.findLastIndex(
                            (m) => m.referrals && m.referrals.length
                          ) && (
                          <div className="post-referral-tools">
                            <button
                              type="button"
                              className="btn btn-print-resources"
                              onClick={handlePrintReferrals}
                            >
                              <FaPrint /> {t("chat.printResources")}
                            </button>
                            {triageFeedback !== "done" ? (
                              <div
                                className="triage-feedback"
                                role="group"
                                aria-label={t("chat.feedbackQuestion")}
                              >
                                <p className="triage-feedback-q">
                                  {t("chat.feedbackQuestion")}
                                </p>
                                <div className="triage-feedback-btns">
                                  <button
                                    type="button"
                                    className="btn btn-feedback"
                                    onClick={() => handleTriageFeedback(true)}
                                    disabled={loading}
                                  >
                                    {t("chat.feedbackYes")}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-feedback btn-feedback-secondary"
                                    onClick={() => handleTriageFeedback(false)}
                                    disabled={loading}
                                  >
                                    {t("chat.feedbackNo")}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="triage-feedback-thanks" role="status">
                                {t("chat.feedbackThanks")}
                              </p>
                            )}
                          </div>
                        )}

                      {conversationState.step === "complete" &&
                        msg.referrals?.length > 0 &&
                        idx ===
                          messages.findLastIndex(
                            (m) => m.referrals && m.referrals.length
                          ) && (
                          <GuidedCaseTimelinePanel
                            topic={conversationState.topic}
                            onTrackEvent={(eventType, eventValue) =>
                              postIntakeEvent(eventType, eventValue)
                            }
                          />
                        )}

                      {conversationState.step === "complete" &&
                        msg.referrals?.length > 0 &&
                        idx ===
                          messages.findLastIndex(
                            (m) => m.referrals && m.referrals.length
                          ) && (
                          <TopicResourcesPanel topic={conversationState.topic} />
                        )}

                      {conversationState.step === "complete" &&
                        msg.referrals?.length > 0 &&
                        idx ===
                          messages.findLastIndex(
                            (m) => m.referrals && m.referrals.length
                          ) && (
                          <DocumentGeneratorPanel
                            topic={conversationState.topic}
                            intakeId={intakeId}
                          />
                        )}

                      {conversationState.step === "complete" && (
                        <div className="ai-assistant-prompt">
                          <button
                            className="btn btn-ai-assistant"
                            onClick={() => {
                              postIntakeEvent("ai_assistant_opened", currentTopic || "");
                              setShowAIChat(true);
                            }}
                          >
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
                          {safeOptionLabel(option)}
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
              placeholder={
                conversationState?.step === "problem_summary"
                  ? t("chat.placeholderSummary")
                  : ["summary_topic_confirm", "topic_reconfirm"].includes(
                      String(conversationState?.step || "").toLowerCase()
                    )
                    ? t("chat.placeholderTopicAlign")
                    : t("chat.placeholder")
              }
              disabled={loading}
              className="chat-input"
            />
            <button type="submit" className="btn btn-send" disabled={loading}>
              {loading ? (
                <span className="send-loading-spinner" aria-hidden="true"></span>
              ) : (
                <FaPaperPlane size={20} />
              )}
            </button>
          </form>
        </div>

        <div className="chat-footer">
          <p className="footer-disclaimer">{t("landing.infoOnly")}</p>
          <p className="footer-privacy-warning">
            Quick Exit is available if you need to leave this page quickly.
          </p>
        </div>
        </main>

        <SiteFooter
          supportEmail={SUPPORT_EMAIL}
          className={chatFooterClassName}
        />
      </div>

      <EmergencyButton />
    </div>
  );
}

export default App;