import React, { useState, useEffect, useLayoutEffect, useRef, lazy, Suspense, useMemo } from "react";
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
import "./HomeCover.css";
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
import { Eye, EyeOff, Send, RotateCcw, Loader2, ArrowLeft, ShieldAlert, Trash2, Volume2, VolumeX, Check, Shield, Lock, Clock } from "lucide-react";

import { useTranslation } from "react-i18next";
import i18n, { setAppLanguage, getNormalizedLanguage } from "./i18n";
import SlackLayout from "./components/layout/SlackLayout";
import LoginLayout from "./components/LoginLayout";
import ReferralCard from "./components/ReferralCard";
import ChatMessage from "./components/ChatMessage";
import CaseSummaryCard from "./components/CaseSummaryCard";
import { Textarea } from "./components/ui/textarea";
import DocumentsPage from "./components/DocumentsPage";
import ResourcesPage from "./components/ResourcesPage";
import SettingsPage from "./components/SettingsPage";
import MyCasesPage, { saveCaseToStorage } from "./components/MyCasesPage";

const AIChat = lazy(() => import("./components/AIChat"));
const ChatDashboard = lazy(() => import("./components/ChatDashboard"));

const FIRST_VISIT_KEY = "cal_first_visit_done_v1";
const INTAKE_ID_KEY = "cal_intake_id_v1";
const INTAKE_SAVED_KEY = "cal_intake_saved_v1";
const LARGE_TEXT_KEY = "cal_large_text_v1";
const INTAKE_PROFILE_KEY = "cal_intake_profile_v1";
const SAVED_REFERRALS_KEY = "cal_saved_referrals_v1";
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
    fetch(target, options).then((res) => {
      if (res.status === 401) {
        window.dispatchEvent(new CustomEvent("cal:session-expired"));
      }
      return res;
    }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), timeout)
    ),
  ]);
}

/**
 * Email magic links use `/?magic_token=…`. Some clients or redirects leave the token only
 * inside the hash (`#/…?magic_token=…`), where `location.search` is empty — then verify would
 * send an empty token unless we read the hash too.
 */
function getMagicTokenFromLocation() {
  try {
    const fromSearch = new URLSearchParams(window.location.search).get("magic_token");
    if (fromSearch) return String(fromSearch).trim();
    const hash = window.location.hash || "";
    const m = /[?&]magic_token=([^&]+)/.exec(hash);
    if (!m) return "";
    let v = m[1];
    try {
      v = decodeURIComponent(v.replace(/\+/g, "%20"));
    } catch {
      /* keep raw fragment */
    }
    return String(v).trim();
  } catch {
    return "";
  }
}

function stripMagicTokenFromLocation() {
  try {
    const path = window.location.pathname || "/";
    const sp = new URLSearchParams(
      (window.location.search || "").startsWith("?") ? window.location.search.slice(1) : window.location.search
    );
    sp.delete("magic_token");
    const qs = sp.toString();

    let hash = window.location.hash || "";
    if (hash.includes("magic_token=")) {
      hash = hash.replace(/\?magic_token=[^&]+/g, "").replace(/&magic_token=[^&]+/g, "");
      hash = hash.replace(/\?$/, "");
    }

    window.history.replaceState({}, "", `${path}${qs ? `?${qs}` : ""}${hash}`);
  } catch {
    /* ignore */
  }
}

