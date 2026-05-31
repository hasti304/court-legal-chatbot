import React, { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Home,
  FolderOpen,
  FileText,
  Settings,
  Plus,
  LogOut,
  Hash,
  BookOpen,
  Phone,
  Mail,
  X,
  Bell,
} from "lucide-react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import calLogo from "../assets/cal_logo.png";
import EmergencyButton from "./EmergencyButton";

const QUERY_HISTORY_KEY = "cal_ai_query_history_v1";
const CASES_KEY = "cal_cases_history_v1";

function getPreviousCasesCount() {
  try {
    const cases = JSON.parse(localStorage.getItem(CASES_KEY) || "[]");
    return Array.isArray(cases) ? cases.length : 0;
  } catch {
    return 0;
  }
}

const NAV_ITEM_DEFS = [
  { id: "home", labelKey: "nav.home", icon: Home },
  { id: "chat", labelKey: "nav.cases", icon: FolderOpen },
  { id: "files", labelKey: "nav.documents", icon: FileText },
  { id: "resources", labelKey: "nav.resources", icon: BookOpen },
  { id: "settings", labelKey: "nav.settings", icon: Settings },
];

const SIDEBAR_BG = "#1B2A4A";
const GOLD = "#C9A84C";

function getRecentSessions() {
  try {
    const history = JSON.parse(localStorage.getItem(QUERY_HISTORY_KEY) || "[]");
    const seen = new Set();
    return history
      .filter((h) => {
        if (seen.has(h.topic)) return false;
        seen.add(h.topic);
        return true;
      })
      .slice(0, 3);
  } catch {
    return [];
  }
}

