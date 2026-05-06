import React, { useState, useMemo } from "react";
import {
  Home,
  MessageSquare,
  FileText,
  Settings,
  Plus,
  LogOut,
  Hash,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Separator } from "./ui/separator";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import calLogo from "../assets/cal_logo.png";

const QUERY_HISTORY_KEY = "cal_ai_query_history_v1";

const LEGAL_TOPICS = [
  { id: "housing", label: "Housing" },
  { id: "divorce", label: "Divorce" },
  { id: "custody", label: "Child Custody" },
  { id: "child_support", label: "Child Support" },
  { id: "education", label: "Education" },
  { id: "general", label: "General Legal" },
];

const NAV_ITEMS = [
  { id: "home", label: "Dashboard", icon: Home },
  { id: "chat", label: "My Cases", icon: MessageSquare },
  { id: "files", label: "Documents", icon: FileText },
  { id: "resources", label: "Resources", icon: BookOpen },
  { id: "settings", label: "Settings", icon: Settings },
];

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
  intakeSaved,
  onNavigate,
  onTopicSelect,
  onStartChat,
  onSignOut,
}) {
  const [topicsOpen, setTopicsOpen] = useState(true);
  const recentSessions = useMemo(getRecentSessions, []);
  const initial = firstName ? firstName.charAt(0).toUpperCase() : "U";

  return (
    <aside
      className="w-64 shrink-0 flex flex-col border-r border-sidebar-border bg-sidebar h-full"
      aria-label="Main navigation"
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-sidebar-border shrink-0">
        <img src={calLogo} alt="" className="w-7 h-7 object-contain" aria-hidden="true" />
        <span className="font-bold text-sm tracking-tight" style={{ color: "#1a2d4a" }}>
          Court Legal AI
        </span>
      </div>

      <ScrollArea className="flex-1">
        <nav className="px-2 py-3 space-y-0.5" aria-label="Sidebar">
          {/* New Case CTA */}
          <Button
            onClick={onStartChat}
            className="w-full justify-start gap-2 rounded-xl mb-4 mt-1 shadow-sm"
            size="sm"
          >
            <Plus className="w-4 h-4" aria-hidden />
            New Case
          </Button>

          {/* Main nav */}
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate?.(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                activeSection === id
                  ? "bg-sidebar-accent text-sidebar-foreground font-semibold"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
              }`}
              aria-current={activeSection === id ? "page" : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" aria-hidden />
              {label}
            </button>
          ))}

          <Separator className="my-3 opacity-60" />

          {/* Legal areas section */}
          <button
            type="button"
            className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 hover:text-sidebar-foreground transition-colors rounded-lg"
            onClick={() => setTopicsOpen((v) => !v)}
            aria-expanded={topicsOpen}
          >
            <span>Legal Areas</span>
            <ChevronRight
              className={`w-3 h-3 transition-transform duration-200 ${topicsOpen ? "rotate-90" : ""}`}
              aria-hidden
            />
          </button>

          {topicsOpen &&
            LEGAL_TOPICS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => onTopicSelect?.(id)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-all ${
                  activeTopic === id
                    ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                    : "text-sidebar-foreground/55 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
              >
                <Hash className="w-3.5 h-3.5 shrink-0" aria-hidden />
                {label}
              </button>
            ))}

          {/* Recent sessions */}
          {recentSessions.length > 0 && (
            <>
              <Separator className="my-3 opacity-60" />
              <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                Recent
              </p>
              {recentSessions.map((session) => (
                <button
                  key={session.topic}
                  type="button"
                  onClick={() => onTopicSelect?.(session.topic)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-all"
                >
                  <Hash className="w-3.5 h-3.5 shrink-0" aria-hidden />
                  {String(session.topic || "").replace(/_/g, " ")}
                </button>
              ))}
            </>
          )}
        </nav>
      </ScrollArea>

      {/* User footer */}
      <div className="p-3 border-t border-sidebar-border shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-sidebar-accent/50 transition-colors group cursor-default">
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarFallback className="text-xs font-bold bg-primary text-primary-foreground">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground leading-none truncate">
              {firstName || "Guest"}
            </p>
            {intakeSaved ? (
              <p className="text-[10px] text-primary/70 mt-0.5 font-medium">Active session</p>
            ) : (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 mt-0.5 h-auto leading-none font-medium">
                Guest
              </Badge>
            )}
          </div>
          <button
            type="button"
            onClick={onSignOut}
            className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded opacity-0 group-hover:opacity-100"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </aside>
  );
}
