import React from "react";
import {
  FaHome,
  FaComment,
  FaBell,
  FaFolderOpen,
  FaEllipsisH,
} from "react-icons/fa";
import calLogo from "../../assets/cal_logo.png";

const NAV_ITEMS = [
  { id: "home", icon: FaHome, label: "Home" },
  { id: "chat", icon: FaComment, label: "Legal Chat" },
  { id: "activity", icon: FaBell, label: "Activity" },
  { id: "files", icon: FaFolderOpen, label: "Documents" },
  { id: "more", icon: FaEllipsisH, label: "More" },
];

export default function PrimaryNav({
  activeSection,
  onNavigate,
  firstName,
  onSignOut,
}) {
  const initial = firstName
    ? firstName.charAt(0).toUpperCase()
    : "⚖"; // ⚖ fallback

  return (
    <nav className="primary-nav" aria-label="Primary navigation">
      <div className="primary-nav-logo" aria-label="CAL Logo">
        <img src={calLogo} alt="CAL" />
      </div>

      <div className="primary-nav-items">
        {NAV_ITEMS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            className={`primary-nav-btn${activeSection === id ? " primary-nav-btn--active" : ""}`}
            onClick={() => onNavigate(id)}
            data-tooltip={label}
            aria-label={label}
            aria-current={activeSection === id ? "page" : undefined}
          >
            <Icon />
          </button>
        ))}
      </div>

      <div className="primary-nav-bottom">
        <div className="primary-nav-divider" />
        <button
          type="button"
          className="primary-nav-avatar"
          onClick={onSignOut}
          data-tooltip="Sign out"
          aria-label="User profile / sign out"
        >
          {initial}
        </button>
      </div>
    </nav>
  );
}
