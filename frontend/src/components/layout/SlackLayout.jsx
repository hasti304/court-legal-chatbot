import React, { useEffect, useState } from "react";
import AppSidebar from "../AppSidebar";
import AppTopbar from "../AppTopbar";
import "./SlackLayout.css";
import "./MobileNav.css";

/**
 * Main application layout — sidebar + topbar + scrollable content area.
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [activeSection]);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  const handleNavigate = (section) => {
    setMobileNavOpen(false);
    onNavigate?.(section);
  };

  const handleTopicSelect = (topicId) => {
    setMobileNavOpen(false);
    onTopicSelect?.(topicId);
  };

  const handleStartChat = () => {
    setMobileNavOpen(false);
    onStartChat?.();
  };

  const handleSignOut = () => {
    setMobileNavOpen(false);
    onSignOut?.();
  };

  return (
    <div className={`flex h-screen overflow-hidden bg-background${isDark ? " dark" : ""}`} style={{ height: "100dvh" }}>
      {mobileNavOpen ? (
        <button
          type="button"
          className="app-sidebar-backdrop md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <div
        className={`app-sidebar-drawer shrink-0 h-full${mobileNavOpen ? " app-sidebar-drawer--open" : ""}`}
      >
        <AppSidebar
          activeSection={activeSection}
          activeTopic={activeTopic}
          firstName={firstName}
          lastName={lastName}
          intakeSaved={intakeSaved}
          onNavigate={handleNavigate}
          onTopicSelect={handleTopicSelect}
          onStartChat={handleStartChat}
          onSignOut={handleSignOut}
          onCloseMobile={() => setMobileNavOpen(false)}
        />
      </div>

      <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
        <AppTopbar
          title={topbarTitle}
          titleMeta={topbarMeta}
          canGoBack={canGoBack}
          onBack={onBack}
          extras={topbarExtras}
          onMenuClick={() => setMobileNavOpen(true)}
          showMenuButton
        />
        <div className="flex-1 overflow-auto min-h-0" id="main-content">
          {children}
        </div>
      </div>
    </div>
  );
}
