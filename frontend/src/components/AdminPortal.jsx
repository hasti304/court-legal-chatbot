import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Eye, EyeOff, LayoutDashboard, Users, FileText, Download, AlertTriangle, X, Mail, CheckSquare, Square, Phone } from "lucide-react";
import { useTranslation } from "react-i18next";
import StatusBanner from "./StatusBanner";
import "./AdminPortal.css";
import {
  getAdminToken,
  setAdminToken,
  clearAdminToken,
  adminAuthHeaders,
} from "../utils/adminAuth";
import { getStoredTheme, persistTheme } from "../utils/themeStorage";
import { getApiBaseUrl } from "../utils/apiBase";
import calLogo from "../assets/cal_logo.png";

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

const TAB_LABELS = {
  overview: "Overview",
  intakes: "Intakes",
  submissions: "Submissions",
  export: "Export CSV",
  emergency: "Emergency Flagged",
  callbacks: "Callback Requests",
};

function decodeJwtEmail(tok) {
  try {
    const payload = JSON.parse(atob(tok.split(".")[1]));
    return payload.sub || payload.email || "";
  } catch {
    return "";
  }
}

function initialTabFromHash() {
  try {
    const raw = (window.location.hash || "").replace(/^#/, "") || "/";
    const r = raw.startsWith("/") ? raw : `/${raw}`;
    if (r.includes("/overview")) return "overview";
    if (r.includes("/submissions")) return "submissions";
    if (r.includes("/intakes")) return "intakes";
    if (r.includes("/export")) return "export";
    if (r.includes("/emergency")) return "emergency";
    if (r.includes("/callbacks")) return "callbacks";
    if (r === "/admin" || r === "/admin/") return "intakes";
  } catch {
    /* ignore */
  }
  return "intakes";
}

function formatTimestamp(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return String(iso);
  }
}

function formatPhoneDigits(d) {
  const x = String(d || "").replace(/\D/g, "");
  if (x.length === 10) return `(${x.slice(0, 3)}) ${x.slice(3, 6)}-${x.slice(6)}`;
  return d && String(d).trim() ? String(d) : "—";
}

function phoneTelHref(phone) {
  const x = String(phone || "").replace(/\D/g, "");
  if (x.length === 10) return `tel:+1${x}`;
  if (x.length >= 11) return `tel:+${x}`;
  return x ? `tel:${x}` : null;
}

function humanizeToken(value) {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  if (/^\d+$/.test(raw)) return raw;
  return raw
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatActivityEventName(eventType) {
  const key = String(eventType || "").trim().toLowerCase();
  const map = {
    ai_assistant_opened: "AI assistant opened",
    triage_completed: "Triage completed",
    referrals_shown: "Referrals shown",
    triage_level_assigned: "Triage level assigned",
    zip_entered: "ZIP entered",
    topic_selected: "Topic selected",
    problem_summary: "Problem summary",
    problem_summary_alternate_topic: "Problem summary (alternate topic)",
    navigator_login: "Navigator login",
    summary_topic_alignment: "Summary topic alignment",
    summary_topic_mismatch: "Summary topic mismatch",
    zip_topic_alignment: "ZIP topic alignment",
    zip_topic_mismatch: "ZIP topic mismatch",
    timeline_step_viewed: "Timeline step viewed",
    timeline_checklist_toggled: "Timeline checklist toggled",
  };
  return map[key] || humanizeToken(key);
}

function formatActivityDetail(eventType, eventValue) {
  const raw = String(eventValue || "").trim();
  if (!raw) return "—";
  const key = String(eventType || "").trim().toLowerCase();
  if (key === "referrals_shown") {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.map((x) => String(x || "").trim()).filter(Boolean).join(", ") || "—";
    } catch { /* ignore */ }
  }
  if (key === "summary_topic_mismatch" || key === "zip_topic_mismatch") {
    try {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === "object") {
        const selected = humanizeToken(obj.selected_topic || "");
        const inferred = humanizeToken(obj.inferred_topic || "");
        return `Selected: ${selected} | Inferred: ${inferred}`;
      }
    } catch { /* ignore */ }
  }
  if (key === "topic_selected") return humanizeToken(raw);
  return humanizeToken(raw);
}

function extractIssuesFromEvent(eventType, eventValue) {
  const key = String(eventType || "").trim().toLowerCase();
  const raw = String(eventValue || "").trim();
  if (!raw) return [];
  if (key === "topic_selected" || key === "ai_assistant_opened") return [humanizeToken(raw)];
  if (key === "summary_topic_mismatch" || key === "zip_topic_mismatch") {
    try {
      const obj = JSON.parse(raw);
      const selected = humanizeToken(obj?.selected_topic || "");
      const inferred = humanizeToken(obj?.inferred_topic || "");
      return [selected, inferred].filter((x) => x && x !== "—");
    } catch { return []; }
  }
  return [];
}

function getStaffAdminUrl() {
  try {
    const u = new URL(typeof window !== "undefined" ? window.location.href : "http://localhost/");
    u.hash = "#/admin";
    return u.href;
  } catch {
    return "#/admin";
  }
}

function formatDeadlineType(code) {
  const value = String(code || "").trim().toLowerCase();
  if (!value) return "Deadline";
  const map = {
    court_date: "Court date",
    response_due: "Response due",
    filing_deadline: "Filing deadline",
    general_deadline: "General deadline",
    other: "Deadline",
  };
  return map[value] || "Deadline";
}

function deadlineBadgeMeta(daysLeft) {
  if (typeof daysLeft !== "number" || Number.isNaN(daysLeft)) return null;
  if (daysLeft < 0) return { label: `${Math.abs(daysLeft)}d overdue`, tone: "overdue" };
  if (daysLeft === 0) return { label: "Due today", tone: "today" };
  return { label: `${daysLeft}d left`, tone: daysLeft <= 3 ? "soon" : "normal" };
}

