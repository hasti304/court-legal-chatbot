import React, { useMemo } from "react";
import "./ChatDashboard.css";

const QUERY_HISTORY_KEY = "cal_ai_query_history_v1";
const STORAGE_KEY = "cal_triage_session_v3";

const TOPIC_LABELS = {
  housing: "Housing",
  divorce: "Divorce",
  custody: "Child Custody",
  child_support: "Child Support",
  education: "Education",
  general: "General Legal",
};

function formatTimeAgo(ts) {
  if (!ts) return "";
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function getStoredTriageSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function ChatDashboard({ intakeSaved, intakeId, currentTopic, onNavigate }) {
  const aiHistory = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(QUERY_HISTORY_KEY) || "[]"); }
    catch { return []; }
  }, []);

  const triageSession = useMemo(getStoredTriageSession, []);

  const topicCounts = useMemo(() => {
    const c = {};
    aiHistory.forEach(h => { c[h.topic] = (c[h.topic] || 0) + 1; });
    if (triageSession?.conversationState?.topic) {
      const t = triageSession.conversationState.topic;
      c[t] = (c[t] || 0) + (triageSession.messages?.length || 0);
    }
    return c;
  }, [aiHistory, triageSession]);

  const maxCount = Math.max(1, ...Object.values(topicCounts));
  const triageComplete = triageSession?.conversationState?.step === "complete";
  const totalQueries = aiHistory.length + (triageSession?.messages?.filter(m => m.role === "user").length || 0);

  const riskAlerts = useMemo(() => {
    const recentSnippets = aiHistory.slice(0, 10).map(h => h.snippet.toLowerCase()).join(" ");
    const riskMap = {
      "Urgent housing issue detected": ["eviction", "lockout", "locked out", "no place to live", "homeless"],
      "Child safety concern flagged": ["child abuse", "custody emergency", "child in danger", "child safety"],
      "Court date may be approaching": ["court date", "hearing date", "filing deadline", "order of protection"],
    };
    return Object.entries(riskMap)
      .filter(([, kws]) => kws.some(k => recentSnippets.includes(k)))
      .map(([label]) => label);
  }, [aiHistory]);

  const stats = [
    {
      icon: "💬",
      value: totalQueries,
      label: "Total Queries",
      sub: "across all sessions",
    },
    {
      icon: "📁",
      value: intakeSaved && intakeId ? "Active" : "Guest",
      label: "Session Status",
      sub: intakeSaved && intakeId ? `ID: ${String(intakeId).slice(0, 8)}…` : "Not signed in",
      accent: intakeSaved && intakeId,
    },
    {
      icon: "⚖️",
      value: Object.keys(topicCounts).length,
      label: "Topics Accessed",
      sub: "legal areas explored",
    },
    {
      icon: "✅",
      value: triageComplete ? "Done" : triageSession ? "In Progress" : "Not Started",
      label: "Triage Status",
      sub: triageComplete ? "Referrals ready" : "Complete for referrals",
      accent: triageComplete,
    },
  ];

  const recentQueries = aiHistory.slice(0, 5);

  return (
    <div className="chatdash">
      {/* Header */}
      <div className="chatdash-header">
        <span className="chatdash-header-icon">⚖️</span>
        <div>
          <div className="chatdash-title">Legal Dashboard</div>
          <div className="chatdash-subtitle">Your session at a glance</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="chatdash-stats">
        {stats.map((s) => (
          <div key={s.label} className={`chatdash-stat${s.accent ? " chatdash-stat--accent" : ""}`}>
            <div className="chatdash-stat-icon">{s.icon}</div>
            <div className="chatdash-stat-value">{s.value}</div>
            <div className="chatdash-stat-label">{s.label}</div>
            <div className="chatdash-stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Risk Alerts */}
      {riskAlerts.length > 0 && (
        <div className="chatdash-section">
          <div className="chatdash-section-title chatdash-section-title--danger">
            ⚠️ Risk Alerts
          </div>
          {riskAlerts.map((alert, i) => (
            <div key={i} className="chatdash-alert">
              <span className="chatdash-alert-dot" />
              {alert}
            </div>
          ))}
        </div>
      )}

      {/* Recent AI Queries */}
      {recentQueries.length > 0 && (
        <div className="chatdash-section">
          <div className="chatdash-section-title">💬 Recent AI Queries</div>
          {recentQueries.map((item, i) => (
            <div key={i} className="chatdash-query">
              <div className="chatdash-query-head">
                <span className="chatdash-query-topic">
                  {TOPIC_LABELS[item.topic] || item.topic}
                </span>
                <span className="chatdash-query-time">{formatTimeAgo(item.ts)}</span>
              </div>
              <div className="chatdash-query-text">{item.snippet || "—"}</div>
            </div>
          ))}
        </div>
      )}

      {/* Topic Breakdown */}
      {Object.keys(topicCounts).length > 0 && (
        <div className="chatdash-section">
          <div className="chatdash-section-title">📊 Topic Breakdown</div>
          {Object.entries(topicCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([t, count]) => (
              <div key={t} className="chatdash-topic-row">
                <span className="chatdash-topic-name">
                  {TOPIC_LABELS[t] || t}
                </span>
                <div className="chatdash-topic-bar-wrap">
                  <div
                    className="chatdash-topic-bar"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="chatdash-topic-count">{count}</span>
              </div>
            ))}
        </div>
      )}

      {/* Saved Cases */}
      <div className="chatdash-section">
        <div className="chatdash-section-title">📁 Saved Cases</div>
        {triageComplete ? (
          <div className="chatdash-case-card">
            <div className="chatdash-case-status done">Triage Complete</div>
            <div className="chatdash-case-topic">
              {TOPIC_LABELS[triageSession?.conversationState?.topic] || "General Legal"}
            </div>
            <div className="chatdash-case-detail">
              Referrals generated — review them in the chat.
            </div>
          </div>
        ) : (
          <div className="chatdash-empty-small">
            Complete the triage flow to generate a saved case with referrals.
          </div>
        )}
      </div>

      {/* Empty state if no history */}
      {totalQueries === 0 && riskAlerts.length === 0 && (
        <div className="chatdash-big-empty">
          <div className="chatdash-big-empty-icon">💼</div>
          <p>Start a conversation to see your legal activity dashboard here.</p>
        </div>
      )}

      <div className="chatdash-disclaimer">
        AI responses are for informational purposes only and do not constitute legal advice.
        For legal emergencies, contact an attorney immediately.
      </div>
    </div>
  );
}
