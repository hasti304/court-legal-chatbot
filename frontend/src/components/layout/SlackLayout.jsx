import React from "react";
import PrimaryNav from "./PrimaryNav";
import WorkspaceSidebar from "./WorkspaceSidebar";
import Topbar from "./Topbar";
import "./SlackLayout.css";

/**
 * Three-panel Slack-style layout wrapper.
 *
 * Props:
 *   isDark          – boolean, adds cal-app-dark class
 *   activeSection   – 'home' | 'chat' | 'activity' | 'files' | 'more'
 *   activeTopic     – topic ID string for sidebar highlight
 *   firstName       – user's first name (for avatar initial)
 *   intakeSaved     – boolean, whether the user has a saved session
 *   topbarTitle     – string shown in the topbar
 *   canGoBack       – boolean, enables the back button in topbar
 *   onNavigate      – (section: string) => void
 *   onTopicSelect   – (topicId: string) => void
 *   onStartChat     – () => void
 *   onSignOut       – () => void
 *   onBack          – () => void
 *   topbarExtras    – JSX rendered in topbar right section
 *   children        – main content area
 */
export default function SlackLayout({
  isDark,
  activeSection = "home",
  activeTopic,
  firstName,
  intakeSaved,
  topbarTitle,
  canGoBack,
  onNavigate,
  onTopicSelect,
  onStartChat,
  onSignOut,
  onBack,
  topbarExtras,
  children,
}) {
  return (
    <div className={`slack-layout${isDark ? " cal-app-dark" : ""}`}>
      <PrimaryNav
        activeSection={activeSection}
        onNavigate={onNavigate}
        firstName={firstName}
        onSignOut={onSignOut}
      />

      <WorkspaceSidebar
        activeTopic={activeTopic}
        onTopicSelect={onTopicSelect}
        onStartChat={onStartChat}
        intakeSaved={intakeSaved}
      />

      <div className="slack-main">
        <Topbar
          onBack={onBack}
          canGoBack={canGoBack}
          title={topbarTitle}
          extras={topbarExtras}
        />
        <div className="slack-content">
          {children}
        </div>
      </div>
    </div>
  );
}
