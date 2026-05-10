import React, { useMemo } from "react";
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
} from "lucide-react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import calLogo from "../assets/cal_logo.png";

const QUERY_HISTORY_KEY = "cal_ai_query_history_v1";

const NAV_ITEMS = [
  { id: "home", label: "Home", icon: Home },
  { id: "chat", label: "My Cases", icon: FolderOpen },
  { id: "files", label: "Documents", icon: FileText },
  { id: "resources", label: "Resources", icon: BookOpen },
  { id: "settings", label: "Settings", icon: Settings },
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
  onSignOut,
}) {
  const recentSessions = useMemo(getRecentSessions, []);
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const initial = firstName && lastName
    ? (firstName.charAt(0) + lastName.charAt(0)).toUpperCase()
    : firstName
      ? firstName.charAt(0).toUpperCase()
      : "U";

  return (
    <aside
      className="w-64 shrink-0 flex flex-col h-full"
      style={{ background: SIDEBAR_BG, borderRight: "1px solid rgba(255,255,255,0.08)" }}
      aria-label="Main navigation"
    >
      {/* Brand */}
      <div
        className="flex items-center px-4 h-14 shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <img
          src={calLogo}
          alt="CAL logo"
          style={{ height: 40, width: "auto", objectFit: "contain", mixBlendMode: "screen" }}
        />
      </div>

      <ScrollArea className="flex-1">
        <nav className="py-3" aria-label="Sidebar">
          {/* New Case shortcut — only in non-home views */}
          {activeSection !== "home" && (
            <div className="px-3 mb-3 mt-1">
              <Button
                onClick={onStartChat}
                className="w-full justify-start gap-2 rounded-lg"
                size="sm"
                style={{ background: GOLD, color: "#1A1A1A", fontWeight: 700, border: "none" }}
              >
                <Plus className="w-4 h-4" aria-hidden />
                New Case
              </Button>
            </div>
          )}

          {/* Main nav */}
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate?.(id)}
                className="w-full flex items-center gap-2.5 py-2 text-sm font-medium transition-all"
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
                Recent
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

      {/* Footer */}
      <div className="p-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        {activeSection === "home" ? (
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ background: SIDEBAR_BG, color: "#ffffff", border: `1px solid ${GOLD}` }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(201,168,76,0.10)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = SIDEBAR_BG)}
          >
            <Phone className="w-4 h-4" aria-hidden />
            Guest Support
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
              className="transition-colors p-1 rounded opacity-0 group-hover:opacity-100"
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
      </div>
    </aside>
  );
}