function getInitials(email) {
  if (!email) return "AD";
  const local = email.split("@")[0];
  const parts = local.split(/[._\-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

function getStatusBadge(adminStatus) {
  const st = String(adminStatus || "pending").toLowerCase();
  if (st === "accepted") return { label: "Completed", cls: "badge-completed" };
  if (st === "rejected") return { label: "Flagged", cls: "badge-flagged" };
  if (st === "in_progress") return { label: "In Progress", cls: "badge-in-progress" };
  return { label: "New", cls: "badge-new" };
}

export default function AdminPortal() {
  const { t } = useTranslation();
  const apiUrl = useMemo(
    () => (path) => {
      const base = getApiBaseUrl();
      return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
    },
    []
  );
  const staffAdminUrl = useMemo(() => getStaffAdminUrl(), []);

  const [theme, setTheme] = useState(getStoredTheme);
  const [token, setToken] = useState(() => getAdminToken());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState(() => { const tk = getAdminToken(); return tk ? decodeJwtEmail(tk) : ""; });
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState(initialTabFromHash);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(false);

  const [basic, setBasic] = useState(null);
  const [detailed, setDetailed] = useState(null);
  const [healthChecks, setHealthChecks] = useState(null);
  const [healthBusy, setHealthBusy] = useState(false);
  const [intakes, setIntakes] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [statusBusy, setStatusBusy] = useState({});
  const [statusDraft, setStatusDraft] = useState(null);
  const [statusNote, setStatusNote] = useState("");
  const [notifyUser, setNotifyUser] = useState(true);
  const [emailModal, setEmailModal] = useState(null);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [modalBusy, setModalBusy] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createFirst, setCreateFirst] = useState("");
  const [createLast, setCreateLast] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createZip, setCreateZip] = useState("");
  const [createLang, setCreateLang] = useState("en");
  const [deleteDraft, setDeleteDraft] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [summaryModal, setSummaryModal] = useState(null);
  const [activityModal, setActivityModal] = useState(null);
  const [activityEvents, setActivityEvents] = useState([]);
  const [activityBusy, setActivityBusy] = useState(false);
  const [activityError, setActivityError] = useState("");
  const [activityIssueFilter, setActivityIssueFilter] = useState("all");
  const [evidenceModal, setEvidenceModal] = useState(null);
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [evidenceError, setEvidenceError] = useState("");
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [evidenceTimeline, setEvidenceTimeline] = useState([]);
  const [issuePickById, setIssuePickById] = useState({});
  const [summaryPickById, setSummaryPickById] = useState({});

  // New UI state
  const [overviewDateFilter, setOverviewDateFilter] = useState("today");
  const [intakesSearch, setIntakesSearch] = useState("");
  const [intakesStatusFilter, setIntakesStatusFilter] = useState("all");
  const [intakeDrawer, setIntakeDrawer] = useState(null);
  const [intakeDrawerNote, setIntakeDrawerNote] = useState("");
  const [intakeLocalNotes, setIntakeLocalNotes] = useState({});
  const [submissionsSearch, setSubmissionsSearch] = useState("");
  const [submissionsDrawer, setSubmissionsDrawer] = useState(null);
  const [submissionsReadMap, setSubmissionsReadMap] = useState({});
  const [exportDateFrom, setExportDateFrom] = useState("");
  const [exportDateTo, setExportDateTo] = useState("");
  const [exportIssueFilter, setExportIssueFilter] = useState("all");
  const [exportStatusFilterVal, setExportStatusFilterVal] = useState("all");
  const [lastExportedTime, setLastExportedTime] = useState(null);
  const [callbackPopover, setCallbackPopover] = useState(null); // null | intake_id string
  const [markCalledBusy, setMarkCalledBusy] = useState({});

  const portalClass = `admin-portal-page${theme === "light" ? " admin-portal-page--light" : ""}`;

  useLayoutEffect(() => {
    persistTheme(theme);
    document.documentElement.setAttribute("data-cal-theme", theme);
  }, [theme]);

  // Load persisted data from localStorage
  useEffect(() => {
    try {
      const notes = JSON.parse(localStorage.getItem("admin_intake_notes") || "{}");
      setIntakeLocalNotes(notes);
    } catch { /* ignore */ }
    try {
      const readMap = JSON.parse(localStorage.getItem("admin_submissions_read") || "{}");
      setSubmissionsReadMap(readMap);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const onHash = () => setTab(initialTabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const setTabAndHash = (t) => {
    setTab(t);
    if (t === "overview") window.location.hash = "#/admin/overview";
    else if (t === "submissions") window.location.hash = "#/admin/submissions";
    else if (t === "intakes") window.location.hash = "#/admin/intakes";
    else if (t === "export") window.location.hash = "#/admin/export";
    else if (t === "emergency") window.location.hash = "#/admin/emergency";
    else if (t === "callbacks") window.location.hash = "#/admin/callbacks";
    else window.location.hash = "#/admin/intakes";
  };

  const logout = async (reason = "") => {
    const existingToken = getAdminToken();
    if (existingToken) {
      try {
        await fetch(apiUrl("/admin/logout"), {
          method: "POST",
          headers: { Authorization: `Bearer ${existingToken}` },
        });
      } catch { /* best effort */ }
    }
    clearAdminToken();
    setToken("");
    setAdminEmail("");
    setBasic(null);
    setDetailed(null);
    setIntakes([]);
    setSubmissions([]);
    setStatusBusy({});
    setStatusDraft(null);
    setEmailModal(null);
    setCreateModalOpen(false);
    setDeleteDraft(null);
    setSummaryModal(null);
    setActivityModal(null);
    setActivityEvents([]);
    setActivityError("");
    setEvidenceModal(null);
    setEvidenceFiles([]);
    setEvidenceTimeline([]);
    setEvidenceError("");
    setLoadError("");
    if (reason) setLoginError(reason);
  };

  const login = async (e) => {
    e.preventDefault();
    if (loggingIn) return;
    setLoginError("");
    setLoggingIn(true);
    try {
      const res = await fetch(apiUrl("/admin/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail ? String(data.detail) : `Login failed (${res.status})`);
      if (!data.access_token) throw new Error("Invalid response from server.");
      setAdminToken(data.access_token);
      setToken(data.access_token);
      setAdminEmail(email.trim());
      setPassword("");
    } catch (err) {
      setLoginError(err?.message && String(err.message).trim().length > 0 ? String(err.message) : "Unable to sign in.");
    } finally {
      setLoggingIn(false);
    }
  };

  const authFetch = useCallback(
    async (path, options = {}) => {
      const headers = { ...(options.headers || {}), ...adminAuthHeaders() };
      try {
        return await fetch(apiUrl(path), { ...options, headers });
      } catch (err) {
        const msg = String(err?.message || "").toLowerCase();
        const isNetworkFailure =
          err instanceof TypeError ||
          msg.includes("failed to fetch") ||
          msg.includes("networkerror") ||
          msg.includes("load failed");
        if (isNetworkFailure) {
          throw new Error("Cannot reach the API right now (possible cold start or temporary outage). Please wait a few seconds and try again.");
        }
        throw err;
      }
    },
    [apiUrl]
  );

  const loadOverview = useCallback(async () => {
    setLoadError("");
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        authFetch("/admin/basic-analytics"),
        authFetch("/admin/stats"),
      ]);
      if (!r1.ok) {
        const d = await r1.json().catch(() => ({}));
        throw new Error(d.detail ? String(d.detail) : `Analytics ${r1.status}`);
      }
      if (!r2.ok) {
        const d = await r2.json().catch(() => ({}));
        throw new Error(d.detail ? String(d.detail) : `Stats ${r2.status}`);
      }
      setBasic(await r1.json());
      setDetailed(await r2.json());
    } catch (err) {
      setBasic(null);
      setDetailed(null);
      setLoadError(err?.message && String(err.message).trim().length > 0 ? String(err.message) : "Failed to load overview.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  const runHealthChecks = useCallback(async () => {
    if (healthBusy) return;
    setHealthBusy(true);
    setLoadError("");
    try {
      const res = await authFetch("/admin/health-checks");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail ? String(data.detail) : `Health checks ${res.status}`);
      setHealthChecks(data);
    } catch (err) {
      setHealthChecks(null);
      setLoadError(err?.message && String(err.message).trim().length > 0 ? String(err.message) : "Failed to run health checks.");
    } finally {
      setHealthBusy(false);
    }
  }, [authFetch, healthBusy]);

  const loadIntakes = useCallback(async () => {
    setLoadError("");
    setLoading(true);
    try {
      const res = await authFetch("/admin/intakes");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ? String(d.detail) : `Intakes ${res.status}`);
      }
      const data = await res.json();
      setIntakes(Array.isArray(data) ? data : []);
    } catch (err) {
      setIntakes([]);
      let detail = "";
      try {
        const health = await fetch(apiUrl("/health"));
        if (health.ok) detail = "API is up, but admin endpoint failed. Try signing out/in again.";
      } catch {
        detail = "API health check is unreachable from this browser origin.";
      }
      const baseMessage = err?.message && String(err.message).trim().length > 0 ? String(err.message) : "Failed to load intakes.";
      setLoadError(detail ? `${baseMessage} ${detail}` : baseMessage);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, authFetch]);

  const markCallbackCalled = useCallback(async (intakeId) => {
    setMarkCalledBusy(prev => ({ ...prev, [intakeId]: true }));
    try {
      await authFetch(`/admin/intakes/${intakeId}/callback/mark-called`, { method: "POST" });
      setCallbackPopover(null);
      await loadIntakes();
    } catch {
      // silently ignore; table will still show current state
    } finally {
      setMarkCalledBusy(prev => ({ ...prev, [intakeId]: false }));
    }
  }, [authFetch, loadIntakes]);

  const openActivityModal = async (row) => {
    setActivityModal(row);
    setActivityEvents([]);
    setActivityError("");
    setActivityIssueFilter("all");
    setActivityBusy(true);
    try {
      const res = await authFetch(`/admin/intakes/${encodeURIComponent(row.id)}/events`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail ? String(data.detail) : `Failed (${res.status})`);
      setActivityEvents(Array.isArray(data.events) ? data.events : []);
    } catch (err) {
      setActivityError(err?.message && String(err.message).trim().length > 0 ? String(err.message) : "Could not load activity.");
    } finally {
      setActivityBusy(false);
    }
  };

  const openEvidenceModal = async (row) => {
    setEvidenceModal(row);
    setEvidenceFiles([]);
    setEvidenceTimeline([]);
    setEvidenceError("");
    setEvidenceBusy(true);
    try {
      const res = await authFetch(`/admin/intakes/${encodeURIComponent(row.id)}/evidence`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail ? String(data.detail) : `Failed (${res.status})`);
      setEvidenceFiles(Array.isArray(data.files) ? data.files : []);
      setEvidenceTimeline(Array.isArray(data.timeline) ? data.timeline : []);
    } catch (err) {
      setEvidenceError(err?.message && String(err.message).trim().length > 0 ? String(err.message) : "Could not load evidence.");
    } finally {
      setEvidenceBusy(false);
    }
  };

  const downloadEvidenceFile = async (fileId, filename) => {
    try {
      const res = await authFetch(`/documents/file/${encodeURIComponent(fileId)}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ? String(d.detail) : `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "evidence-file";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setLoadError(err?.message && String(err.message).trim().length > 0 ? String(err.message) : "Could not download evidence file.");
    }
  };

  const submitIntakeStatusUpdate = async (intakeId, status, { sendNotification, note }) => {
    if (statusBusy[intakeId]) return false;
    setStatusBusy((s) => ({ ...s, [intakeId]: true }));
    setLoadError("");
    try {
      const res = await authFetch(
        `/admin/intakes/${encodeURIComponent(intakeId)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            send_notification: status === "pending" ? false : !!sendNotification,
            notification_note: status === "pending" ? "" : note || "",
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(data.detail ? String(data.detail) : `Update failed (${res.status})`);
        return false;
      }
      setIntakes((prev) => prev.map((r) => (r.id === intakeId ? { ...r, admin_status: status } : r)));
      if (sendNotification && (status === "accepted" || status === "rejected") && data.email_sent !== true) {
        setLoadError("Status was saved, but the notification email could not be sent. Configure RESEND_API_KEY or SMTP on the server.");
      }
      return true;
    } catch (err) {
      setLoadError(err?.message && String(err.message).trim().length > 0 ? String(err.message) : "Could not update status.");
      return false;
    } finally {
      setStatusBusy((s) => ({ ...s, [intakeId]: false }));
    }
  };

  const openStatusChangeModal = (row, nextStatus) => {
    const cur = String(row.admin_status || "pending").toLowerCase();
    if (nextStatus === cur) return;
    setStatusNote("");
    setNotifyUser(nextStatus === "accepted" || nextStatus === "rejected");
    setStatusDraft({
      id: row.id,
      email: row.email,
      label: [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || row.email || row.id,
      nextStatus,
      prevStatus: cur,
    });
  };

  const closeStatusModal = () => { setStatusDraft(null); setStatusNote(""); };

  const confirmStatusModal = async () => {
    if (!statusDraft || modalBusy) return;
    setModalBusy(true);
    setLoadError("");
    try {
      const ok = await submitIntakeStatusUpdate(statusDraft.id, statusDraft.nextStatus, {
        sendNotification: notifyUser,
        note: statusNote,
      });
      if (ok) closeStatusModal();
    } finally {
      setModalBusy(false);
    }
  };

  const openEmailModal = (row) => {
    setComposeSubject("");
    setComposeBody("");
    setEmailModal({
      id: row.id,
      email: row.email,
      label: [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || row.email || row.id,
    });
  };

  const closeEmailModal = () => { setEmailModal(null); setComposeSubject(""); setComposeBody(""); };

  const sendCustomEmail = async () => {
    if (!emailModal || modalBusy) return;
    const subj = composeSubject.trim();
    const bod = composeBody.trim();
    if (!subj || !bod) { setLoadError("Subject and message are required."); return; }
    setModalBusy(true);
    setLoadError("");
    try {
      const res = await authFetch(`/admin/intakes/${encodeURIComponent(emailModal.id)}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subj, body: bod }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail ? String(data.detail) : `Send failed (${res.status})`);
      if (!data.email_sent) {
        setLoadError("Message was not delivered. Configure RESEND_API_KEY or SMTP on the server, then try again.");
        return;
      }
      closeEmailModal();
    } catch (err) {
      setLoadError(err?.message && String(err.message).trim().length > 0 ? String(err.message) : "Could not send email.");
    } finally {
      setModalBusy(false);
    }
  };

  const openCreateClientModal = () => {
    setCreateFirst(""); setCreateLast(""); setCreateEmail("");
    setCreatePhone(""); setCreateZip(""); setCreateLang("en");
    setLoadError("");
    setCreateModalOpen(true);
  };

  const closeCreateClientModal = () => setCreateModalOpen(false);

  const submitCreateClient = async () => {
    if (modalBusy) return;
    const zip = String(createZip || "").replace(/\D/g, "").slice(0, 5);
    if (zip.length !== 5) { setLoadError("ZIP must be exactly 5 digits."); return; }
    setModalBusy(true);
    setLoadError("");
    try {
      const res = await authFetch("/admin/intakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: createFirst.trim(),
          last_name: createLast.trim(),
          email: createEmail.trim(),
          phone: createPhone.trim(),
          zip,
          language: createLang || "en",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail ? String(data.detail) : `Create failed (${res.status})`);
      closeCreateClientModal();
      await loadIntakes();
    } catch (err) {
      setLoadError(err?.message && String(err.message).trim().length > 0 ? String(err.message) : "Could not create client.");
    } finally {
      setModalBusy(false);
    }
  };

  const openDeleteIntakeModal = (row) => {
    setDeleteDraft({
      id: row.id,
      label: [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || row.email || row.id,
      email: row.email,
    });
    setLoadError("");
  };

  const closeDeleteIntakeModal = () => setDeleteDraft(null);

  const confirmDeleteIntake = async () => {
    if (!deleteDraft || deleteBusy) return;
    setDeleteBusy(true);
    setLoadError("");
    try {
      const res = await authFetch(`/admin/intakes/${encodeURIComponent(deleteDraft.id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail ? String(data.detail) : `Delete failed (${res.status})`);
      if (statusDraft?.id === deleteDraft.id) closeStatusModal();
      if (emailModal?.id === deleteDraft.id) closeEmailModal();
      closeDeleteIntakeModal();
      await loadIntakes();
    } catch (err) {
      setLoadError(err?.message && String(err.message).trim().length > 0 ? String(err.message) : "Could not delete client.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const loadSubmissions = useCallback(async () => {
    setLoadError("");
    setLoading(true);
    try {
      const res = await authFetch("/intake/submissions?limit=100");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ? String(d.detail) : `Submissions ${res.status}`);
      }
      const data = await res.json();
      setSubmissions(Array.isArray(data) ? data : []);
    } catch (err) {
      setSubmissions([]);
      setLoadError(err?.message && String(err.message).trim().length > 0 ? String(err.message) : "Failed to load submissions.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  const createTestSubmission = async () => {
    setLoadError("");
    try {
      const stamp = new Date().toISOString();
      const payload = {
        name: "Test User",
        email: "test.submission+admin@chicagoadvocatelegal.com",
        phone: "3125550100",
        zip_code: "60601",
        issue_type: "Housing",
        message: `Admin test submission created at ${stamp}`,
      };
      const res = await authFetch("/intake/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail ? String(data.detail) : `Create test submission failed (${res.status})`);
      await loadSubmissions();
    } catch (err) {
      setLoadError(err?.message && String(err.message).trim().length > 0 ? String(err.message) : "Failed to create test submission.");
    }
  };

  const downloadCsv = async () => {
    setLoadError("");
    try {
      const res = await authFetch("/admin/intakes.csv");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail ? String(d.detail) : `Export ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "intakes.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setLoadError(err?.message && String(err.message).trim().length > 0 ? String(err.message) : "CSV download failed.");
    }
  };

  useEffect(() => {
    if (!token) return;
    if (tab === "overview") loadOverview();
    if (tab === "intakes") loadIntakes();
    if (tab === "submissions") loadSubmissions();
    if (tab === "emergency") loadIntakes();
  }, [token, tab, loadOverview, loadIntakes, loadSubmissions]);

  useEffect(() => {
    if (!token) return undefined;
    const activityEvts = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
    let timer = 0;
    const resetInactivityTimer = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => { void logout("You were signed out after 5 minutes of inactivity."); }, INACTIVITY_TIMEOUT_MS);
    };
    for (const ev of activityEvts) window.addEventListener(ev, resetInactivityTimer, { passive: true });
    resetInactivityTimer();
    return () => {
      if (timer) window.clearTimeout(timer);
      for (const ev of activityEvts) window.removeEventListener(ev, resetInactivityTimer);
    };
  }, [token]);

  const activityIssueOptions = useMemo(() => {
    const counts = new Map();
    for (const ev of activityEvents) {
      for (const issue of extractIssuesFromEvent(ev?.event_type, ev?.event_value)) {
        counts.set(issue, (counts.get(issue) || 0) + 1);
      }
    }
    return Array.from(counts.entries()).map(([issue, count]) => ({ issue, count, label: `${issue} (${count})` }));
  }, [activityEvents]);

  const filteredActivityEvents = useMemo(() => {
    if (activityIssueFilter === "all") return activityEvents;
    return activityEvents.filter((ev) =>
      extractIssuesFromEvent(ev?.event_type, ev?.event_value).includes(activityIssueFilter)
    );
  }, [activityEvents, activityIssueFilter]);

  // New computed values
  const emergencyIntakesAll = useMemo(
    () => intakes.filter((r) => r.emergency_flagged === true || r.is_emergency === true),
    [intakes]
  );

  const emergencyCount = useMemo(() => {
    if (emergencyIntakesAll.length > 0) return emergencyIntakesAll.length;
    return detailed?.overview?.emergency_sessions ?? 0;
  }, [emergencyIntakesAll, detailed]);

  const callbackIntakes = useMemo(
    () =>
      intakes
        .filter((r) => r.callback_requested === true)
        .slice()
        .sort((a, b) => {
          const ta = a.callback_created_at || a.created_at || "";
          const tb = b.callback_created_at || b.created_at || "";
          return tb.localeCompare(ta);
        }),
    [intakes]
  );

  const pendingCallbackCount = useMemo(
    () => callbackIntakes.filter((r) => (r.callback_status || "pending") === "pending").length,
    [callbackIntakes]
  );

  const filteredIntakes = useMemo(() => {
    let r = tab === "emergency" ? emergencyIntakesAll : intakes;
    if (intakesSearch.trim()) {
      const q = intakesSearch.trim().toLowerCase();
      r = r.filter((x) =>
        [x.first_name, x.last_name, x.email, x.phone].some((v) => String(v || "").toLowerCase().includes(q))
      );
    }
    if (tab !== "emergency" && intakesStatusFilter !== "all") {
      r = r.filter((x) => {
        const st = String(x.admin_status || "pending").toLowerCase();
        const map = { new: ["pending"], in_progress: [], completed: ["accepted"], flagged: ["rejected"] };
        return (map[intakesStatusFilter] || []).includes(st);
      });
    }
    return r;
  }, [intakes, emergencyIntakesAll, intakesSearch, intakesStatusFilter, tab]);

  const filteredSubmissions = useMemo(() => {
    if (!submissionsSearch.trim()) return submissions;
    const q = submissionsSearch.trim().toLowerCase();
    return submissions.filter((r) =>
      [r.name, r.email].some((v) => String(v || "").toLowerCase().includes(q))
    );
  }, [submissions, submissionsSearch]);

  const openIntakeDrawer = (row) => {
    setIntakeDrawer(row);
    setIntakeDrawerNote(intakeLocalNotes[row.email] || "");
  };

  const saveIntakeNote = (emailKey, note) => {
    const updated = { ...intakeLocalNotes, [emailKey]: note };
    setIntakeLocalNotes(updated);
    try { localStorage.setItem("admin_intake_notes", JSON.stringify(updated)); } catch { /* ignore */ }
  };

  const toggleSubmissionRead = (id) => {
    const updated = { ...submissionsReadMap, [id]: !submissionsReadMap[id] };
    setSubmissionsReadMap(updated);
    try { localStorage.setItem("admin_submissions_read", JSON.stringify(updated)); } catch { /* ignore */ }
  };

  // ─── Login screen ───────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="admin-login-split" data-admin-entry-url={staffAdminUrl}>
        <div className="admin-login-left">
          <div className="admin-login-left-inner">
            <div className="admin-login-left-brand">
              <img src={calLogo} alt="Chicago Advocate Legal, NFP logo" className="admin-login-logo" />
            </div>
            <div className="admin-login-left-text">
              <h2 className="admin-login-left-headline">Staff Admin Portal</h2>
              <p className="admin-login-left-body">
                Secure staff access to manage intakes, submissions, and client data for Chicago Advocate Legal, NFP.
              </p>
            </div>
          </div>
        </div>

        <div className="admin-login-right">
          <div className="admin-login-right-inner">
            <h1 className="admin-login-heading">Admin Sign In</h1>
            <p className="admin-login-subheading">Sign in with your staff credentials.</p>

            {loginError ? (
              <StatusBanner type="error" role="alert" style={{ marginBottom: 14 }}>{loginError}</StatusBanner>
            ) : null}

            <form onSubmit={login}>
              <div className="admin-portal-field">
                <label htmlFor="admin-email">Email</label>
                <input
                  id="admin-email"
                  className="admin-portal-input"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-label="Email address"
                  required
                />
              </div>
              <div className="admin-portal-field" style={{ marginBottom: 20 }}>
                <label htmlFor="admin-password">Password</label>
                <div className="admin-portal-password-wrap">
                  <input
                    id="admin-password"
                    className="admin-portal-input admin-portal-input--with-toggle"
                    type={showStaffPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-label="Password"
                    required
                  />
                  <button
                    type="button"
                    className="admin-portal-password-toggle"
                    onClick={() => setShowStaffPassword((s) => !s)}
                    aria-label={showStaffPassword ? t("login.hidePassword") : t("login.showPassword")}
                  >
                    {showStaffPassword ? <EyeOff className="admin-eye-icon" size={16} aria-hidden /> : <Eye className="admin-eye-icon" size={16} aria-hidden />}
                  </button>
                </div>
              </div>
              <button type="submit" className="admin-portal-btn admin-portal-btn-primary" disabled={loggingIn}>
                {loggingIn ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="admin-login-back">
              <a className="admin-login-back-link" href="#/">← Back to app</a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main portal ────────────────────────────────────────────────────────────
  const renderIntakesTable = (rows, showToolbar, isEmergency) => (
    <div className="admin-portal-panel">
      {showToolbar && (
        <div className="admin-panel-header">
          <div className="admin-panel-actions">
            <button type="button" className="admin-action-btn" onClick={openCreateClientModal} disabled={loading}>
              Add client
            </button>
            <button type="button" className="admin-action-btn" onClick={loadIntakes} disabled={loading}>
              Refresh cases
            </button>
          </div>
        </div>
      )}

      {showToolbar && (
        <div className="admin-filter-row">
          <input
            type="search"
            className="admin-filter-search"
            placeholder="Search by name, email, or phone…"
            value={intakesSearch}
            onChange={(e) => setIntakesSearch(e.target.value)}
          />
          <select
            className="admin-filter-select"
            value={intakesStatusFilter}
            onChange={(e) => setIntakesStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="flagged">Flagged</option>
          </select>
        </div>
      )}

      <div className="admin-table-count">
        Showing {rows.length} client{rows.length !== 1 ? "s" : ""}
      </div>

      <div className="admin-portal-table-wrap">
        <table className="admin-portal-table admin-portal-table-cases">
          <thead>
            <tr>
              <th>First name</th>
              <th>Last name</th>
              <th>Email</th>
              <th>ZIP</th>
              <th>Phone</th>
              <th>Issue (triage topic)</th>
              <th>Logins</th>
              <th>Summary</th>
              <th>Deadline</th>
              <th>Activity</th>
              <th>Evidence</th>
              <th>Created</th>
              <th>Status</th>
              <th>Email user</th>
              <th>Manage</th>
              <th>Intake Status</th>
              <th>Callback</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading ? (
              isEmergency ? (
                <tr>
                  <td colSpan={17} className="admin-portal-empty-cell admin-empty-emergency">
                    <span className="admin-empty-check-icon">✓</span>
                    No emergency cases flagged
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={17} className="admin-portal-empty-cell">No intake accounts yet.</td>
                </tr>
              )
            ) : (
              rows.map((row) => {
                const issueOptions = Array.isArray(row.issues) && row.issues.length > 0 ? row.issues : [row.issue || "—"];
                const selectedIssue = issuePickById[row.id] || issueOptions[0] || "—";
                const summaryOptions = Array.isArray(row.summaries) ? row.summaries.filter((x) => String(x || "").trim()) : [];
                const selectedSummary = summaryPickById[row.id] || summaryOptions[0] || "";
                const st = String(row.admin_status || "pending").toLowerCase();
                const displayStatus = statusDraft?.id === row.id ? statusDraft.nextStatus : st;
                const selClass = `admin-portal-status-select admin-portal-status-select--${displayStatus}`;
                const badge = getStatusBadge(row.admin_status);
                return (
                  <tr
                    key={row.id}
                    className={`admin-portal-row-status admin-portal-row-status-${displayStatus} admin-table-row-clickable`}
                    onClick={(e) => {
                      if (e.target.closest("button") || e.target.closest("select") || e.target.closest("a")) return;
                      openIntakeDrawer(row);
                    }}
                  >
                    <td className="admin-portal-cell-name" title={row.first_name ?? "—"}>{row.first_name ?? "—"}</td>
                    <td className="admin-portal-cell-name" title={row.last_name ?? "—"}>{row.last_name ?? "—"}</td>
                    <td className="admin-portal-cell-email" title={row.email ?? "—"}>{row.email ?? "—"}</td>
                    <td className="admin-portal-cell-zip">{row.zip?.trim() ? row.zip : "—"}</td>
                    <td className="admin-portal-cell-phone">
                      {(() => {
                        const label = formatPhoneDigits(row.phone);
                        const href = phoneTelHref(row.phone);
                        if (!href || label === "—") return label;
                        return <a className="admin-portal-phone-link" href={href}>{label}</a>;
                      })()}
                    </td>
                    <td className="admin-portal-cell-issue" title={row.issue ?? "—"}>
                      {issueOptions.length > 1 ? (
                        <select
                          className="admin-portal-cell-select"
                          value={selectedIssue}
                          onChange={(e) => setIssuePickById((prev) => ({ ...prev, [row.id]: e.target.value }))}
                        >
                          {issueOptions.map((v, idx) => <option key={`${row.id}-issue-${idx}`} value={v}>{v}</option>)}
                        </select>
                      ) : selectedIssue}
                    </td>
                    <td>{row.login_count != null ? Number(row.login_count) : 0}</td>
                    <td className="admin-portal-cell-summary">
                      <div className="admin-portal-summary-inline">
                        {summaryOptions.length > 1 ? (
                          <select
                            className="admin-portal-cell-select"
                            value={selectedSummary}
                            onChange={(e) => setSummaryPickById((prev) => ({ ...prev, [row.id]: e.target.value }))}
                          >
                            {summaryOptions.map((v, idx) => <option key={`${row.id}-summary-${idx}`} value={v}>{`Summary ${idx + 1}`}</option>)}
                          </select>
                        ) : null}
                        <button
                          type="button"
                          className="admin-portal-btn admin-portal-btn-compact"
                          onClick={() => setSummaryModal({ ...row, problem_summary: selectedSummary })}
                          disabled={!selectedSummary}
                        >
                          View
                        </button>
                      </div>
                    </td>
                    <td className="admin-portal-cell-deadline">
                      {(() => {
                        const daysLeft = Number(row.next_deadline_days_left);
                        const hasDate = String(row.next_deadline_date || "").trim().length > 0;
                        if (!hasDate) return <span className="admin-portal-muted">—</span>;
                        const bdg = deadlineBadgeMeta(daysLeft);
                        return (
                          <div className="admin-portal-deadline-wrap">
                            <div className="admin-portal-deadline-type">{formatDeadlineType(row.next_deadline_type)}</div>
                            <div className={`admin-portal-deadline-badge admin-portal-deadline-badge--${bdg?.tone || "normal"}`}>
                              {bdg?.label || "Tracked"}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td>
                      <button type="button" className="admin-portal-btn admin-portal-btn-compact" onClick={() => void openActivityModal(row)} disabled={loading}>
                        View log
                      </button>
                    </td>
                    <td>
                      <button type="button" className="admin-portal-btn admin-portal-btn-compact" onClick={() => void openEvidenceModal(row)} disabled={loading}>
                        Evidence
                      </button>
                    </td>
                    <td className="admin-portal-cell-date">{formatTimestamp(row.created_at)}</td>
                    <td>
                      <select
                        className={selClass}
                        aria-label={`Status for ${row.email || row.id}`}
                        value={displayStatus}
                        disabled={!!statusBusy[row.id]}
                        onChange={(e) => openStatusChangeModal(row, e.target.value)}
                      >
                        <option value="pending">Pending</option>
                        <option value="accepted">Accepted</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </td>
                    <td>
                      <button type="button" className="admin-portal-btn admin-portal-btn-compact" onClick={() => openEmailModal(row)} disabled={!!statusBusy[row.id]}>
                        Compose…
                      </button>
                    </td>
                    <td>
                      <button type="button" className="admin-portal-btn admin-portal-btn-compact admin-portal-btn-danger" onClick={() => openDeleteIntakeModal(row)} disabled={!!statusBusy[row.id] || deleteBusy}>
                        Delete
                      </button>
                    </td>
                    <td>
                      <span className={`admin-status-badge ${badge.cls}`}>{badge.label}</span>
                    </td>
                    <td className="admin-callback-cell">
                      {row.callback_requested || row.callback_phone ? (() => {
                        const isCalled = row.callback_status === "called";
                        const isOpen = callbackPopover === row.id;
                        const timeLabel = row.callback_preferred_time
                          ? row.callback_preferred_time.charAt(0).toUpperCase() + row.callback_preferred_time.slice(1)
                          : null;
                        return (
                          <div className="admin-callback-wrap">
                            <button
                              type="button"
                              className={`admin-callback-badge${isCalled ? " admin-callback-badge--called" : ""}`}
                              onClick={() => setCallbackPopover(isOpen ? null : row.id)}
                            >
                              {isCalled ? "Called ✓" : "📞 Callback Requested"}
                            </button>
                            {timeLabel && !isCalled && (
                              <div className="admin-callback-time">Preferred: {timeLabel}</div>
                            )}
                            {isOpen && (
                              <div className="admin-callback-popover">
                                <button
                                  type="button"
                                  className="admin-callback-popover-close"
                                  onClick={() => setCallbackPopover(null)}
                                >×</button>
                                <div className="admin-callback-popover-name">
                                  {row.first_name} {row.last_name}
                                </div>
                                <div className="admin-callback-popover-row">
                                  <span className="admin-callback-popover-label">Phone</span>
                                  <span>{row.callback_phone || row.phone || "—"}</span>
                                </div>
                                <div className="admin-callback-popover-row">
                                  <span className="admin-callback-popover-label">Preferred time</span>
                                  <span>{timeLabel || "—"}</span>
                                </div>
                                <div className="admin-callback-popover-row">
                                  <span className="admin-callback-popover-label">Issue</span>
                                  <span>{(row.issues || []).join(", ") || row.issue || "—"}</span>
                                </div>
                                <div className="admin-callback-popover-row">
                                  <span className="admin-callback-popover-label">Risk score</span>
                                  <span>{row.risk_score != null ? `${row.risk_score}/100` : "—"}</span>
                                </div>
                                {!isCalled && (
                                  <button
                                    type="button"
                                    className="admin-callback-popover-btn"
                                    disabled={!!markCalledBusy[row.id]}
                                    onClick={() => void markCallbackCalled(row.id)}
                                  >
                                    {markCalledBusy[row.id] ? "Saving…" : "Mark as called"}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })() : (
                        <span className="admin-portal-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className={portalClass}>
      <div className="admin-portal-layout" aria-busy={loading || healthBusy ? "true" : "false"}>

        {/* ── Sidebar ── */}
        <aside className="admin-portal-sidebar" aria-label="Admin navigation">
          <div className="admin-sidebar-brand">
            <img src={calLogo} alt="Chicago Advocate Legal, NFP logo" className="admin-sidebar-logo" />
            <span className="admin-sidebar-brand-sub">Chicago Advocate Legal, NFP</span>
          </div>

          <nav className="admin-sidebar-nav" role="tablist">
            {[
              { id: "overview", label: "Overview", icon: <LayoutDashboard size={16} aria-hidden /> },
              { id: "intakes", label: "Intakes", icon: <Users size={16} aria-hidden /> },
              { id: "submissions", label: "Submissions", icon: <FileText size={16} aria-hidden /> },
              { id: "export", label: "Export CSV", icon: <Download size={16} aria-hidden /> },
              { id: "emergency", label: "Emergency Flagged", icon: <AlertTriangle size={16} aria-hidden />, badge: emergencyCount },
              { id: "callbacks", label: "Callback Requests", icon: <Phone size={16} aria-hidden />, badge: pendingCallbackCount },
            ].map(({ id, label, icon, badge }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={`admin-sidebar-nav-item${tab === id ? " active" : ""}`}
                onClick={() => setTabAndHash(id)}
              >
                <span className="admin-nav-icon">{icon}</span>
                <span className="admin-nav-label">{label}</span>
                {badge > 0 && <span className="admin-nav-badge">{badge}</span>}
              </button>
            ))}
          </nav>

          <div className="admin-sidebar-footer">
            <div className="admin-sidebar-user">
              <div className="admin-sidebar-avatar">{getInitials(adminEmail)}</div>
              <div className="admin-sidebar-user-meta">
                <span className="admin-sidebar-user-name">{adminEmail || "Admin"}</span>
                <span className="admin-sidebar-session-label">Active session</span>
              </div>
            </div>
            <button type="button" className="admin-sidebar-signout-btn" onClick={() => void logout()}>
              Sign out
            </button>
            <a className="admin-sidebar-back-link" href="#/">← Back to app</a>
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="admin-portal-main">
          <header className="admin-portal-topbar">
            <span className="admin-topbar-title">{TAB_LABELS[tab] || "Dashboard"}</span>
            <div className="admin-topbar-right">
              {adminEmail && <span className="admin-topbar-email">{adminEmail}</span>}
              <button type="button" className="admin-topbar-signout" onClick={() => void logout()}>Sign out</button>
            </div>
          </header>

          <div className="admin-portal-shell">
            {loadError ? <StatusBanner type="error" role="alert" style={{ marginBottom: 14 }}>{loadError}</StatusBanner> : null}
            {loading ? <StatusBanner type="info" style={{ marginBottom: 14 }}>Loading…</StatusBanner> : null}

            {/* ── Overview ── */}
            {tab === "overview" && (
              <div className="admin-portal-panel">
                <div className="admin-panel-header">
                  <div className="admin-panel-actions">
                    <button type="button" className="admin-action-btn" onClick={loadOverview} disabled={loading}>
                      Refresh overview
                    </button>
                    <button type="button" className="admin-action-btn" onClick={() => void runHealthChecks()} disabled={healthBusy} aria-live="polite">
                      {healthBusy ? "Running checks…" : "Run health checks"}
                    </button>
                  </div>
                </div>

                {/* Date range tabs — visual only */}
                <div className="admin-date-tabs">
                  {[["today", "Today"], ["week", "This Week"], ["month", "This Month"]].map(([val, lbl]) => (
                    <button
                      key={val}
                      type="button"
                      className={`admin-date-tab${overviewDateFilter === val ? " active" : ""}`}
                      onClick={() => setOverviewDateFilter(val)}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>

                <div className="admin-overview-layout">
                  <div className="admin-overview-main">
                    {basic ? (
                      <div className="admin-stat-cards">
                        <div className="admin-stat-card admin-stat-card--navy">
                          <div className="admin-stat-value">{basic.total_users ?? 0}</div>
                          <div className="admin-stat-label">Total Intakes</div>
                        </div>
                        <div className="admin-stat-card admin-stat-card--gold">
                          <div className="admin-stat-value">{basic.number_of_submissions ?? 0}</div>
                          <div className="admin-stat-label">Submissions</div>
                        </div>
                        <div className="admin-stat-card admin-stat-card--gray">
                          <div className="admin-stat-value admin-stat-value--sm">{basic.most_common_issue_type || "—"}</div>
                          <div className="admin-stat-label">Top Submission Issue</div>
                        </div>
                      </div>
                    ) : null}

                    {detailed?.overview ? (
                      <>
                        <div className="admin-portal-caption">Triage sessions</div>
                        <div className="admin-triage-cards">
                          {[
                            ["Sessions", detailed.overview.total_sessions ?? 0, false],
                            ["Completed", detailed.overview.completed_sessions ?? 0, false],
                            ["Completion %", `${detailed.overview.completion_rate_percent ?? 0}%`, false],
                            ["AI Used", detailed.overview.ai_used_sessions ?? 0, false],
                            ["Emergency Flagged", detailed.overview.emergency_sessions ?? 0, true],
                            ["Timeline Step Views", detailed.overview.timeline_step_views ?? 0, false],
                            ["Checklist Toggles", detailed.overview.timeline_checklist_toggles ?? 0, false],
                            ["Evidence Files", detailed.overview.total_evidence_files ?? 0, false],
                            ["Evidence AI Summary %", `${detailed.overview.ai_summary_rate_percent ?? 0}%`, false],
                            ["Tracked Deadlines", detailed.overview.total_deadlines ?? 0, false],
                            ["Overdue Deadlines", detailed.overview.overdue_deadlines ?? 0, false],
                          ].map(([label, value, isEmergency]) => (
                            <div key={label} className="admin-triage-card">
                              <div className={`admin-triage-value${isEmergency && Number(value) > 0 ? " admin-triage-value--emergency" : ""}`}>
                                {value}
                              </div>
                              <div className="admin-triage-label">{label}</div>
                            </div>
                          ))}
                        </div>

                        <div className="admin-portal-caption">Client Feedback</div>
                        <div className="admin-feedback-cards">
                          <div className="admin-feedback-card">
                            <div className="admin-triage-value">{detailed.overview.feedback_total ?? 0}</div>
                            <div className="admin-triage-label">Total Feedback</div>
                          </div>
                          <div className="admin-feedback-card">
                            <div className="admin-triage-value admin-feedback-value--helpful">
                              {detailed.overview.helpful_yes ?? 0}
                            </div>
                            <div className="admin-triage-label">
                              Helpful
                              {(detailed.overview.feedback_total ?? 0) > 0 && (
                                <span className="admin-feedback-pct admin-feedback-pct--helpful">
                                  {" "}{detailed.overview.helpful_rate_percent ?? 0}%
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="admin-feedback-card">
                            <div className="admin-triage-value admin-feedback-value--no">
                              {detailed.overview.helpful_no ?? 0}
                            </div>
                            <div className="admin-triage-label">
                              Not Helpful
                              {(detailed.overview.feedback_total ?? 0) > 0 && (
                                <span className="admin-feedback-pct admin-feedback-pct--no">
                                  {" "}{detailed.overview.helpful_no && detailed.overview.feedback_total
                                    ? `${Math.round((detailed.overview.helpful_no / detailed.overview.feedback_total) * 1000) / 10}%`
                                    : "0%"}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="admin-feedback-card">
                            <div className="admin-triage-value admin-feedback-value--date">
                              {detailed.overview.most_recent_feedback_date
                                ? new Date(detailed.overview.most_recent_feedback_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                : "—"}
                            </div>
                            <div className="admin-triage-label">Most Recent</div>
                          </div>
                        </div>

                        <div className="admin-feedback-comments-card">
                          <div className="admin-portal-caption" style={{ marginBottom: "12px" }}>Recent Feedback Comments</div>
                          {Array.isArray(detailed.feedback_comments) && detailed.feedback_comments.length > 0 ? (
                            <ul className="admin-feedback-comments-list">
                              {detailed.feedback_comments.map((item, i) => (
                                <li key={i} className="admin-feedback-comments-item">
                                  <span className="admin-feedback-comments-date">
                                    {item.created_at
                                      ? new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                      : ""}
                                  </span>
                                  <span className="admin-feedback-comments-text">{item.comment}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="admin-feedback-comments-empty">No feedback comments yet.</p>
                          )}
                        </div>

                        {Array.isArray(detailed.top_topics) && detailed.top_topics.length > 0 ? (
                          <>
                            <div className="admin-portal-caption">Top topics</div>
                            <div className="admin-portal-table-wrap">
                              <table className="admin-portal-table">
                                <thead><tr><th>Topic</th><th>Count</th></tr></thead>
                                <tbody>
                                  {detailed.top_topics.map((row) => (
                                    <tr key={String(row.topic)}>
                                      <td>{String(row.topic)}</td>
                                      <td>{row.count}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        ) : null}

                        {Array.isArray(detailed.level_breakdown) && detailed.level_breakdown.length > 0 ? (
                          <>
                            <div className="admin-portal-caption">Referral level</div>
                            <div className="admin-portal-table-wrap">
                              <table className="admin-portal-table">
                                <thead><tr><th>Level</th><th>Count</th></tr></thead>
                                <tbody>
                                  {detailed.level_breakdown.map((row) => (
                                    <tr key={String(row.level)}><td>{String(row.level)}</td><td>{row.count}</td></tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        ) : null}

                        {Array.isArray(detailed.recent_sessions) && detailed.recent_sessions.length > 0 ? (
                          <>
                            <div className="admin-portal-caption">Recent triage sessions</div>
                            <div className="admin-portal-table-wrap">
                              <table className="admin-portal-table">
                                <thead><tr><th>Intake</th><th>Topic</th><th>ZIP</th><th>Done</th></tr></thead>
                                <tbody>
                                  {detailed.recent_sessions.map((row) => (
                                    <tr key={String(row.intake_id)}>
                                      <td title={row.intake_id}>{String(row.intake_id).slice(0, 10)}…</td>
                                      <td>{row.topic ?? "—"}</td>
                                      <td>{row.zip_code ?? "—"}</td>
                                      <td>{row.completed ? "Yes" : "No"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        ) : null}
                      </>
                    ) : null}

                    {healthChecks ? (
                      <>
                        <div className="admin-portal-caption">Regression health checks</div>
                        <div className="admin-portal-subcaption">
                          {healthChecks.ok ? "All critical checks passed." : `${healthChecks.failed_checks || 0} failed checks, ${healthChecks.warn_checks || 0} warnings.`}
                        </div>
                        <div className="admin-portal-table-wrap">
                          <table className="admin-portal-table">
                            <thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead>
                            <tbody>
                              {(Array.isArray(healthChecks.checks) ? healthChecks.checks : []).map((row, idx) => (
                                <tr key={`${row.name}-${idx}`}>
                                  <td>{row.name || "—"}</td>
                                  <td>{String(row.status || "").toUpperCase() || "—"}</td>
                                  <td>{row.detail || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : null}
                  </div>

                  {/* Right column: Recent Activity + Issue Breakdown */}
                  <div className="admin-overview-side">
                    {intakes.length > 0 && (
                      <div className="admin-side-card">
                        <h3 className="admin-side-card-title">Recent Activity</h3>
                        {intakes.slice(0, 5).map((r) => {
                          const name = [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email || "—";
                          const issue = Array.isArray(r.issues) && r.issues[0] ? r.issues[0] : r.issue;
                          return (
                            <div key={r.id} className="admin-activity-item">
                              <div className="admin-activity-name">{name}</div>
                              {issue && issue !== "—" && <span className="admin-activity-badge">{issue}</span>}
                              <div className="admin-activity-time">{formatTimestamp(r.created_at)}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {detailed?.top_topics && detailed.top_topics.length > 0 && (
                      <div className="admin-side-card" style={{ marginTop: 16 }}>
                        <h3 className="admin-side-card-title">Top Legal Issue Breakdown</h3>
                        {(() => {
                          const maxCount = Math.max(...detailed.top_topics.map((t) => t.count), 1);
                          return detailed.top_topics.map((topic) => (
                            <div key={String(topic.topic)} className="admin-chart-row">
                              <span className="admin-chart-label">{humanizeToken(String(topic.topic))}</span>
                              <div className="admin-chart-track">
                                <div className="admin-chart-fill" style={{ width: `${Math.round((topic.count / maxCount) * 100)}%` }} />
                              </div>
                              <span className="admin-chart-count">{topic.count}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Intakes ── */}
            {tab === "intakes" && renderIntakesTable(filteredIntakes, true, false)}

            {/* ── Submissions ── */}
            {tab === "submissions" && (
              <div className="admin-portal-panel">
                <div className="admin-panel-header">
                  <div className="admin-panel-actions">
                    <button type="button" className="admin-action-btn" onClick={loadSubmissions} disabled={loading}>
                      Refresh submissions
                    </button>
                    <button type="button" className="admin-action-btn" onClick={() => void createTestSubmission()} disabled={loading}>
                      Add test submission
                    </button>
                  </div>
                </div>

                <div className="admin-filter-row">
                  <input
                    type="search"
                    className="admin-filter-search"
                    placeholder="Search by name or email…"
                    value={submissionsSearch}
                    onChange={(e) => setSubmissionsSearch(e.target.value)}
                  />
                </div>

                <div className="admin-portal-table-wrap">
                  <table className="admin-portal-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>ZIP</th>
                        <th>Issue</th>
                        <th>Message</th>
                        <th>When</th>
                        <th>Read</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSubmissions.length === 0 && !loading ? (
                        <tr>
                          <td colSpan={7} className="admin-portal-empty-cell">
                            <div className="admin-submissions-empty">
                              <div className="admin-submissions-empty-icon">✉</div>
                              <div className="admin-submissions-empty-heading">No submissions yet</div>
                              <div className="admin-submissions-empty-text">
                                Submissions will appear here when clients complete the contact form.
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredSubmissions.map((row) => {
                          const msg = String(row.message || "").trim();
                          const short = msg.length > 120 ? `${msg.slice(0, 120)}…` : msg || "—";
                          const isRead = !!submissionsReadMap[row.id];
                          return (
                            <tr
                              key={row.id}
                              className={`admin-table-row-clickable${isRead ? " admin-row-read" : ""}`}
                              onClick={(e) => {
                                if (e.target.closest("button")) return;
                                setSubmissionsDrawer(row);
                              }}
                            >
                              <td>{row.name ?? "—"}</td>
                              <td>{row.email ?? "—"}</td>
                              <td>{row.zip_code ?? "—"}</td>
                              <td>{row.issue_type ?? "—"}</td>
                              <td title={msg || undefined}>{short}</td>
                              <td>{formatTimestamp(row.timestamp)}</td>
                              <td>
                                <button
                                  type="button"
                                  className="admin-read-toggle"
                                  onClick={(e) => { e.stopPropagation(); toggleSubmissionRead(row.id); }}
                                  title={isRead ? "Mark as unread" : "Mark as read"}
                                >
                                  {isRead ? <CheckSquare size={16} className="admin-read-icon-checked" /> : <Square size={16} className="admin-read-icon" />}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Export CSV ── */}
            {tab === "export" && (
              <div className="admin-portal-panel">
                <div className="admin-portal-subcaption">
                  Download intake accounts with triage topic, admin status, and related columns (CSV).
                </div>

                {/* Filter UI */}
                <div className="admin-export-filters">
                  <div className="admin-export-filter-row">
                    <div className="admin-export-filter-group">
                      <label className="admin-export-label">From</label>
                      <input
                        type="date"
                        className="admin-export-date-input"
                        value={exportDateFrom}
                        onChange={(e) => setExportDateFrom(e.target.value)}
                      />
                    </div>
                    <div className="admin-export-filter-group">
                      <label className="admin-export-label">To</label>
                      <input
                        type="date"
                        className="admin-export-date-input"
                        value={exportDateTo}
                        onChange={(e) => setExportDateTo(e.target.value)}
                      />
                    </div>
                    <div className="admin-export-filter-group">
                      <label className="admin-export-label">Issue type</label>
                      <select className="admin-export-select" value={exportIssueFilter} onChange={(e) => setExportIssueFilter(e.target.value)}>
                        <option value="all">All Issues</option>
                        <option value="housing">Housing</option>
                        <option value="divorce">Divorce</option>
                        <option value="child_custody">Child Custody</option>
                        <option value="child_support">Child Support</option>
                        <option value="education">Education</option>
                        <option value="general">General Legal</option>
                      </select>
                    </div>
                    <div className="admin-export-filter-group">
                      <label className="admin-export-label">Status</label>
                      <select className="admin-export-select" value={exportStatusFilterVal} onChange={(e) => setExportStatusFilterVal(e.target.value)}>
                        <option value="all">All</option>
                        <option value="new">New</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="flagged">Flagged</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="admin-panel-actions" style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    className="admin-action-btn"
                    onClick={() => { void downloadCsv(); setLastExportedTime(new Date()); }}
                  >
                    Download intakes.csv
                  </button>
                </div>

                {lastExportedTime && (
                  <div className="admin-last-exported">
                    Last exported: {lastExportedTime.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                )}
                {!lastExportedTime && (
                  <div className="admin-last-exported">Last exported: —</div>
                )}
              </div>
            )}

            {/* ── Emergency Flagged ── */}
            {tab === "emergency" && renderIntakesTable(filteredIntakes, false, true)}

            {/* ── Callback Requests ── */}
            {tab === "callbacks" && (
              <div className="admin-portal-panel">
                <div className="admin-portal-panel-header">
                  <h2 className="admin-portal-panel-title">Callback Requests</h2>
                  <span className="admin-portal-panel-count">{callbackIntakes.length} total</span>
                </div>

                {callbackIntakes.length === 0 ? (
                  <div className="admin-callbacks-empty">
                    <Phone size={40} className="admin-callbacks-empty-icon" aria-hidden />
                    <p>No callback requests yet.</p>
                  </div>
                ) : (
                  <div className="admin-portal-table-wrap">
                    <table className="admin-portal-table admin-callbacks-table">
                      <thead>
                        <tr>
                          <th>Client Name</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th>Preferred Time</th>
                          <th>Issue Type</th>
                          <th>Risk Score</th>
                          <th>Date Requested</th>
                          <th>Status</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {callbackIntakes.map((row) => {
                          const name = [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email || "—";
                          const issue = (Array.isArray(row.issues) && row.issues[0]) ? row.issues[0] : (row.issue || "—");
                          const isCalled = (row.callback_status || "pending") === "called";
                          const tel = phoneTelHref(row.callback_phone);
                          return (
                            <tr key={row.id}>
                              <td className="admin-callbacks-name">{name}</td>
                              <td>{row.email || "—"}</td>
                              <td>
                                {row.callback_phone
                                  ? tel
                                    ? <a href={tel} className="admin-callbacks-phone-link">{formatPhoneDigits(row.callback_phone)}</a>
                                    : formatPhoneDigits(row.callback_phone)
                                  : "—"}
                              </td>
                              <td>{row.callback_preferred_time || "—"}</td>
                              <td>{humanizeToken(issue)}</td>
                              <td>{row.risk_score != null ? `${row.risk_score}/100` : "—"}</td>
                              <td className="admin-callbacks-date">
                                {row.callback_created_at
                                  ? new Date(row.callback_created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                  : "—"}
                              </td>
                              <td>
                                {isCalled
                                  ? <span className="admin-callbacks-badge admin-callbacks-badge--called">Called ✓</span>
                                  : <span className="admin-callbacks-badge admin-callbacks-badge--pending">Pending</span>}
                              </td>
                              <td>
                                {!isCalled && (
                                  <button
                                    type="button"
                                    className="admin-callbacks-mark-btn"
                                    disabled={!!markCalledBusy[row.id]}
                                    onClick={() => markCallbackCalled(row.id)}
                                  >
                                    {markCalledBusy[row.id] ? "Saving…" : "Mark as Called"}
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── Intake row drawer ── */}
      {intakeDrawer && (
        <div className="admin-drawer-backdrop" onClick={() => setIntakeDrawer(null)}>
          <div className="admin-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="admin-drawer-header">
              <h3 className="admin-drawer-title">Client Details</h3>
              <button type="button" className="admin-drawer-close" onClick={() => setIntakeDrawer(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="admin-drawer-body">
              <div className="admin-drawer-field">
                <span className="admin-drawer-field-label">Name</span>
                <span className="admin-drawer-field-value">
                  {[intakeDrawer.first_name, intakeDrawer.last_name].filter(Boolean).join(" ") || "—"}
                </span>
              </div>
              <div className="admin-drawer-field">
                <span className="admin-drawer-field-label">Email</span>
                <span className="admin-drawer-field-value">{intakeDrawer.email || "—"}</span>
              </div>
              <div className="admin-drawer-field">
                <span className="admin-drawer-field-label">Phone</span>
                <span className="admin-drawer-field-value">{formatPhoneDigits(intakeDrawer.phone)}</span>
              </div>
              <div className="admin-drawer-field">
                <span className="admin-drawer-field-label">ZIP</span>
                <span className="admin-drawer-field-value">{intakeDrawer.zip || "—"}</span>
              </div>
              <div className="admin-drawer-field">
                <span className="admin-drawer-field-label">Issue</span>
                <span className="admin-drawer-field-value">{intakeDrawer.issue || "—"}</span>
              </div>
              <div className="admin-drawer-field">
                <span className="admin-drawer-field-label">Logins</span>
                <span className="admin-drawer-field-value">{intakeDrawer.login_count ?? 0}</span>
              </div>
              <div className="admin-drawer-section">
                <label className="admin-drawer-field-label" htmlFor="drawer-note">Admin Notes</label>
                <textarea
                  id="drawer-note"
                  className="admin-drawer-textarea"
                  value={intakeDrawerNote}
                  onChange={(e) => setIntakeDrawerNote(e.target.value)}
                  placeholder="Add a note about this client…"
                  rows={4}
                />
                <button
                  type="button"
                  className="admin-action-btn"
                  style={{ marginTop: 8 }}
                  onClick={() => saveIntakeNote(intakeDrawer.email, intakeDrawerNote)}
                >
                  Save note
                </button>
              </div>
              {intakeDrawer.email && (
                <a
                  href={`mailto:${intakeDrawer.email}`}
                  className="admin-drawer-email-btn"
                >
                  <Mail size={14} style={{ marginRight: 6 }} />
                  Send email
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Submission row drawer ── */}
      {submissionsDrawer && (
        <div className="admin-drawer-backdrop" onClick={() => setSubmissionsDrawer(null)}>
          <div className="admin-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="admin-drawer-header">
              <h3 className="admin-drawer-title">Submission Details</h3>
              <button type="button" className="admin-drawer-close" onClick={() => setSubmissionsDrawer(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="admin-drawer-body">
              <div className="admin-drawer-field">
                <span className="admin-drawer-field-label">Name</span>
                <span className="admin-drawer-field-value">{submissionsDrawer.name || "—"}</span>
              </div>
              <div className="admin-drawer-field">
                <span className="admin-drawer-field-label">Email</span>
                <span className="admin-drawer-field-value">{submissionsDrawer.email || "—"}</span>
              </div>
              <div className="admin-drawer-field">
                <span className="admin-drawer-field-label">ZIP</span>
                <span className="admin-drawer-field-value">{submissionsDrawer.zip_code || "—"}</span>
              </div>
              <div className="admin-drawer-field">
                <span className="admin-drawer-field-label">Issue</span>
                <span className="admin-drawer-field-value">{submissionsDrawer.issue_type || "—"}</span>
              </div>
              <div className="admin-drawer-field">
                <span className="admin-drawer-field-label">When</span>
                <span className="admin-drawer-field-value">{formatTimestamp(submissionsDrawer.timestamp)}</span>
              </div>
              <div className="admin-drawer-section">
                <span className="admin-drawer-field-label">Message</span>
                <div className="admin-drawer-message">{submissionsDrawer.message || "—"}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Status change modal ── */}
      {statusDraft ? (
        <div className="admin-portal-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !modalBusy) closeStatusModal(); }}>
          <div className="admin-portal-modal" role="dialog" aria-modal="true" aria-labelledby="admin-status-title">
            <h2 id="admin-status-title">Update case status</h2>
            <p>
              Set status to <strong>{statusDraft.nextStatus}</strong> for{" "}
              <strong>{statusDraft.label}</strong> ({statusDraft.email}).
            </p>
            {(statusDraft.nextStatus === "accepted" || statusDraft.nextStatus === "rejected") ? (
              <>
                <label className="admin-portal-check">
                  <input type="checkbox" checked={notifyUser} onChange={(e) => setNotifyUser(e.target.checked)} disabled={modalBusy} />
                  <span>Send notification email to this address</span>
                </label>
                <label htmlFor="admin-status-note">Optional note (included in the notification email)</label>
                <textarea id="admin-status-note" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} disabled={modalBusy} maxLength={4000} placeholder="e.g. next steps or reason for the decision" />
              </>
            ) : (
              <p>No email is sent for Pending. You can still use &quot;Compose…&quot; on the row to message the user.</p>
            )}
            <div className="admin-portal-modal-actions">
              <button type="button" className="admin-portal-btn" onClick={closeStatusModal} disabled={modalBusy}>Cancel</button>
              <button type="button" className="admin-portal-btn admin-portal-btn-primary" onClick={() => void confirmStatusModal()} disabled={modalBusy}>
                {modalBusy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Activity modal ── */}
      {activityModal ? (
        <div className="admin-portal-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setActivityModal(null); }}>
          <div className="admin-portal-modal admin-portal-modal--wide" role="dialog" aria-modal="true" aria-labelledby="admin-activity-title">
            <h2 id="admin-activity-title">Navigator activity</h2>
            <p className="admin-portal-modal-meta">
              {[activityModal.first_name, activityModal.last_name].filter(Boolean).join(" ").trim() || activityModal.email}{" "}
              · {activityModal.email}
            </p>
            {activityError ? <StatusBanner type="error" role="alert" style={{ marginBottom: 12 }}>{activityError}</StatusBanner> : null}
            {activityBusy ? <StatusBanner type="info">Loading…</StatusBanner> : (
              <div className="admin-portal-table-wrap admin-portal-table-wrap-modal">
                <div className="admin-portal-activity-filters">
                  <label htmlFor="admin-activity-issue-filter">Issue:</label>
                  <select id="admin-activity-issue-filter" value={activityIssueFilter} onChange={(e) => setActivityIssueFilter(e.target.value)}>
                    <option value="all">All selected issues</option>
                    {activityIssueOptions.map((item) => <option key={item.issue} value={item.issue}>{item.label}</option>)}
                  </select>
                </div>
                <table className="admin-portal-table">
                  <thead><tr><th>Time</th><th>Event</th><th>Detail</th></tr></thead>
                  <tbody>
                    {filteredActivityEvents.length === 0 ? (
                      <tr><td colSpan={3} className="admin-portal-empty-cell">No events for the selected issue.</td></tr>
                    ) : (
                      filteredActivityEvents.map((ev, idx) => {
                        const v = formatActivityDetail(ev.event_type, ev.event_value);
                        const short = v.length > 280 ? `${v.slice(0, 280)}…` : v;
                        return (
                          <tr key={`${ev.created_at}-${idx}`}>
                            <td className="admin-portal-cell-date">{formatTimestamp(ev.created_at)}</td>
                            <td>{formatActivityEventName(ev.event_type)}</td>
                            <td style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{short || "—"}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <div className="admin-portal-modal-actions">
              <button type="button" className="admin-portal-btn admin-portal-btn-primary" onClick={() => setActivityModal(null)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Evidence modal ── */}
      {evidenceModal ? (
        <div className="admin-portal-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setEvidenceModal(null); }}>
          <div className="admin-portal-modal admin-portal-modal--wide" role="dialog" aria-modal="true" aria-labelledby="admin-evidence-title">
            <h2 id="admin-evidence-title">Evidence organizer</h2>
            <p className="admin-portal-modal-meta">
              {[evidenceModal.first_name, evidenceModal.last_name].filter(Boolean).join(" ").trim() || evidenceModal.email}{" "}
              · {evidenceModal.email}
            </p>
            {evidenceError ? <StatusBanner type="error" role="alert" style={{ marginBottom: 12 }}>{evidenceError}</StatusBanner> : null}
            {evidenceBusy ? <StatusBanner type="info">Loading…</StatusBanner> : (
              <>
                <div className="admin-portal-caption">Uploaded files</div>
                <div className="admin-portal-table-wrap admin-portal-table-wrap-modal-sm">
                  <table className="admin-portal-table">
                    <thead><tr><th>When</th><th>File</th><th>Summary</th><th>Source</th></tr></thead>
                    <tbody>
                      {evidenceFiles.length === 0 ? (
                        <tr><td colSpan={4} className="admin-portal-empty-cell">No uploaded evidence files yet.</td></tr>
                      ) : (
                        evidenceFiles.map((f) => (
                          <tr key={String(f.id)}>
                            <td className="admin-portal-cell-date">{formatTimestamp(f.uploaded_at)}</td>
                            <td>{f.name || "—"}</td>
                            <td style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{String(f.summary || "—").slice(0, 220)}</td>
                            <td>
                              <button type="button" className="admin-portal-btn admin-portal-btn-compact" onClick={() => void downloadEvidenceFile(f.id, f.name)}>
                                Download
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="admin-portal-caption">Key facts timeline</div>
                <div className="admin-portal-table-wrap admin-portal-table-wrap-modal-sm">
                  <table className="admin-portal-table">
                    <thead><tr><th>Date</th><th>Fact</th><th>Source</th></tr></thead>
                    <tbody>
                      {evidenceTimeline.length === 0 ? (
                        <tr><td colSpan={3} className="admin-portal-empty-cell">No extracted timeline facts yet.</td></tr>
                      ) : (
                        evidenceTimeline.map((item, idx) => (
                          <tr key={`${item.source}-${item.date}-${idx}`}>
                            <td>{item.date || "—"}</td>
                            <td style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{item.fact || "—"}</td>
                            <td>
                              <button type="button" className="admin-portal-btn admin-portal-btn-compact" onClick={() => {
                                const match = evidenceFiles.find((f) => (f.name || "") === (item.source || ""));
                                if (match) void downloadEvidenceFile(match.id, match.name);
                              }}>
                                {item.source || "Source"}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="admin-portal-subcaption">Safety notice: AI summaries/timeline are assistive only. Verify all facts with original files.</p>
              </>
            )}
            <div className="admin-portal-modal-actions">
              <button type="button" className="admin-portal-btn admin-portal-btn-primary" onClick={() => setEvidenceModal(null)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Summary modal ── */}
      {summaryModal ? (
        <div className="admin-portal-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSummaryModal(null); }}>
          <div className="admin-portal-modal" role="dialog" aria-modal="true" aria-labelledby="admin-summary-title">
            <h2 id="admin-summary-title">Client summary</h2>
            <p className="admin-portal-modal-meta">{summaryModal.first_name} {summaryModal.last_name} · {summaryModal.email}</p>
            <div className="admin-portal-summary-body" tabIndex={0}>{String(summaryModal.problem_summary || "").trim() || "—"}</div>
            <div className="admin-portal-modal-actions">
              <button type="button" className="admin-portal-btn admin-portal-btn-primary" onClick={() => setSummaryModal(null)}>Close</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Compose email modal ── */}
      {emailModal ? (
        <div className="admin-portal-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !modalBusy) closeEmailModal(); }}>
          <div className="admin-portal-modal" role="dialog" aria-modal="true" aria-labelledby="admin-email-title">
            <h2 id="admin-email-title">Email user</h2>
            <p>Send a message to <strong>{emailModal.email}</strong> ({emailModal.label}). Uses the same email provider as magic-link sign-in (Resend or SMTP).</p>
            <label htmlFor="admin-compose-subject">Subject</label>
            <input id="admin-compose-subject" type="text" value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} disabled={modalBusy} maxLength={240} />
            <label htmlFor="admin-compose-body">Message</label>
            <textarea id="admin-compose-body" value={composeBody} onChange={(e) => setComposeBody(e.target.value)} disabled={modalBusy} maxLength={8000} />
            <div className="admin-portal-modal-actions">
              <button type="button" className="admin-portal-btn" onClick={closeEmailModal} disabled={modalBusy}>Cancel</button>
              <button type="button" className="admin-portal-btn admin-portal-btn-primary" onClick={() => void sendCustomEmail()} disabled={modalBusy}>
                {modalBusy ? "Sending…" : "Send email"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Create client modal ── */}
      {createModalOpen ? (
        <div className="admin-portal-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !modalBusy) closeCreateClientModal(); }}>
          <div className="admin-portal-modal" role="dialog" aria-modal="true" aria-labelledby="admin-create-title">
            <h2 id="admin-create-title">Add client</h2>
            <p>Creates a navigator account (same as the public registration flow). Status defaults to <strong>Accepted</strong> so the client can use email sign-in. Email must not already be in use.</p>
            <label htmlFor="admin-create-fn">First name</label>
            <input id="admin-create-fn" type="text" value={createFirst} onChange={(e) => setCreateFirst(e.target.value)} disabled={modalBusy} autoComplete="given-name" />
            <label htmlFor="admin-create-ln">Last name</label>
            <input id="admin-create-ln" type="text" value={createLast} onChange={(e) => setCreateLast(e.target.value)} disabled={modalBusy} autoComplete="family-name" />
            <label htmlFor="admin-create-em">Email</label>
            <input id="admin-create-em" type="email" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} disabled={modalBusy} autoComplete="email" />
            <label htmlFor="admin-create-ph">Phone (10+ digits)</label>
            <input id="admin-create-ph" type="tel" value={createPhone} onChange={(e) => setCreatePhone(e.target.value)} disabled={modalBusy} autoComplete="tel" />
            <label htmlFor="admin-create-zip">ZIP (5 digits)</label>
            <input id="admin-create-zip" type="text" inputMode="numeric" maxLength={5} value={createZip} onChange={(e) => setCreateZip(e.target.value.replace(/\D/g, "").slice(0, 5))} disabled={modalBusy} autoComplete="postal-code" />
            <label htmlFor="admin-create-lang">Language</label>
            <select id="admin-create-lang" value={createLang} onChange={(e) => setCreateLang(e.target.value)} disabled={modalBusy}>
              <option value="en">English</option>
              <option value="es">Spanish</option>
            </select>
            <div className="admin-portal-modal-actions">
              <button type="button" className="admin-portal-btn" onClick={closeCreateClientModal} disabled={modalBusy}>Cancel</button>
              <button type="button" className="admin-portal-btn admin-portal-btn-primary" onClick={() => void submitCreateClient()} disabled={modalBusy}>
                {modalBusy ? "Creating…" : "Create account"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Delete client modal ── */}
      {deleteDraft ? (
        <div className="admin-portal-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !deleteBusy) closeDeleteIntakeModal(); }}>
          <div className="admin-portal-modal" role="dialog" aria-modal="true" aria-labelledby="admin-delete-title">
            <h2 id="admin-delete-title">Delete client</h2>
            <p>Permanently remove <strong>{deleteDraft.label}</strong> ({deleteDraft.email})? This deletes their intake, triage progress, events, and unused magic-link tokens for that email. This cannot be undone.</p>
            <div className="admin-portal-modal-actions">
              <button type="button" className="admin-portal-btn" onClick={closeDeleteIntakeModal} disabled={deleteBusy}>Cancel</button>
              <button type="button" className="admin-portal-btn admin-portal-btn-danger" onClick={() => void confirmDeleteIntake()} disabled={deleteBusy}>
                {deleteBusy ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