/** Survives React StrictMode double-effect so we do not POST verify twice for one token. */
let __magicLinkAutoVerifyToken = "";

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

  const [intakeFirstName, setIntakeFirstName] = useState(() => {
    try { return JSON.parse(localStorage.getItem(INTAKE_PROFILE_KEY) || "{}").firstName || ""; } catch { return ""; }
  });
  const [intakeLastName, setIntakeLastName] = useState(() => {
    try { return JSON.parse(localStorage.getItem(INTAKE_PROFILE_KEY) || "{}").lastName || ""; } catch { return ""; }
  });
  const [intakeEmail, setIntakeEmail] = useState(() => {
    try { return JSON.parse(localStorage.getItem(INTAKE_PROFILE_KEY) || "{}").email || ""; } catch { return ""; }
  });
  const [intakePassword, setIntakePassword] = useState("");
  const [intakePasswordConfirm, setIntakePasswordConfirm] = useState("");
  const [intakePhone, setIntakePhone] = useState(() => {
    try { return JSON.parse(localStorage.getItem(INTAKE_PROFILE_KEY) || "{}").phone || ""; } catch { return ""; }
  });
  const [sidebarSection, setSidebarSection] = useState(null);
  const [intakeConsent, setIntakeConsent] = useState(false);
  const chatSessionIdRef = useRef(null);

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
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [resendVerifyBusy, setResendVerifyBusy] = useState(false);
  const [resendVerifyNotice, setResendVerifyNotice] = useState("");
  const [verifyEmailNotice, setVerifyEmailNotice] = useState("");
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

  const [intakeFieldTouched, setIntakeFieldTouched] = useState({});
  const [intakeFieldErrors, setIntakeFieldErrors] = useState({});
  const [showEmailSent, setShowEmailSent] = useState(false);
  const [emailSentResendBusy, setEmailSentResendBusy] = useState(false);
  const [showNextTooltip, setShowNextTooltip] = useState(false);
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [inactivityToast, setInactivityToast] = useState(false);
  const sessionTimers = useRef({ warning: null, signout: null });

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

  const formatPhoneInput = (raw) => {
    const digits = String(raw || "").replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const passwordStrength4 = (pw) => {
    const p = String(pw || "");
    if (!p) return 0;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  };

  const getStrengthInfo = (score) => {
    const s4 = [
      { label: t("auth.register.strengthWeak"), color: "#DC2626" },
      { label: t("auth.register.strengthFair"), color: "#F97316" },
      { label: t("auth.register.strengthStrong"), color: "#EAB308" },
      { label: t("auth.register.strengthVeryStrong"), color: "#16A34A" },
    ];
    return s4[Math.max(0, Math.min(3, score - 1))] || s4[0];
  };

  const validateIntakeField = (name, value, extra) => {
    switch (name) {
      case "firstName":
        if (!String(value || "").trim()) return t("auth.register.fieldFirstNameRequired");
        if (/\d/.test(value)) return t("auth.register.fieldFirstNameNoNumbers");
        return "";
      case "lastName":
        if (!String(value || "").trim()) return t("auth.register.fieldLastNameRequired");
        if (/\d/.test(value)) return t("auth.register.fieldLastNameNoNumbers");
        return "";
      case "email":
        if (!String(value || "").trim()) return t("auth.register.fieldEmailRequired");
        if (!isValidEmail(value)) return t("auth.register.fieldEmailInvalid");
        return "";
      case "phone":
        if (!String(value || "").trim()) return t("auth.register.fieldPhoneRequired");
        if (!isValidUSPhone(value)) return t("auth.register.fieldPhoneInvalid");
        return "";
      case "password":
        if (String(value || "").length < 8) return t("auth.register.fieldPasswordMin");
        return "";
      case "confirmPassword":
        if (value !== extra) return t("auth.register.fieldPasswordMismatch");
        return "";
      default:
        return "";
    }
  };

  const handleIntakeBlur = (name, value, extra) => {
    setIntakeFieldTouched((prev) => ({ ...prev, [name]: true }));
    const err = validateIntakeField(name, value, extra);
    setIntakeFieldErrors((prev) => ({ ...prev, [name]: err }));
  };

  const handleResendVerification = async () => {
    if (emailSentResendBusy) return;
    setEmailSentResendBusy(true);
    try {
      await fetchWithTimeout(
        apiUrl("/auth/magic-link/request"),
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: intakeEmail.trim().toLowerCase() }) },
        INTAKE_FETCH_TIMEOUT_MS
      );
    } catch { /* ignore */ }
    setEmailSentResendBusy(false);
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

  // BUG 1: Re-sync profile state from localStorage when intakeId becomes available
  useEffect(() => {
    if (!intakeId) return;
    try {
      const p = JSON.parse(localStorage.getItem(INTAKE_PROFILE_KEY) || "{}");
      if (p.firstName) setIntakeFirstName((prev) => prev || p.firstName);
      if (p.lastName) setIntakeLastName((prev) => prev || p.lastName);
      if (p.email) setIntakeEmail((prev) => prev || p.email);
      if (p.phone) setIntakePhone((prev) => prev || p.phone);
    } catch {}
  }, [intakeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // BUG 3: Reset chat session ID when user leaves chat so next session gets a fresh ID
  useEffect(() => {
    if (!showChat) chatSessionIdRef.current = null;
  }, [showChat]);

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

    const verifyTokenParam = params.get("verify_token") ||
      (() => { const m = /[?&]verify_token=([^&]+)/.exec(window.location.hash || ""); return m ? decodeURIComponent(m[1].replace(/\+/g, "%20")) : ""; })();
    if (verifyTokenParam) {
      const vt = String(verifyTokenParam).trim();
      fetchWithTimeout(
        apiPath("/auth/verify-email") + "?token=" + encodeURIComponent(vt),
        {},
        INTAKE_FETCH_TIMEOUT_MS
      ).then((res) => res.json().catch(() => ({}))).then((data) => {
        if (data && data.status === "verified") {
          setVerifyEmailNotice("Your email has been verified. You can now sign in.");
        } else {
          setPasswordLoginError(
            (data && data.detail ? String(data.detail) : null) ||
            "Verification link is invalid or expired. Please request a new link."
          );
        }
      }).catch(() => {
        setPasswordLoginError("Email verification failed. Please request a new link.");
      });
      try {
        const h = (window.location.hash || "").replace(/[?&]verify_token=[^&]+/g, "").replace(/\?$/, "");
        window.history.replaceState({}, "", window.location.pathname + (window.location.search || "") + h);
      } catch { /* ignore */ }
      setView("login");
      return undefined;
    }

    const resetTokenParam = params.get("reset_token") ||
      (() => { const m = /[?&]reset_token=([^&]+)/.exec(window.location.hash || ""); return m ? decodeURIComponent(m[1].replace(/\+/g, "%20")) : ""; })();
    if (resetTokenParam) {
      setResetToken(String(resetTokenParam).trim());
      setResetError("");
      setView("resetPassword");
      return undefined;
    }

    const token = getMagicTokenFromLocation();
    if (!token) return undefined;
    setMagicTokenPending(token);
    setMagicVerifyError("");
    setView("login");
    return undefined;
  }, []);

  const verifyMagicLinkWithToken = async (tokenOverride) => {
    const token = String(tokenOverride ?? magicTokenPending ?? "").trim();
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
        const d = data?.detail;
        const detailMsg = Array.isArray(d)
          ? d
              .map((x) => (typeof x === "string" ? x : x?.msg || JSON.stringify(x)))
              .filter(Boolean)
              .join("; ")
          : d != null
            ? String(d)
            : "";
        throw new Error(detailMsg || i18n.t("login.verifyFailed"));
      }
      stripMagicTokenFromLocation();
      setMagicTokenPending("");
      __magicLinkAutoVerifyToken = "";
      completeLogin(data);
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

  const verifyPendingMagicLink = async () => verifyMagicLinkWithToken(magicTokenPending);

  useEffect(() => {
    if (view !== "login") return;
    const token = String(magicTokenPending || "").trim();
    if (!token) return;
    if (__magicLinkAutoVerifyToken === token) return;
    __magicLinkAutoVerifyToken = token;
    void verifyMagicLinkWithToken(token);
  }, [view, magicTokenPending]);

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

  const SESSION_WARNING_DELAY = 25 * 60 * 1000;
  const SESSION_SIGNOUT_DELAY = 5 * 60 * 1000;
  useEffect(() => {
    const authViews = ["intake", "login", "magicSent", "forgotPassword", "resetPassword", "intakeChoice", "intakeSuccess"];
    const isActive = intakeSaved && intakeId && !authViews.includes(view);
    if (!isActive) return undefined;
    const reset = () => {
      clearTimeout(sessionTimers.current.warning);
      clearTimeout(sessionTimers.current.signout);
      setShowSessionWarning(false);
      sessionTimers.current.warning = setTimeout(() => {
        setShowSessionWarning(true);
        sessionTimers.current.signout = setTimeout(() => {
          setShowSessionWarning(false);
          clearSavedIntake();
          setView("login");
          setInactivityToast(true);
          setTimeout(() => setInactivityToast(false), 5000);
        }, SESSION_SIGNOUT_DELAY);
      }, SESSION_WARNING_DELAY);
    };
    reset();
    window.addEventListener("mousemove", reset, { passive: true });
    window.addEventListener("keypress", reset, { passive: true });
    window.addEventListener("click", reset, { passive: true });
    return () => {
      clearTimeout(sessionTimers.current.warning);
      clearTimeout(sessionTimers.current.signout);
      window.removeEventListener("mousemove", reset);
      window.removeEventListener("keypress", reset);
      window.removeEventListener("click", reset);
    };
  }, [view, intakeSaved, intakeId]);

  useEffect(() => {
    const handleSessionExpired = () => {
      clearSavedIntake();
      setView("login");
    };
    window.addEventListener("cal:session-expired", handleSessionExpired);
    return () => window.removeEventListener("cal:session-expired", handleSessionExpired);
  }, []);

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
    setSidebarSection(null);
    localStorage.removeItem(INTAKE_ID_KEY);
    localStorage.removeItem(INTAKE_SAVED_KEY);
    localStorage.removeItem(INTAKE_PROFILE_KEY);
  };

  const completeLogin = (data) => {
    const safeId = String(data?.intake_id || data || "").trim();
    if (!safeId) return;
    localStorage.setItem(INTAKE_ID_KEY, safeId);
    localStorage.setItem(INTAKE_SAVED_KEY, "1");
    localStorage.setItem(FIRST_VISIT_KEY, "1");
    if (data && typeof data === "object" && (data.first_name || data.last_name || data.email)) {
      let existing = {};
      try { existing = JSON.parse(localStorage.getItem(INTAKE_PROFILE_KEY) || "{}"); } catch {}
      localStorage.setItem(INTAKE_PROFILE_KEY, JSON.stringify({
        ...existing,
        firstName: data.first_name || existing.firstName || "",
        lastName: data.last_name || existing.lastName || "",
        email: data.email || existing.email || "",
      }));
      if (data.first_name) setIntakeFirstName(data.first_name);
      if (data.last_name) setIntakeLastName(data.last_name);
      if (data.email) setIntakeEmail(data.email);
    }
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
      if (res.status === 403) {
        setEmailNotVerified(true);
        setResendVerifyNotice("");
        return;
      }
      if (!res.ok) {
        throw new Error(data?.detail ? String(data.detail) : t("login.passwordLoginFailed"));
      }
      completeLogin(data);
      setLoginPassword("");
      setPasswordResetNotice("");
      setEmailNotVerified(false);
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

  const handleResendEmailVerification = async () => {
    const email = String(magicLinkEmail || "").trim().toLowerCase();
    if (!email) return;
    setResendVerifyBusy(true);
    setResendVerifyNotice("");
    try {
      const res = await fetchWithTimeout(
        apiUrl("/auth/resend-verification"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        },
        INTAKE_FETCH_TIMEOUT_MS
      );
      if (res.ok) {
        setResendVerifyNotice("Verification email sent. Please check your inbox.");
      } else {
        setResendVerifyNotice(`Failed to send. Please contact ${SUPPORT_EMAIL}`);
      }
    } catch {
      setResendVerifyNotice(`Failed to send. Please contact ${SUPPORT_EMAIL}`);
    } finally {
      setResendVerifyBusy(false);
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

  // Save current session to case history whenever messages or conversationState changes
  useEffect(() => {
    if (!showChat || !conversationState?.topic) return;
    const referrals = [];
    for (const msg of messages) {
      if (Array.isArray(msg.referrals)) {
        for (const r of msg.referrals) { if (!referrals.find((x) => x.name === r.name)) referrals.push(r); }
      }
    }
    if (!chatSessionIdRef.current) {
      chatSessionIdRef.current = intakeId
        ? `case_${intakeId}_${Date.now()}`
        : `case_anon_${Date.now()}`;
    }
    const sessionId = chatSessionIdRef.current;
    saveCaseToStorage({
      id: sessionId,
      topic: conversationState.topic,
      date: conversationState.started_at || new Date().toISOString(),
      status: conversationState.step === "complete" ? "complete" : "in_progress",
      riskScore: conversationState.risk_score ?? null,
      referrals,
    });
  }, [showChat, conversationState, messages, intakeId]);

  // Save referrals from messages to localStorage
  useEffect(() => {
    if (!intakeId) return;
    const referrals = [];
    const topicVal = conversationState?.topic || "";
    for (const msg of messages) {
      if (Array.isArray(msg.referrals)) {
        for (const r of msg.referrals) {
          if (!referrals.find((x) => x.name === r.name)) referrals.push({ ...r, _topic: topicVal });
        }
      }
    }
    if (referrals.length === 0) return;
    try {
      const all = JSON.parse(localStorage.getItem(SAVED_REFERRALS_KEY) || "{}");
      all[intakeId] = referrals;
      localStorage.setItem(SAVED_REFERRALS_KEY, JSON.stringify(all));
    } catch {}
  }, [messages, intakeId, conversationState?.topic]);

  const savedReferrals = useMemo(() => {
    if (!intakeId) return [];
    try {
      const all = JSON.parse(localStorage.getItem(SAVED_REFERRALS_KEY) || "{}");
      return Array.isArray(all[intakeId]) ? all[intakeId] : [];
    } catch { return []; }
  }, [intakeId, sidebarSection]);

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

  const handleSidebarNav = (section) => {
    if (section === "home") { setSidebarSection(null); goToCover(); return; }
    if (section === "chat") { setSidebarSection("cases"); return; }
    setSidebarSection(section);
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
        if (res.status === 409) {
          throw new Error(t("intake.duplicateAccount"));
        }
        let detail = "";
        try {
          const payload = await res.json();
          const d = payload?.detail;
          detail = Array.isArray(d)
            ? d.map((x) => (typeof x === "string" ? x : x?.msg || "")).filter(Boolean).join(" ")
            : d
              ? String(d)
              : "";
        } catch (e) {}
        throw new Error(detail || "Unable to save intake right now.");
      }

      const data = await res.json();
      const newId = data.intake_id;

      setIntakeId(newId);
      setIntakeSaved(true);

      localStorage.setItem(INTAKE_ID_KEY, newId);
      localStorage.setItem(INTAKE_SAVED_KEY, "1");
      localStorage.setItem(INTAKE_PROFILE_KEY, JSON.stringify({
        firstName: intakeFirstName.trim(),
        lastName: intakeLastName.trim(),
        email: intakeEmail.trim().toLowerCase(),
        phone: intakePhone.trim(),
      }));
      setIntakePassword("");
      setIntakePasswordConfirm("");

      setShowEmailSent(true);
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
    <div className="cal-auth-left-text-content">
      <h2 className="cal-auth-left-heading">{t("login.authAside.headline")}</h2>
      <ul className="cal-auth-left-bullets" aria-label={t("login.authAside.ariaLabel")}>
        {[
          t("login.authAside.item1"),
          t("login.authAside.item2"),
          t("login.authAside.item3"),
          t("login.authAside.item4"),
        ].map((item) => (
          <li key={item} className="cal-auth-left-bullet-item">
            <span className="cal-auth-bullet-dot" aria-hidden="true">✓</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );

  const renderRegisterAside = () => (
    <div className="cal-auth-left-text-content">
      <h2 className="cal-auth-left-heading">{t("auth.register.leftHeading")}</h2>
      <p className="cal-auth-left-subtext">{t("auth.register.leftSubtext")}</p>
    </div>
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
        />
        <EmergencyButton />
      </div>
    );
  }

  if (view === "login") {
    return (
      <LoginLayout
        title={t("login.heading")}
        subtitle={t("login.lead")}
        leftPanel={renderAuthAside()}
        showTrustBadge={true}
        extras={<><ThemeToggle /><LanguagePicker variant={lpVariant} /></>}
        footer={
          <SiteFooter
            className={footerAuthClass}
            supportEmail={SUPPORT_EMAIL}
            onPrivacyClick={() => setView("privacy")}
          />
        }
      >
        {/* Tab bar — Client / Admin login */}
        <div className="cal-auth-tabs">
          <div className="cal-auth-tab-group">
            <button type="button" className="cal-auth-tab-active" onClick={() => { setMagicLinkError(""); setMagicVerifyError(""); }} disabled={magicLinkBusy || passwordLoginBusy}>
              {t("login.clientLogin")}
            </button>
            <button type="button" className="cal-auth-tab-inactive" onClick={() => { window.location.hash = "#/admin"; }} disabled={magicLinkBusy || passwordLoginBusy}>
              {t("login.staffLogin")}
            </button>
          </div>
          <button type="button" className="cal-auth-email-btn" onClick={() => sendMagicLinkRequest(magicLinkEmail)} disabled={magicLinkBusy || passwordLoginBusy}>
            {t("login.signInWithEmail")}
          </button>
        </div>

        <form onSubmit={handlePasswordLoginSubmit} className="space-y-4">
          {magicVerifyError ? (
            <div role="alert" className="rounded-xl bg-destructive/10 text-destructive px-4 py-3 text-sm border border-destructive/20">
              {magicVerifyError}
            </div>
          ) : null}
          {magicTokenPending ? (
            <div role="status" className="rounded-xl bg-muted px-4 py-3 text-sm border border-border">
              Email link detected. Click below to complete sign-in.
            </div>
          ) : null}
          {passwordResetNotice ? (
            <div role="status" className="rounded-xl bg-muted px-4 py-3 text-sm border border-border">
              {passwordResetNotice}
            </div>
          ) : null}
          {verifyEmailNotice ? (
            <div role="status" className="rounded-xl px-4 py-3 text-sm border" style={{ backgroundColor: "#f0fdf4", borderColor: "#86efac", color: "#166534" }}>
              {verifyEmailNotice}
            </div>
          ) : null}
          {emailNotVerified ? (
            <div role="alert" className="rounded-xl bg-destructive/10 text-destructive px-4 py-3 text-sm border border-destructive/20">
              <p>Your email address has not been verified. Please check your inbox and click the verification link.</p>
              <button
                type="button"
                onClick={handleResendEmailVerification}
                disabled={resendVerifyBusy}
                style={{ color: "#B8860B", fontWeight: 600, marginTop: "8px", display: "block", background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}
              >
                {resendVerifyBusy ? "Sending…" : "Resend verification email"}
              </button>
              {resendVerifyNotice ? (
                <p style={{ marginTop: "6px", color: resendVerifyNotice.startsWith("Failed") ? "inherit" : "#166534" }}>
                  {resendVerifyNotice}
                </p>
              ) : null}
            </div>
          ) : passwordLoginError ? (
            <div role="alert" className="rounded-xl bg-destructive/10 text-destructive px-4 py-3 text-sm border border-destructive/20">
              {passwordLoginError}
            </div>
          ) : null}
          {magicLinkError ? (
            <div role="alert" className="rounded-xl bg-destructive/10 text-destructive px-4 py-3 text-sm border border-destructive/20">
              {magicLinkError}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="auth-signin-email" className="font-medium text-sm" style={{ color: "#1A1A1A" }}>{t("login.emailLabel")}</Label>
            <Input
              id="auth-signin-email"
              type="email"
              name="login"
              autoComplete="email"
              value={magicLinkEmail}
              onChange={(e) => {
                setMagicLinkEmail(e.target.value);
                setMagicLinkError("");
                setMagicVerifyError("");
                setPasswordLoginError("");
                setEmailNotVerified(false);
                setResendVerifyNotice("");
              }}
              disabled={magicLinkBusy || passwordLoginBusy}
              className="cal-auth-field"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="auth-signin-password" className="font-medium text-sm" style={{ color: "#1A1A1A" }}>{t("login.passwordLabel")}</Label>
            <div className="relative">
              <Input
                id="auth-signin-password"
                type={showLoginPassword ? "text" : "password"}
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => { setLoginPassword(e.target.value); setPasswordLoginError(""); setEmailNotVerified(false); setResendVerifyNotice(""); }}
                disabled={magicLinkBusy || passwordLoginBusy}
                className="cal-auth-field pr-12"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setShowLoginPassword((s) => !s)}
                disabled={magicLinkBusy || passwordLoginBusy}
                aria-label={showLoginPassword ? t("login.hidePassword") : t("login.showPassword")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#1e293b]"
              >
                {showLoginPassword ? <EyeOff className="w-5 h-5" aria-hidden /> : <Eye className="w-5 h-5" aria-hidden />}
              </Button>
            </div>
          </div>

          {/* Remember me */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input type="checkbox" className="cal-auth-checkbox" />
            <span className="text-sm" style={{ color: "#1A1A1A" }}>{t("login.rememberMe")}</span>
          </label>

          <button type="submit" className="cal-auth-submit-btn" disabled={magicLinkBusy || passwordLoginBusy}>
            {passwordLoginBusy ? t("login.signingIn") : t("login.passwordLoginButton")}
          </button>
          {magicTokenPending ? (
            <Button
              type="button"
              className="w-full rounded-full"
              size="lg"
              disabled={magicLinkBusy || passwordLoginBusy || magicVerifyBusy}
              onClick={() => void verifyPendingMagicLink()}
            >
              {magicVerifyBusy ? "Verifying link..." : "Complete sign-in from email link"}
            </Button>
          ) : null}
        </form>

        <div className="mt-6 pt-6 border-t border-[#e2e8f0]">
          <p className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>
            We do not share your information with third parties except as required by law or to provide requested services.{" "}
            <button type="button" className="cal-auth-link" onClick={() => setView("privacy")}>
              {t("intake.privacyLink")}
            </button>
          </p>
          <div className="flex items-center justify-between gap-2 mt-3">
            <button
              type="button"
              className="cal-auth-link"
              style={{ fontSize: "0.88rem" }}
              disabled={magicLinkBusy || passwordLoginBusy}
              onClick={() => {
                setForgotEmail(String(magicLinkEmail || "").trim().toLowerCase());
                setForgotError(""); setForgotNotice(""); setForgotDevLink("");
                setView("forgotPassword");
              }}
            >
              {t("login.forgotPassword")}
            </button>
            <p className="text-sm" style={{ color: "#6B7280" }}>
              {t("login.newUserPrompt")}{" "}
              <button
                type="button"
                className="cal-auth-link font-semibold"
                onClick={() => { setMagicLinkError(""); setMagicVerifyError(""); setView("intake"); }}
              >
                {t("login.createAccount")}
              </button>
            </p>
          </div>
        </div>
        <EmergencyButton />
      </LoginLayout>
    );
  }

  if (view === "magicSent") {
    return (
      <LoginLayout
        title={t("login.checkTitle")}
        subtitle={t("login.checkBody", { email: magicLinkSentTo || "—" })}
        extras={<><ThemeToggle /><LanguagePicker variant={lpVariant} /></>}
        footer={
          <SiteFooter
            className={footerAuthClass}
            supportEmail={SUPPORT_EMAIL}
            onPrivacyClick={() => setView("privacy")}
          />
        }
      >
        {magicDevLink && isLocalDevHost() ? (
          <div className="rounded-xl border border-border bg-muted px-4 py-3 mb-4">
            <p className="text-xs text-muted-foreground mb-1">{t("login.devLinkLabel")}</p>
            <a className="text-sm text-foreground underline underline-offset-2 break-all" href={magicDevLink}>
              {magicDevLink}
            </a>
          </div>
        ) : null}
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            className="w-full rounded-xl"
            size="lg"
            disabled={magicLinkBusy}
            onClick={() => sendMagicLinkRequest(magicLinkSentTo)}
          >
            {magicLinkBusy ? t("login.sending") : t("login.resend")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="w-full rounded-xl"
            onClick={() => { setMagicLinkError(""); setMagicDevLink(""); setView("login"); }}
          >
            {t("login.backToSignIn")}
          </Button>
        </div>
        <div className="text-center mt-4">
          <Button
            type="button"
            variant="link"
            className="p-0 h-auto text-xs text-muted-foreground"
            onClick={() => setView("privacy")}
          >
            {t("intake.privacyLink")}
          </Button>
        </div>
        <EmergencyButton />
      </LoginLayout>
    );
  }

  if (view === "forgotPassword") {
    return (
      <LoginLayout
        title={t("login.forgotTitle")}
        subtitle={t("login.forgotBody")}
        extras={<><ThemeToggle /><LanguagePicker variant={lpVariant} /></>}
        footer={
          <SiteFooter
            className={footerAuthClass}
            supportEmail={SUPPORT_EMAIL}
            onPrivacyClick={() => setView("privacy")}
          />
        }
      >
        <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
          {forgotError ? (
            <div role="alert" className="rounded-xl bg-destructive/10 text-destructive px-4 py-3 text-sm border border-destructive/20">
              {forgotError}
            </div>
          ) : null}
          {forgotNotice ? (
            <div role="status" className="rounded-xl bg-muted px-4 py-3 text-sm border border-border">
              {forgotNotice}
            </div>
          ) : null}
          {forgotDevLink && isLocalDevHost() ? (
            <div className="rounded-xl border border-border bg-muted px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">{t("login.resetDevLinkLabel")}</p>
              <a className="text-sm text-foreground underline underline-offset-2 break-all" href={forgotDevLink}>
                {forgotDevLink}
              </a>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="auth-forgot-email">{t("login.emailLabel")}</Label>
            <Input
              id="auth-forgot-email"
              type="email"
              autoComplete="email"
              value={forgotEmail}
              onChange={(e) => { setForgotEmail(e.target.value); setForgotError(""); }}
              disabled={forgotBusy}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2 pt-1">
            <Button type="submit" className="w-full rounded-xl" size="lg" disabled={forgotBusy}>
              {forgotBusy ? t("login.sending") : t("login.sendReset")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="w-full rounded-xl"
              onClick={() => setView("login")}
              disabled={forgotBusy}
            >
              {t("login.backToSignIn")}
            </Button>
          </div>
        </form>
        <EmergencyButton />
      </LoginLayout>
    );
  }

  if (view === "resetPassword") {
    return (
      <LoginLayout
        title={t("login.resetTitle")}
        subtitle={t("login.resetBody")}
        extras={<><ThemeToggle /><LanguagePicker variant={lpVariant} /></>}
        footer={
          <SiteFooter
            className={footerAuthClass}
            supportEmail={SUPPORT_EMAIL}
            onPrivacyClick={() => setView("privacy")}
          />
        }
      >
        <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
          {resetError ? (
            <div role="alert" className="rounded-xl bg-destructive/10 text-destructive px-4 py-3 text-sm border border-destructive/20">
              {resetError}
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="auth-reset-password-1">{t("login.newPassword")}</Label>
            <div className="relative">
              <Input
                id="auth-reset-password-1"
                type={showResetPassword1 ? "text" : "password"}
                autoComplete="new-password"
                value={resetPassword1}
                onChange={(e) => { setResetPassword1(e.target.value); setResetError(""); }}
                disabled={resetBusy}
                className="rounded-xl pr-10"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setShowResetPassword1((s) => !s)}
                disabled={resetBusy}
                aria-label={showResetPassword1 ? t("login.hidePassword") : t("login.showPassword")}
                className="absolute right-0 top-0 h-full px-3 rounded-r-xl"
              >
                {showResetPassword1 ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
              </Button>
            </div>
            {resetPassword1 ? (
              <p className={`text-xs mt-1 ${
                passwordStrengthKey(resetPassword1) === "weak" ? "text-destructive" :
                passwordStrengthKey(resetPassword1) === "medium" ? "text-amber-600" : "text-green-600"
              }`}>
                {t(`login.passwordStrength.${passwordStrengthKey(resetPassword1)}`)}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auth-reset-password-2">{t("login.confirmPassword")}</Label>
            <div className="relative">
              <Input
                id="auth-reset-password-2"
                type={showResetPassword2 ? "text" : "password"}
                autoComplete="new-password"
                value={resetPassword2}
                onChange={(e) => { setResetPassword2(e.target.value); setResetError(""); }}
                disabled={resetBusy}
                className="rounded-xl pr-10"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setShowResetPassword2((s) => !s)}
                disabled={resetBusy}
                aria-label={showResetPassword2 ? t("login.hidePassword") : t("login.showPassword")}
                className="absolute right-0 top-0 h-full px-3 rounded-r-xl"
              >
                {showResetPassword2 ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
              </Button>
            </div>
          </div>
          <div className="space-y-2 pt-1">
            <Button type="submit" className="w-full rounded-xl" size="lg" disabled={resetBusy}>
              {resetBusy ? t("login.savingPassword") : t("login.resetPasswordButton")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="w-full rounded-xl"
              onClick={() => setView("login")}
              disabled={resetBusy}
            >
              {t("login.backToSignIn")}
            </Button>
          </div>
        </form>
        <EmergencyButton />
      </LoginLayout>
    );
  }

  if (view === "intakeChoice") {
    const hasSaved = intakeSaved && intakeId;

    return (
      <LoginLayout
        title={t("login.welcomeBackTitle")}
        subtitle={t("login.welcomeBackBody")}
        extras={<><ThemeToggle /><LanguagePicker variant={lpVariant} /></>}
        footer={
          <SiteFooter
            className={footerAuthClass}
            supportEmail={SUPPORT_EMAIL}
            onPrivacyClick={() => setView("privacy")}
          />
        }
      >
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            className="w-full rounded-xl"
            size="lg"
            onClick={() => setView("cover")}
            disabled={loading || !hasSaved}
          >
            {t("login.continueThisDevice")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="w-full rounded-xl"
            onClick={() => { setMagicLinkEmail(""); setMagicLinkError(""); setMagicVerifyError(""); setView("login"); }}
            disabled={loading}
          >
            {t("login.useDifferentEmail")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            className="w-full rounded-xl"
            onClick={() => { clearSavedIntake(); setMagicLinkEmail(""); setMagicLinkError(""); setMagicVerifyError(""); setView("login"); }}
            disabled={loading}
          >
            {t("login.signOutDevice")}
          </Button>
        </div>
        <div className="text-center mt-4">
          <Button
            type="button"
            variant="link"
            className="p-0 h-auto text-xs text-muted-foreground"
            onClick={() => setView("privacy")}
          >
            {t("intake.privacyLink")}
          </Button>
        </div>
        <EmergencyButton />
      </LoginLayout>
    );
  }

  if (view === "intake") {
    if (showEmailSent) {
      return (
        <LoginLayout
          leftPanel={renderRegisterAside()}
          showTrustBadge={true}
          extras={<><ThemeToggle /><LanguagePicker variant={lpVariant} /></>}
          footer={<SiteFooter className={footerAuthClass} supportEmail={SUPPORT_EMAIL} onPrivacyClick={() => setView("privacy")} />}
        >
          <div className="cal-auth-email-verify">
            <div className="cal-auth-email-verify-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="24" height="24">
                <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2>{t("auth.register.checkEmailHeading")}</h2>
            <p>{t("auth.register.checkEmailBody", { email: intakeEmail })}</p>
            <button type="button" className="cal-auth-link" style={{ display: "block", marginBottom: 12 }} onClick={handleResendVerification} disabled={emailSentResendBusy}>
              {emailSentResendBusy ? "Sending..." : t("auth.register.resendEmail")}
            </button>
            <p style={{ fontSize: "0.88rem", color: "#6B7280" }}>
              {t("auth.register.wrongEmailPrefix")}{" "}
              <button type="button" className="cal-auth-link" onClick={() => setShowEmailSent(false)}>
                {t("auth.register.goBackLink")}
              </button>
            </p>
          </div>
          <EmergencyButton />
        </LoginLayout>
      );
    }

    return (
      <LoginLayout
        title={t("login.createAccountTitle")}
        subtitle={t("intake.subtitle")}
        leftPanel={renderRegisterAside()}
        leftCenterPanel={
          <ul className="cal-auth-left-bullets" aria-label={t("login.authAside.ariaLabel")}>
            {[
              t("login.authAside.item1"),
              t("login.authAside.item2"),
              t("login.authAside.item3"),
              t("login.authAside.item4"),
            ].map((item) => (
              <li key={item} className="cal-auth-left-bullet-item">
                <span className="cal-auth-bullet-dot" aria-hidden="true">✓</span>
                {item}
              </li>
            ))}
          </ul>
        }
        showTrustBadge={true}
        progressContent={
          <div className="cal-auth-progress-wrap">
            <p className="cal-auth-step-label">{t("auth.register.stepIndicator")}</p>
            <div className="cal-auth-progress-track">
              <div className="cal-auth-progress-seg cal-auth-progress-seg--active" />
              <div className="cal-auth-progress-seg cal-auth-progress-seg--inactive" />
            </div>
          </div>
        }
        extras={<><ThemeToggle /><LanguagePicker variant={lpVariant} /></>}
        footer={
          <SiteFooter
            className={footerAuthClass}
            supportEmail={SUPPORT_EMAIL}
            onPrivacyClick={() => setView("privacy")}
          />
        }
      >
        {/* Tab bar — Client / Admin login */}
        <div className="cal-auth-tabs">
          <div className="cal-auth-tab-group" role="group" aria-label={t("login.intakeLoginChoiceAria")}>
            <button
              type="button"
              className="cal-auth-tab-inactive"
              onClick={() => { setMagicLinkError(""); setMagicVerifyError(""); setView("login"); }}
              disabled={loading}
            >
              {t("login.clientLogin")}
            </button>
            <button
              type="button"
              className="cal-auth-tab-inactive"
              onClick={() => { window.location.hash = "#/admin"; }}
              disabled={loading}
            >
              {t("login.staffLogin")}
            </button>
          </div>
          <button
            type="button"
            className="cal-auth-email-btn"
            onClick={() => { setMagicLinkError(""); setMagicVerifyError(""); setView("login"); }}
          >
            {t("login.signInWithEmail")}
          </button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); submitIntake(); }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="intake-first-name" className="auth-label" style={{ color: "#1A1A1A" }}>{t("intake.firstName")}</Label>
              <div className="cal-auth-field-wrap">
                <Input
                  id="intake-first-name"
                  type="text"
                  value={intakeFirstName}
                  onChange={(e) => setIntakeFirstName(e.target.value)}
                  onBlur={() => handleIntakeBlur("firstName", intakeFirstName)}
                  placeholder={t("intake.firstName")}
                  disabled={loading}
                  className="cal-auth-field"
                  aria-label={t("intake.firstName")}
                  aria-describedby={intakeFieldErrors.firstName ? "err-firstName" : undefined}
                  aria-invalid={intakeFieldTouched.firstName && !!intakeFieldErrors.firstName}
                  data-valid={intakeFieldTouched.firstName && !intakeFieldErrors.firstName ? "true" : undefined}
                  data-invalid={intakeFieldTouched.firstName && !!intakeFieldErrors.firstName ? "true" : undefined}
                />
                {intakeFieldTouched.firstName && !intakeFieldErrors.firstName && (
                  <span className="cal-auth-field-valid-icon" aria-hidden="true">✓</span>
                )}
              </div>
              {intakeFieldTouched.firstName && intakeFieldErrors.firstName && (
                <p id="err-firstName" className="cal-auth-field-error" role="alert" aria-live="polite">
                  {intakeFieldErrors.firstName}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="intake-last-name" className="auth-label" style={{ color: "#1A1A1A" }}>{t("intake.lastName")}</Label>
              <div className="cal-auth-field-wrap">
                <Input
                  id="intake-last-name"
                  type="text"
                  value={intakeLastName}
                  onChange={(e) => setIntakeLastName(e.target.value)}
                  onBlur={() => handleIntakeBlur("lastName", intakeLastName)}
                  placeholder={t("intake.lastName")}
                  disabled={loading}
                  className="cal-auth-field"
                  aria-label={t("intake.lastName")}
                  aria-describedby={intakeFieldErrors.lastName ? "err-lastName" : undefined}
                  aria-invalid={intakeFieldTouched.lastName && !!intakeFieldErrors.lastName}
                  data-valid={intakeFieldTouched.lastName && !intakeFieldErrors.lastName ? "true" : undefined}
                  data-invalid={intakeFieldTouched.lastName && !!intakeFieldErrors.lastName ? "true" : undefined}
                />
                {intakeFieldTouched.lastName && !intakeFieldErrors.lastName && (
                  <span className="cal-auth-field-valid-icon" aria-hidden="true">✓</span>
                )}
              </div>
              {intakeFieldTouched.lastName && intakeFieldErrors.lastName && (
                <p id="err-lastName" className="cal-auth-field-error" role="alert" aria-live="polite">
                  {intakeFieldErrors.lastName}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="intake-email" className="auth-label" style={{ color: "#1A1A1A" }}>{t("intake.email")}</Label>
            <div className="cal-auth-field-wrap">
              <Input
                id="intake-email"
                type="email"
                value={intakeEmail}
                onChange={(e) => setIntakeEmail(e.target.value)}
                onBlur={() => handleIntakeBlur("email", intakeEmail)}
                placeholder={t("intake.email")}
                disabled={loading}
                className="cal-auth-field"
                aria-label={t("intake.email")}
                aria-describedby={intakeFieldErrors.email ? "err-email" : undefined}
                aria-invalid={intakeFieldTouched.email && !!intakeFieldErrors.email}
                data-valid={intakeFieldTouched.email && !intakeFieldErrors.email ? "true" : undefined}
                data-invalid={intakeFieldTouched.email && !!intakeFieldErrors.email ? "true" : undefined}
              />
              {intakeFieldTouched.email && !intakeFieldErrors.email && (
                <span className="cal-auth-field-valid-icon" aria-hidden="true">✓</span>
              )}
            </div>
            {intakeFieldTouched.email && intakeFieldErrors.email && (
              <p id="err-email" className="cal-auth-field-error" role="alert" aria-live="polite">
                {intakeFieldErrors.email}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="intake-phone" className="auth-label" style={{ color: "#1A1A1A" }}>{t("intake.phone")}</Label>
            <div className="cal-auth-field-wrap">
              <Input
                id="intake-phone"
                type="tel"
                value={intakePhone}
                onChange={(e) => setIntakePhone(formatPhoneInput(e.target.value))}
                onBlur={() => handleIntakeBlur("phone", intakePhone)}
                placeholder={t("intake.phone")}
                disabled={loading}
                className="cal-auth-field"
                aria-label={t("intake.phone")}
                aria-describedby={intakeFieldErrors.phone ? "err-phone" : undefined}
                aria-invalid={intakeFieldTouched.phone && !!intakeFieldErrors.phone}
                data-valid={intakeFieldTouched.phone && !intakeFieldErrors.phone ? "true" : undefined}
                data-invalid={intakeFieldTouched.phone && !!intakeFieldErrors.phone ? "true" : undefined}
              />
              {intakeFieldTouched.phone && !intakeFieldErrors.phone && (
                <span className="cal-auth-field-valid-icon" aria-hidden="true">✓</span>
              )}
            </div>
            {intakeFieldTouched.phone && intakeFieldErrors.phone && (
              <p id="err-phone" className="cal-auth-field-error" role="alert" aria-live="polite">
                {intakeFieldErrors.phone}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="intake-password" className="auth-label" style={{ color: "#1A1A1A" }}>{t("login.createPassword")}</Label>
            <div className="cal-auth-field-wrap cal-auth-field-wrap--password">
              <Input
                id="intake-password"
                type={showIntakePassword ? "text" : "password"}
                value={intakePassword}
                onChange={(e) => setIntakePassword(e.target.value)}
                onBlur={() => handleIntakeBlur("password", intakePassword)}
                placeholder={t("login.createPassword")}
                autoComplete="new-password"
                disabled={loading}
                className="cal-auth-field pr-12"
                aria-describedby={intakeFieldErrors.password ? "err-password" : undefined}
                aria-invalid={intakeFieldTouched.password && !!intakeFieldErrors.password}
                data-valid={intakeFieldTouched.password && !intakeFieldErrors.password ? "true" : undefined}
                data-invalid={intakeFieldTouched.password && !!intakeFieldErrors.password ? "true" : undefined}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setShowIntakePassword((s) => !s)}
                disabled={loading}
                aria-label={showIntakePassword ? t("login.hidePassword") : t("login.showPassword")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#1e293b]"
              >
                {showIntakePassword ? <EyeOff className="w-5 h-5" aria-hidden /> : <Eye className="w-5 h-5" aria-hidden />}
              </Button>
              {intakeFieldTouched.password && !intakeFieldErrors.password && (
                <span className="cal-auth-field-valid-icon" style={{ right: 44 }} aria-hidden="true">✓</span>
              )}
            </div>
            {intakePassword && (
              <div className="cal-auth-strength-wrap" aria-live="polite">
                <div className="cal-auth-strength-track" aria-hidden="true">
                  {[1,2,3,4].map((level) => {
                    const score = passwordStrength4(intakePassword);
                    const strengthColor = level <= score ? getStrengthInfo(score).color : "#E5E7EB";
                    return <div key={level} className="cal-auth-strength-seg" style={{ background: strengthColor }} />;
                  })}
                </div>
                <span className="cal-auth-strength-label" style={{ color: getStrengthInfo(passwordStrength4(intakePassword)).color }}>
                  {getStrengthInfo(passwordStrength4(intakePassword)).label}
                </span>
              </div>
            )}
            {intakeFieldTouched.password && intakeFieldErrors.password && (
              <p id="err-password" className="cal-auth-field-error" role="alert" aria-live="polite">
                {intakeFieldErrors.password}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="intake-password-confirm" className="auth-label" style={{ color: "#1A1A1A" }}>{t("login.confirmAccountPassword")}</Label>
            <div className="cal-auth-field-wrap cal-auth-field-wrap--password">
              <Input
                id="intake-password-confirm"
                type={showIntakePasswordConfirm ? "text" : "password"}
                value={intakePasswordConfirm}
                onChange={(e) => setIntakePasswordConfirm(e.target.value)}
                onBlur={() => handleIntakeBlur("confirmPassword", intakePasswordConfirm, intakePassword)}
                placeholder={t("login.confirmAccountPassword")}
                autoComplete="new-password"
                disabled={loading}
                className="cal-auth-field pr-12"
                aria-describedby={intakeFieldErrors.confirmPassword ? "err-confirmPassword" : undefined}
                aria-invalid={intakeFieldTouched.confirmPassword && !!intakeFieldErrors.confirmPassword}
                data-valid={intakeFieldTouched.confirmPassword && !intakeFieldErrors.confirmPassword ? "true" : undefined}
                data-invalid={intakeFieldTouched.confirmPassword && !!intakeFieldErrors.confirmPassword ? "true" : undefined}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setShowIntakePasswordConfirm((s) => !s)}
                disabled={loading}
                aria-label={showIntakePasswordConfirm ? t("login.hidePassword") : t("login.showPassword")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#1e293b]"
              >
                {showIntakePasswordConfirm ? <EyeOff className="w-5 h-5" aria-hidden /> : <Eye className="w-5 h-5" aria-hidden />}
              </Button>
              {intakeFieldTouched.confirmPassword && !intakeFieldErrors.confirmPassword && (
                <span className="cal-auth-field-valid-icon" style={{ right: 44 }} aria-hidden="true">✓</span>
              )}
            </div>
            {intakeFieldTouched.confirmPassword && intakeFieldErrors.confirmPassword && (
              <p id="err-confirmPassword" className="cal-auth-field-error" role="alert" aria-live="polite">
                {intakeFieldErrors.confirmPassword}
              </p>
            )}
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="cal-auth-checkbox"
              checked={intakeConsent}
              onChange={(e) => setIntakeConsent(e.target.checked)}
              disabled={loading}
            />
            <span className="text-sm leading-relaxed" style={{ color: "#1A1A1A" }}>
              {t("intake.consentText")}{" "}
              <button
                type="button"
                className="cal-auth-link"
                onClick={() => setView("privacy")}
              >
                {t("intake.privacyLink")}
              </button>
            </span>
          </label>

          {intakeError ? (
            <div role="alert" className="rounded-xl bg-destructive/10 text-destructive px-4 py-3 text-sm border border-destructive/20">
              {intakeError}
            </div>
          ) : null}

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button type="submit" className="cal-auth-submit-btn" style={{ flex: 1 }} disabled={loading}>
              {loading ? (intakeSubmitPhase === "retrying" ? t("intake.retryingDetail") : t("intake.savingDetail")) : t("intake.submit")}
            </button>
            <div className="cal-auth-tooltip-wrap">
              <button
                type="button"
                className="cal-auth-tooltip-trigger"
                aria-label="What happens next"
                onClick={() => setShowNextTooltip((v) => !v)}
                onBlur={() => setShowNextTooltip(false)}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
              </button>
              {showNextTooltip && (
                <div className="cal-auth-tooltip-popover" role="tooltip">
                  {t("auth.register.whatHappensNextTooltip")}
                </div>
              )}
            </div>
          </div>
        </form>

        <p className="text-sm text-center mt-6" style={{ color: "#6B7280" }}>
          {t("login.alreadyHaveAccount")}{" "}
          <button
            type="button"
            className="cal-auth-link font-semibold"
            onClick={() => { setMagicLinkError(""); setMagicVerifyError(""); setView("login"); }}
          >
            {t("login.signIn")}
          </button>
        </p>
        <EmergencyButton />
      </LoginLayout>
    );
  }

  if (view === "intakeSuccess") {
    return (
      <LoginLayout
        title={t("intake.successTitle")}
        extras={<><ThemeToggle /><LanguagePicker variant={lpVariant} /></>}
        footer={
          <SiteFooter
            className={footerAuthClass}
            supportEmail={SUPPORT_EMAIL}
            onPrivacyClick={() => setView("privacy")}
          />
        }
      >
        <div className="rounded-2xl border border-border bg-muted/50 p-6 text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center mx-auto mb-4 text-lg font-bold">
            ✓
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{t("intake.successBody")}</p>
        </div>
        <Button
          type="button"
          className="w-full rounded-xl"
          size="lg"
          onClick={() => setView("cover")}
        >
          {t("intake.continueToPortal")}
        </Button>
        <EmergencyButton />
      </LoginLayout>
    );
  }

  const sharedSidebarProps = {
    isDark,
    activeTopic: currentTopic,
    firstName: intakeFirstName,
    lastName: intakeLastName,
    intakeSaved,
    canGoBack: false,
    onNavigate: handleSidebarNav,
    onTopicSelect: (topicId) => setCurrentTopic(topicId),
    onStartChat: startChatFromCover,
    onSignOut: () => { clearSavedIntake(); setView("login"); },
    onBack: () => {},
    topbarExtras: <ThemeToggle />,
  };

  if (sidebarSection === "cases") {
    return (
      <SlackLayout {...sharedSidebarProps} activeSection="chat" topbarTitle="My Cases">
        <MyCasesPage
          intakeId={intakeId}
          onStartConsultation={() => { setSidebarSection(null); startChatFromCover(); }}
          onResume={() => { setSidebarSection(null); startChatFromCover(); }}
        />
      </SlackLayout>
    );
  }

  if (sidebarSection === "files") {
    return (
      <SlackLayout {...sharedSidebarProps} activeSection="files" topbarTitle="My Documents">
        <DocumentsPage intakeId={intakeId} />
      </SlackLayout>
    );
  }

  if (sidebarSection === "resources") {
    return (
      <SlackLayout {...sharedSidebarProps} activeSection="resources" topbarTitle="Legal Resources">
        <ResourcesPage
          messages={messages}
          conversationState={conversationState}
          userEmail={intakeEmail}
          savedReferrals={savedReferrals}
          onStartConsultation={() => handleSidebarNav("chat")}
        />
      </SlackLayout>
    );
  }

  if (sidebarSection === "settings") {
    return (
      <SlackLayout {...sharedSidebarProps} activeSection="settings" topbarTitle="Settings">
        <SettingsPage
          firstName={intakeFirstName}
          lastName={intakeLastName}
          email={intakeEmail}
          phone={intakePhone}
          onFirstNameChange={setIntakeFirstName}
          onLastNameChange={setIntakeLastName}
          onPhoneChange={setIntakePhone}
          intakeId={intakeId}
          onAccountDeleted={() => {
            localStorage.clear();
            clearSavedIntake();
            setView("login");
          }}
          onSessionExpired={() => {
            clearSavedIntake();
            setView("login");
          }}
        />
      </SlackLayout>
    );
  }

  if (!showChat || view === "cover") {
    return (
      <SlackLayout
        isDark={isDark}
        activeSection="home"
        activeTopic={currentTopic}
        firstName={intakeFirstName}
        lastName={intakeLastName}
        intakeSaved={intakeSaved}
        topbarTitle=""
        canGoBack={false}
        onNavigate={handleSidebarNav}
        onTopicSelect={(topicId) => {
          setCurrentTopic(topicId);
          startChatFromCover();
        }}
        onStartChat={startChatFromCover}
        onSignOut={() => {
          clearSavedIntake();
          setView("login");
        }}
        onBack={() => {}}
        topbarExtras={<ThemeToggle />}
      >
        <div className="home-cover">
          <div className="home-cover__inner">

            {/* Language selector — keep exactly as-is, top-right */}
            <div className="home-cover__lang">
              <select
                className="px-4 py-2 border-2 border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e293b]"
                style={{ color: "#1e293b" }}
                value={normalizedLang}
                onChange={(e) => setAppLanguage(e.target.value)}
              >
                <option value="en">Language / Idioma: English</option>
                <option value="es">Español</option>
              </select>
            </div>

            {/* Section 1: Hero */}
            <section className="home-cover__hero">
              <h1 className="home-cover__headline">
                Tell us what&apos;s happening — we&apos;ll help you find the right support
              </h1>
              <p className="home-cover__subtext">
                Free, confidential legal information for Illinois residents. No appointment needed.
              </p>
            </section>

            {/* Section 2: How it works (3 steps) */}
            <div className="home-cover__steps-row">
              <div className="home-cover__step-card">
                <div className="home-cover__step-badge">1</div>
                <h3 className="home-cover__step-title">Describe your situation</h3>
                <p className="home-cover__step-desc">Tell us what&apos;s going on in plain language</p>
              </div>
              <div className="home-cover__step-connector" aria-hidden="true" />
              <div className="home-cover__step-card">
                <div className="home-cover__step-badge">2</div>
                <h3 className="home-cover__step-title">We find your options</h3>
                <p className="home-cover__step-desc">We match you with Illinois-specific resources and referrals</p>
              </div>
              <div className="home-cover__step-connector" aria-hidden="true" />
              <div className="home-cover__step-card">
                <div className="home-cover__step-badge">3</div>
                <h3 className="home-cover__step-title">Connect with help</h3>
                <p className="home-cover__step-desc">Reach legal aid, attorneys, or support services directly</p>
              </div>
            </div>

            {/* Section 3: Get Started */}
            <div className="home-cover__cta">
              {pendingTriage ? (
                <div className="home-cover__resume-row">
                  <button
                    type="button"
                    className="home-cover__get-started-btn"
                    onClick={resumeTriageFromCover}
                    disabled={loading}
                  >
                    {t("resume.continueBtn")}
                  </button>
                  <button
                    type="button"
                    className="home-cover__secondary-btn"
                    onClick={discardPendingAndStartFresh}
                    disabled={loading}
                  >
                    {t("resume.startNewBtn")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="home-cover__get-started-btn"
                  onClick={startChatFromCover}
                  disabled={loading}
                >
                  Get Started
                </button>
              )}
              <p className="home-cover__cta-caption">Takes about 3–5 minutes. Free and confidential.</p>
            </div>

            {/* Section 4: Trust signals */}
            <div className="home-cover__trust">
              <div className="home-cover__trust-item">
                <Shield className="home-cover__trust-icon" aria-hidden />
                <span>100% free for Illinois residents</span>
              </div>
              <div className="home-cover__trust-item">
                <Lock className="home-cover__trust-icon" aria-hidden />
                <span>Your information stays private</span>
              </div>
              <div className="home-cover__trust-item">
                <Clock className="home-cover__trust-icon" aria-hidden />
                <span>No appointment needed</span>
              </div>
            </div>

            {/* Section 5: Legal notice — text unchanged, style updated */}
            <div className="home-cover__notice">
              <p>
                <span className="home-cover__notice-label">Important Legal Notice: </span>
                Legal information and resources only, not legal advice. Legal information you provide could be discoverable. For more details, see our{" "}
                <button type="button" onClick={() => setView("privacy")}>
                  Privacy Notice
                </button>
                .
              </p>
            </div>

            {/* Section 6: Browse by legal area (secondary option) */}
            <section>
              <p className="home-cover__browse-label">Or browse directly by legal area</p>
              <div className="home-cover__topic-grid">
                {topicCards.map((card) => (
                  <button
                    key={card.key}
                    type="button"
                    className="home-cover__topic-card"
                    onClick={() => {
                      const topicId = card.key === "childSupport" ? "child_support" : card.key;
                      setCurrentTopic(topicId);
                      startChatFromCover();
                    }}
                  >
                    <span className="home-cover__topic-icon">{card.icon}</span>
                    <h4 className="home-cover__topic-title">{card.title}</h4>
                    <p className="home-cover__topic-desc">{card.desc}</p>
                  </button>
                ))}
              </div>
            </section>

            {/* Section 7: Footer bar — links unchanged, style updated */}
            <footer className="home-cover__footer">
              <button
                type="button"
                className="home-cover__footer-link"
                onClick={() => setView(intakeSaved && intakeId ? "intakeChoice" : "intake")}
              >
                Back to start
              </button>
              <button
                type="button"
                className="home-cover__footer-link"
                onClick={() => { setMagicLinkError(""); setMagicVerifyError(""); setView("login"); }}
              >
                Click here to chat with staff
              </button>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="home-cover__footer-email"
              >
                {SUPPORT_EMAIL}
              </a>
            </footer>

          </div>
        </div>
        <EmergencyButton />
        {showSessionWarning && (
          <div className="cal-session-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="session-heading">
            <div className="cal-session-modal">
              <h2 id="session-heading">{t("auth.sessionTimeout.heading")}</h2>
              <p>{t("auth.sessionTimeout.body")}</p>
              <div className="cal-session-modal-btns">
                <button type="button" className="cal-session-stay-btn" onClick={() => { clearTimeout(sessionTimers.current.warning); clearTimeout(sessionTimers.current.signout); setShowSessionWarning(false); }}>
                  {t("auth.sessionTimeout.staySignedIn")}
                </button>
                <button type="button" className="cal-session-signout-link" onClick={() => { clearSavedIntake(); setShowSessionWarning(false); setView("login"); }}>
                  {t("auth.sessionTimeout.signOutNow")}
                </button>
              </div>
            </div>
          </div>
        )}
        {inactivityToast && (
          <div className="cal-inactivity-toast" role="alert" aria-live="assertive">
            {t("auth.sessionTimeout.inactivityToast")}
          </div>
        )}
      </SlackLayout>
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
    <SlackLayout
      isDark={isDark}
      activeSection="chat"
      activeTopic={currentTopic}
      firstName={intakeFirstName}
      lastName={intakeLastName}
      intakeSaved={intakeSaved}
      topbarTitle="Legal Consultation"
      topbarMeta={messages.length > 0 ? `Step ${progressCurrent} of ${progressTotal}` : ""}
      canGoBack={conversationHistory.length > 1}
      onNavigate={handleSidebarNav}
      onTopicSelect={(topicId) => setCurrentTopic(topicId)}
      onStartChat={startChatFromCover}
      onSignOut={() => {
        clearSavedIntake();
        setShowChat(false);
        setView("login");
      }}
      onBack={handleBack}
      topbarExtras={<LanguagePicker variant={lpVariant} />}
    >
      {messages.length > 0 && conversationState?.step !== "complete" && (
        <div className="px-4 py-2 border-b border-border bg-background/95 shrink-0">
          <div className="flex items-center mb-1.5 text-xs text-muted-foreground">
            <span>{t("progress.stepOf", { current: progressCurrent, total: progressTotal })}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-foreground rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={progressCurrent}
              aria-valuemin={1}
              aria-valuemax={progressTotal}
            />
          </div>
        </div>
      )}

        <div className="slack-chat-workspace">
        <div className="flex items-center gap-3 px-6 py-3 border-b border-[#e2e8f0] bg-white shrink-0 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5 border-2 border-[#e2e8f0] text-[#1e293b] hover:bg-[#f1f5f9]"
            onClick={quickExit}
          >
            <ArrowLeft className="w-4 h-4" aria-hidden />
            Quick Exit
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full gap-1.5 border-2 border-[#e2e8f0] text-[#1e293b] hover:bg-[#f1f5f9]"
            onClick={clearSessionAndStorage}
          >
            <RotateCcw className="w-4 h-4" aria-hidden />
            Clear Session
          </Button>
          {speechSupported && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`rounded-full gap-1.5 border-2 transition-colors ${
                speechEnabled
                  ? "bg-[#1e293b] text-white border-[#1e293b] hover:bg-[#334155]"
                  : "border-[#e2e8f0] text-[#1e293b] hover:bg-[#f1f5f9]"
              }`}
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
                <><VolumeX className="w-4 h-4" aria-hidden /> Turn Off Read Aloud</>
              ) : (
                <><Volume2 className="w-4 h-4" aria-hidden /> Turn On Read Aloud</>
              )}
            </Button>
          )}
        </div>

        <main className="chat-main" id="main-content">
        <div className="messages-container" ref={messagesContainerRef}>
          <div className="text-right text-sm mb-4" style={{ color: "#94a3b8" }}>start</div>
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

          {messages.map((msg, idx) => {
            const isLastReferralMsg =
              conversationState.step === "complete" &&
              msg.referrals?.length > 0 &&
              idx === messages.findLastIndex((m) => m.referrals && m.referrals.length);
            return (
              <div key={idx} className="mb-1">
                <ChatMessage
                  role={msg.role}
                  content={msg.role === "bot" ? renderBotText(msg) : msg.content}
                  speechSupported={speechSupported}
                  onSpeak={speakText}
                />

                {msg.role === "bot" && msg.options?.length > 0 && (
                  <div className="flex flex-wrap gap-2 ml-11 mt-3 mb-1" role="group" aria-label="Quick replies">
                    {msg.options.map((opt, i) => (
                      <Button
                        key={i}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full border-2 border-[#1e293b] text-[#1e293b] text-sm font-normal hover:bg-[#1e293b] hover:text-white transition-colors"
                        onClick={() => handleOptionClick(opt)}
                        disabled={loading}
                      >
                        {safeOptionLabel(opt)}
                      </Button>
                    ))}
                  </div>
                )}

                {msg.referrals?.length > 0 && (
                  <div className="ml-11 mt-3 space-y-3">
                    {msg.decision_support && (
                      <CaseSummaryCard
                        urgency={msg.decision_support.urgency}
                        risk={msg.decision_support.overall_risk}
                        nextSteps={[
                          ...(Array.isArray(msg.decision_support.urgency?.reasons) ? msg.decision_support.urgency.reasons : []),
                          ...(Array.isArray(msg.decision_support.complexity?.reasons) ? msg.decision_support.complexity.reasons : []),
                          ...(Array.isArray(msg.decision_support.self_help?.reasons) ? msg.decision_support.self_help.reasons : []),
                        ].slice(0, 5)}
                        topic={conversationState?.topic}
                      />
                    )}
                    <p className="text-sm font-semibold text-foreground">{t("chat.referralsTitle")}</p>
                    {msg.referrals.map((ref, i) => (
                      <div key={i} className="space-y-2">
                        <ReferralCard referral={ref} />
                        <ReferralMap referral={ref} userZip={conversationState?.zip_code} t={t} />
                      </div>
                    ))}
                    {isLastReferralMsg && (
                      <div className="space-y-3 pt-1">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-xl gap-1.5"
                            onClick={handlePrintReferrals}
                          >
                            <FaPrint className="w-3 h-3" /> {t("chat.printResources")}
                          </Button>
                        </div>
                        {triageFeedback !== "done" ? (
                          <div role="group" aria-label={t("chat.feedbackQuestion")}>
                            <p className="text-sm text-muted-foreground mb-2">{t("chat.feedbackQuestion")}</p>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                className="rounded-xl"
                                onClick={() => handleTriageFeedback(true)}
                                disabled={loading}
                              >
                                {t("chat.feedbackYes")}
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="rounded-xl"
                                onClick={() => handleTriageFeedback(false)}
                                disabled={loading}
                              >
                                {t("chat.feedbackNo")}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground" role="status">{t("chat.feedbackThanks")}</p>
                        )}
                        <GuidedCaseTimelinePanel
                          topic={conversationState.topic}
                          onTrackEvent={(eventType, eventValue) => postIntakeEvent(eventType, eventValue)}
                        />
                        <TopicResourcesPanel topic={conversationState.topic} />
                        <DocumentGeneratorPanel topic={conversationState.topic} intakeId={intakeId} />
                        <div className="rounded-2xl border border-border bg-muted/40 p-4">
                          <Button
                            type="button"
                            className="w-full rounded-xl gap-2 mb-2"
                            onClick={() => {
                              postIntakeEvent("ai_assistant_opened", currentTopic || "");
                              setShowAIChat(true);
                            }}
                          >
                            <FaRobot /> {t("chat.aiButton")}
                          </Button>
                          <p className="text-xs text-muted-foreground text-center">{t("chat.aiHint")}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {loading && (
            <div className="flex items-start gap-3 mb-1">
              <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                ⚖
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-md px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "-0.3s" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "-0.15s" }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-[#e2e8f0] bg-white px-6 py-4 shrink-0">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSubmit} className="relative">
              <Textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
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
                rows={1}
                style={{ resize: "none", minHeight: "52px", maxHeight: "160px", overflowY: "auto" }}
                className="w-full rounded-full py-3 px-5 pr-14 border-2 border-[#e2e8f0] text-[#1e293b] placeholder:text-[#94a3b8] text-sm leading-relaxed focus:outline-none focus:border-[#1e293b]"
                aria-label={t("chat.placeholder")}
              />
              <Button
                type="submit"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full h-10 w-10 shrink-0 bg-[#1e293b] hover:bg-[#334155]"
                disabled={loading || !userInput.trim()}
                aria-label="Send message"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="w-4 h-4" aria-hidden />
                )}
              </Button>
            </form>
            <div className="flex items-center gap-4 mt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs gap-1.5 px-0 h-auto text-[#64748b] hover:text-[#1e293b]"
                onClick={handleBack}
                disabled={loading}
              >
                <ArrowLeft className="w-3 h-3" aria-hidden />
                {t("chat.backTitle")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs gap-1.5 px-0 h-auto text-[#64748b] hover:text-[#1e293b]"
                onClick={handleRestart}
                disabled={loading}
              >
                <RotateCcw className="w-3 h-3" aria-hidden />
                {t("chat.restartTitle")}
              </Button>
            </div>
            <p className="text-xs text-center mt-3" style={{ color: "#94a3b8" }}>Legal information and resources only, not legal advice.</p>
          </div>
        </div>
        </main>
        </div>

      <EmergencyButton />
    </SlackLayout>
  );
}

export default App;