import React from "react";
import AppSidebar from "../AppSidebar";
import AppTopbar from "../AppTopbar";
import "./SlackLayout.css";

/**
 * Main application layout — sidebar + topbar + scrollable content area.
 *
 * Props (unchanged API):
 *   isDark          – boolean, applies dark class to root
 *   activeSection   – 'home' | 'chat' | 'files' | 'resources' | 'settings'
 *   activeTopic     – topic ID string for sidebar highlight
 *   firstName       – user's first name
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
  lastName,
  intakeSaved,
  topbarTitle,
  topbarMeta,
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
    <div className={`flex h-screen overflow-hidden bg-background${isDark ? " dark" : ""}`}>
      <AppSidebar
        activeSection={activeSection}
        activeTopic={activeTopic}
        firstName={firstName}
        lastName={lastName}
        intakeSaved={intakeSaved}
        onNavigate={onNavigate}
        onTopicSelect={onTopicSelect}
        onStartChat={onStartChat}
        onSignOut={onSignOut}
      />

      <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
        <AppTopbar
          title={topbarTitle}
          titleMeta={topbarMeta}
          canGoBack={canGoBack}
          onBack={onBack}
          extras={topbarExtras}
        />
        <div className="flex-1 overflow-auto min-h-0" id="main-content">
          {children}
        </div>
      </div>
    </div>
  );
}