export default function AppSidebar({
  activeSection,
  activeTopic,
  firstName,
  lastName,
  intakeSaved,
  onNavigate,
  onTopicSelect,
  onStartChat,
  onStartAIAssistant,
  onSignOut,
  onCloseMobile,
  notifications = [],
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
}) {
  const { t } = useTranslation();
  const recentSessions = useMemo(getRecentSessions, []);
  const [showSupport, setShowSupport] = useState(false);
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [previousCasesCount, setPreviousCasesCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const bellRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleNewCaseClick = () => {
    setPreviousCasesCount(getPreviousCasesCount());
    setShowNewCaseModal(true);
  };
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const initial = firstName && lastName
    ? (firstName.charAt(0) + lastName.charAt(0)).toUpperCase()
    : firstName
      ? firstName.charAt(0).toUpperCase()
      : "U";

  return (
    <>
    <aside
      className="w-full max-w-full shrink-0 flex flex-col h-full"
      style={{ background: SIDEBAR_BG, borderRight: "1px solid rgba(255,255,255,0.08)" }}
      aria-label="Main navigation"
    >
      {/* Brand */}
      <div
        className="flex items-center justify-between px-4 h-14 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <img
          src={calLogo}
          alt="CAL logo"
          style={{ height: 40, width: "auto", objectFit: "contain", mixBlendMode: "screen" }}
        />
        {onCloseMobile ? (
          <button
            type="button"
            onClick={onCloseMobile}
            className="md:hidden p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label={t("nav.closeMenu")}
          >
            <X className="w-5 h-5" aria-hidden />
          </button>
        ) : null}
      </div>

      <ScrollArea className="flex-1">
        <nav className="py-3" aria-label="Sidebar">
          {/* New Case shortcut — only in non-home views */}
          {activeSection !== "home" && (
            <div className="px-3 mb-3 mt-1">
              <Button
                onClick={handleNewCaseClick}
                className="w-full justify-start gap-2 rounded-lg"
                size="sm"
                style={{ background: GOLD, color: "#1A1A1A", fontWeight: 700, border: "none" }}
              >
                <Plus className="w-4 h-4" aria-hidden />
                {t("nav.newCase")}
              </Button>
            </div>
          )}

          {/* Main nav */}
          {NAV_ITEM_DEFS.map(({ id, labelKey, icon: Icon }) => {
            const label = t(labelKey);
            const isActive = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate?.(id)}
                className="w-full flex items-center gap-2.5 py-2.5 min-h-[44px] text-sm font-medium transition-all"
                style={{
                  paddingLeft: isActive ? 9 : 12,
                  paddingRight: 12,
                  borderLeft: isActive ? `3px solid ${GOLD}` : "3px solid transparent",
                  background: isActive ? "rgba(201,168,76,0.12)" : "transparent",
                  color: isActive ? "#ffffff" : "rgba(255,255,255,0.70)",
                }}
                aria-current={isActive ? "page" : undefined}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                    e.currentTarget.style.color = "#ffffff";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "rgba(255,255,255,0.70)";
                  }
                }}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden />
                {label}
              </button>
            );
          })}

          {/* Recent sessions */}
          {recentSessions.length > 0 && (
            <>
              <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "10px 14px" }} />
              <p
                className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "rgba(255,255,255,0.38)" }}
              >
                {t("nav.recent")}
              </p>
              {recentSessions.map((session) => (
                <button
                  key={session.topic}
                  type="button"
                  onClick={() => onTopicSelect?.(session.topic)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-all"
                  style={{ color: "rgba(255,255,255,0.55)", background: "transparent" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                    e.currentTarget.style.color = "#ffffff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "rgba(255,255,255,0.55)";
                  }}
                >
                  <Hash className="w-3.5 h-3.5 shrink-0" aria-hidden />
                  {String(session.topic || "").replace(/_/g, " ")}
                </button>
              ))}
            </>
          )}
        </nav>
      </ScrollArea>

      {/* Notification bell */}
      <div className="px-3 pb-2 shrink-0 relative" ref={bellRef}>
        <button
          type="button"
          onClick={() => setShowNotifications((v) => !v)}
          className="relative w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
          style={{ color: "rgba(255,255,255,0.70)", background: "transparent" }}
          aria-label="Notifications"
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#ffffff"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.70)"; }}
        >
          <Bell className="w-4 h-4 shrink-0" aria-hidden />
          <span>Notifications</span>
          {unreadCount > 0 && (
            <span
              className="ml-auto flex items-center justify-center rounded-full text-[10px] font-bold leading-none"
              style={{
                background: "#ef4444",
                color: "#ffffff",
                minWidth: 18,
                height: 18,
                padding: "0 5px",
              }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {showNotifications && (
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 49 }}
              onClick={() => setShowNotifications(false)}
            />
            <div
              style={{
                position: "fixed",
                left: 240,
                bottom: 80,
                width: 340,
                maxHeight: 420,
                background: "#ffffff",
                borderRadius: 12,
                boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
                zIndex: 50,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Panel header */}
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #e5e7eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 14, color: "#1B2A4A" }}>
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => { onMarkAllNotificationsRead?.(); }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: GOLD,
                      fontWeight: 600,
                      fontSize: 12,
                      padding: 0,
                    }}
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              {/* Notification list */}
              <div style={{ overflowY: "auto", flex: 1 }}>
                {notifications.length === 0 ? (
                  <div
                    style={{
                      padding: "32px 16px",
                      textAlign: "center",
                      color: "#9CA3AF",
                      fontSize: 13,
                    }}
                  >
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        onMarkNotificationRead?.(n.id);
                        setShowNotifications(false);
                        onNavigate?.("chat");
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "12px 16px",
                        borderBottom: "1px solid #f3f4f6",
                        background: n.is_read ? "transparent" : "rgba(201,168,76,0.08)",
                        cursor: "pointer",
                        border: "none",
                        borderBottomColor: "#f3f4f6",
                        borderBottomWidth: 1,
                        borderBottomStyle: "solid",
                      }}
                    >
                      {!n.is_read && (
                        <span
                          style={{
                            display: "inline-block",
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: GOLD,
                            marginRight: 8,
                            verticalAlign: "middle",
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <span
                        style={{
                          fontSize: 13,
                          color: "#1B2A4A",
                          fontWeight: n.is_read ? 400 : 600,
                          lineHeight: 1.5,
                          display: "inline",
                        }}
                      >
                        {n.message}
                      </span>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#9CA3AF",
                          marginTop: 4,
                        }}
                      >
                        {n.created_at
                          ? new Date(n.created_at).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : ""}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div
        className="p-3 shrink-0 flex flex-col gap-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
      >
        {activeSection === "home" ? (
          <button
            type="button"
            onClick={() => setShowSupport(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ background: SIDEBAR_BG, color: "#ffffff", border: `1px solid ${GOLD}` }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(201,168,76,0.10)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = SIDEBAR_BG)}
          >
            <Phone className="w-4 h-4" aria-hidden />
            {t("nav.guestSupport")}
          </button>
        ) : (
          <div
            className="flex items-center gap-2.5 px-2 py-2 rounded-xl transition-colors group cursor-default"
            style={{ background: "transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <Avatar className="w-8 h-8 shrink-0">
              <AvatarFallback
                className="text-xs font-bold"
                style={{ background: GOLD, color: "#1A1A1A" }}
              >
                {initial}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-none truncate" style={{ color: "#ffffff" }}>
                {fullName || "Guest"}
              </p>
              {intakeSaved ? (
                <p className="text-[10px] mt-0.5 font-medium" style={{ color: GOLD }}>
                  Active session
                </p>
              ) : fullName ? null : (
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 mt-0.5 h-auto leading-none font-medium"
                >
                  Guest
                </Badge>
              )}
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="transition-colors p-2 rounded min-h-[44px] min-w-[44px] flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100"
              style={{ color: "rgba(255,255,255,0.55)" }}
              aria-label="Sign out"
              title="Sign out"
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden />
            </button>
          </div>
        )}

        <EmergencyButton variant="sidebar" />
      </div>
    </aside>

    {showNewCaseModal && (
      <div
        style={{
          position: "fixed", inset: 0,
          background: "rgba(27,42,74,0.72)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, padding: 24,
        }}
        onClick={() => setShowNewCaseModal(false)}
      >
        <div
          style={{
            background: "#ffffff", borderRadius: 12,
            boxShadow: "0 8px 40px rgba(0,0,0,0.22)",
            padding: "36px 32px 28px",
            maxWidth: 420, width: "100%",
            position: "relative",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1B2A4A", margin: "0 0 14px" }}>
            Start a New Case
          </h2>

          {previousCasesCount > 0 ? (
            <>
              <p style={{ color: "#4B5563", fontSize: 14, lineHeight: 1.65, marginBottom: 28 }}>
                You have <strong>{previousCasesCount}</strong> previous consultation{previousCasesCount !== 1 ? "s" : ""}.
                Would you like to start fresh or review your existing cases?
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => { setShowNewCaseModal(false); onStartChat?.(); }}
                  style={{
                    background: GOLD, color: "#1A1A1A", fontWeight: 700,
                    borderRadius: 8, padding: "12px 0",
                    border: "none", cursor: "pointer", fontSize: 14, width: "100%",
                  }}
                >
                  Start New Consultation
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNewCaseModal(false); onNavigate?.("chat"); }}
                  style={{
                    background: "transparent", color: GOLD, fontWeight: 700,
                    borderRadius: 8, padding: "12px 0",
                    border: `2px solid ${GOLD}`, cursor: "pointer", fontSize: 14, width: "100%",
                  }}
                >
                  View My Cases
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ color: "#4B5563", fontSize: 14, lineHeight: 1.65, marginBottom: 28 }}>
                Start your free legal consultation. It takes about 3–5 minutes.
              </p>
              <button
                type="button"
                onClick={() => { setShowNewCaseModal(false); onStartChat?.(); }}
                style={{
                  background: GOLD, color: "#1A1A1A", fontWeight: 700,
                  borderRadius: 8, padding: "12px 0",
                  border: "none", cursor: "pointer", fontSize: 14, width: "100%",
                }}
              >
                Start Consultation
              </button>
            </>
          )}

          <div style={{ textAlign: "center", marginTop: 18 }}>
            <button
              type="button"
              onClick={() => setShowNewCaseModal(false)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "#9CA3AF", fontSize: 13, fontWeight: 500,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}

    {showSupport && (
      <div
        style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, padding: 24,
        }}
        onClick={() => setShowSupport(false)}
      >
        <div
          style={{
            background: "var(--cal-bg-card)", borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.20)",
            padding: 32, maxWidth: 440, width: "100%",
            position: "relative",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setShowSupport(false)}
            style={{
              position: "absolute", top: 16, right: 16,
              background: "none", border: "none", cursor: "pointer",
              color: "var(--cal-text-muted)", padding: 4,
            }}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--cal-text-primary)", marginBottom: 8, marginTop: 0 }}>
            Need Help?
          </h2>
          <p style={{ color: "var(--cal-text-muted)", fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
            Our staff is here to assist you with your legal questions.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
            <a
              href="tel:3128015918"
              style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--cal-text-primary)" }}
            >
              <Phone className="w-4 h-4 shrink-0" style={{ color: GOLD }} />
              <span style={{ fontSize: 15, fontWeight: 500 }}>(312) 801-5918</span>
            </a>
            <a
              href="mailto:intake@chicagoadvocatelegal.com"
              style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "var(--cal-text-primary)" }}
            >
              <Mail className="w-4 h-4 shrink-0" style={{ color: GOLD }} />
              <span style={{ fontSize: 15, fontWeight: 500 }}>intake@chicagoadvocatelegal.com</span>
            </a>
          </div>
          <a
            href="https://www.chicagoadvocatelegal.com/contact.html"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block", textAlign: "center",
              color: GOLD, fontWeight: 700, fontSize: 14,
              marginBottom: 12, textDecoration: "none",
            }}
          >
            Direct Intake Form
          </a>
          <button
            type="button"
            onClick={() => {
              setShowSupport(false);
              if (onStartAIAssistant) onStartAIAssistant();
              else if (onStartChat) onStartChat();
            }}
            style={{
              width: "100%", background: GOLD, color: "#1A1A1A",
              fontWeight: 700, borderRadius: 8, padding: "11px 0",
              border: "none", cursor: "pointer", fontSize: 14,
              marginBottom: 10,
            }}
          >
            Chat with AI Assistant
          </button>
          <button
            type="button"
            onClick={() => setShowSupport(false)}
            style={{
              width: "100%", background: "transparent",
              border: `1px solid ${GOLD}`, color: GOLD,
              fontWeight: 700, borderRadius: 8, padding: "11px 0",
              cursor: "pointer", fontSize: 14,
            }}
          >
            Close
          </button>
        </div>
      </div>
    )}
    </>
  );
}
