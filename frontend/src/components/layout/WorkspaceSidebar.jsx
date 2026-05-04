import React, { useState, useMemo } from "react";
import {
  FaHashtag,
  FaAt,
  FaBookmark,
  FaInbox,
  FaCog,
  FaChevronRight,
} from "react-icons/fa";
import { MdOutlineDrafts } from "react-icons/md";

const QUERY_HISTORY_KEY = "cal_ai_query_history_v1";

const LEGAL_TOPICS = [
  { id: "housing", label: "Housing" },
  { id: "divorce", label: "Divorce" },
  { id: "custody", label: "Child Custody" },
  { id: "child_support", label: "Child Support" },
  { id: "education", label: "Education" },
  { id: "general", label: "General Legal" },
];

const TOPIC_LABELS = {
  housing: "Housing",
  divorce: "Divorce",
  custody: "Child Custody",
  child_support: "Child Support",
  education: "Education",
  general: "General Legal",
};

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
      .slice(0, 5);
  } catch {
    return [];
  }
}

export default function WorkspaceSidebar({
  activeTopic,
  onTopicSelect,
  onStartChat,
  intakeSaved,
}) {
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [dmsOpen, setDmsOpen] = useState(true);
  const recentSessions = useMemo(getRecentSessions, []);

  return (
    <aside className="workspace-sidebar" aria-label="Workspace navigation">
      {/* Header */}
      <div className="workspace-sidebar-header">
        <div className="workspace-name-row">
          <span className="workspace-name-text">CAL Legal Assistant</span>
          <button
            type="button"
            className="workspace-header-btn"
            aria-label="Workspace settings"
          >
            <FaCog />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="workspace-sidebar-body">
        {/* Quick nav */}
        <button
          type="button"
          className="workspace-nav-item"
          onClick={onStartChat}
        >
          <span className="workspace-nav-icon"><FaInbox /></span>
          <span className="workspace-nav-label">Threads</span>
        </button>

        <button type="button" className="workspace-nav-item">
          <span className="workspace-nav-icon"><MdOutlineDrafts /></span>
          <span className="workspace-nav-label">Drafts &amp; Saved</span>
        </button>

        <button type="button" className="workspace-nav-item">
          <span className="workspace-nav-icon"><FaBookmark /></span>
          <span className="workspace-nav-label">Starred</span>
        </button>

        <div className="workspace-divider" />

        {/* Channels — Legal Topics */}
        <button
          type="button"
          className="workspace-section-toggle"
          onClick={() => setChannelsOpen((v) => !v)}
          aria-expanded={channelsOpen}
        >
          <span className={`workspace-section-chevron${channelsOpen ? " open" : ""}`}>
            <FaChevronRight />
          </span>
          Channels
        </button>

        {channelsOpen &&
          LEGAL_TOPICS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={`workspace-nav-item${activeTopic === id ? " workspace-nav-item--active" : ""}`}
              onClick={() => onTopicSelect && onTopicSelect(id)}
            >
              <span className="workspace-nav-icon"><FaHashtag /></span>
              <span className="workspace-nav-label">{label}</span>
            </button>
          ))}

        <div className="workspace-divider" />

        {/* Direct Messages */}
        <button
          type="button"
          className="workspace-section-toggle"
          onClick={() => setDmsOpen((v) => !v)}
          aria-expanded={dmsOpen}
        >
          <span className={`workspace-section-chevron${dmsOpen ? " open" : ""}`}>
            <FaChevronRight />
          </span>
          Direct Messages
        </button>

        {dmsOpen && (
          <>
            <button
              type="button"
              className={`workspace-nav-item${activeTopic === "ai" ? " workspace-nav-item--active" : ""}`}
              onClick={onStartChat}
            >
              <span className="workspace-nav-icon"><FaAt /></span>
              <span className="workspace-nav-label">AI Legal Chat</span>
              {!intakeSaved && (
                <span className="workspace-nav-badge">Guest</span>
              )}
            </button>

            {recentSessions.map((session) => (
              <button
                key={session.topic}
                type="button"
                className={`workspace-nav-item${activeTopic === session.topic ? " workspace-nav-item--active" : ""}`}
                onClick={() => onTopicSelect && onTopicSelect(session.topic)}
              >
                <span className="workspace-nav-icon"><FaAt /></span>
                <span className="workspace-nav-label">
                  {TOPIC_LABELS[session.topic] || session.topic}
                </span>
              </button>
            ))}
          </>
        )}
      </div>
    </aside>
  );
}
