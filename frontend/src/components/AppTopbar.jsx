import React from "react";
import { ArrowLeft, Menu } from "lucide-react";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import calLogo from "../assets/cal_logo.png";

export default function AppTopbar({
  title,
  titleMeta,
  canGoBack,
  onBack,
  extras,
  showMenuButton = false,
  onMenuClick,
}) {
  return (
    <header
      className="border-b border-border bg-background/95 backdrop-blur-sm shrink-0 shadow-sm"
      style={{
        display: "grid",
        gridTemplateColumns: "48px 1fr auto",
        alignItems: "center",
        height: 56,
        minHeight: 56,
      }}
      role="banner"
    >
      {/* Left zone — hamburger (mobile) or back button (desktop) */}
      <div className="flex items-center justify-start pl-2">
        {showMenuButton ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="rounded-xl w-10 h-10 md:hidden hover:bg-primary/10 hover:text-primary"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" aria-hidden />
          </Button>
        ) : null}
        {canGoBack && (
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="rounded-xl w-8 h-8 shrink-0 hover:bg-primary/10 hover:text-primary"
              aria-label="Go back"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden />
            </Button>
            <Separator orientation="vertical" className="h-5 shrink-0 opacity-50" />
          </div>
        )}
      </div>

      {/* Center zone — CAL logo (mobile) or page title (desktop) */}
      <div className="flex items-center justify-center md:justify-start min-w-0 overflow-hidden">
        <img
          src={calLogo}
          alt="CAL"
          className="app-topbar-mobile-logo md:hidden"
          style={{ height: 32, width: "auto", objectFit: "contain", maxWidth: "100%" }}
        />
        {title && (
          <div className="hidden md:flex items-center gap-2 min-w-0">
            <h1
              className="text-sm font-semibold text-foreground truncate"
              aria-live="polite"
            >
              {title}
            </h1>
            {titleMeta && (
              <span className="text-sm text-muted-foreground font-normal flex-shrink-0">
                {titleMeta}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right zone — language toggle + other extras */}
      <div className="flex items-center justify-end gap-1.5 pr-3">
        {extras}
      </div>
    </header>
  );
}
