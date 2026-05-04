import React from "react";
import {
  FaChevronLeft,
  FaChevronRight,
  FaSearch,
  FaQuestionCircle,
} from "react-icons/fa";

export default function Topbar({
  onBack,
  canGoBack,
  title,
  extras,
}) {
  return (
    <div className="slack-topbar" role="banner">
      {/* Back / Forward */}
      <div className="slack-topbar-nav">
        <button
          type="button"
          className="slack-topbar-nav-btn"
          onClick={onBack}
          disabled={!canGoBack}
          aria-label="Go back"
        >
          <FaChevronLeft />
        </button>
        <button
          type="button"
          className="slack-topbar-nav-btn"
          disabled
          aria-label="Go forward"
        >
          <FaChevronRight />
        </button>
      </div>

      {/* Title */}
      {title && (
        <span className="slack-topbar-title">{title}</span>
      )}

      {/* Search */}
      <div className="slack-topbar-search">
        <span className="slack-topbar-search-icon" aria-hidden="true">
          <FaSearch />
        </span>
        <input
          type="text"
          placeholder="Search messages…"
          aria-label="Search"
        />
      </div>

      {/* Right controls */}
      <div className="slack-topbar-right">
        {extras}
        <button
          type="button"
          className="slack-topbar-icon-btn"
          aria-label="Help"
          title="Help"
        >
          <FaQuestionCircle />
        </button>
      </div>
    </div>
  );
}
