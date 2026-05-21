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
      className="relative h-14 flex items-center gap-3 px-4 border-b border-border bg-background/95 backdrop-blur-sm shrink-0 shadow-sm"
      role="banner"
    >
      {showMenuButton ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="rounded-xl w-11 h-11 shrink-0 md:hidden hover:bg-primary/10 hover:text-primary"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" aria-hidden />
        </Button>
      ) : null}

      {/* Desktop back button — hidden on mobile */}
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

      {/* Mobile-only: CAL logo centered absolutely */}
      <div className="absolute left-1/2 -translate-x-1/2 md:hidden pointer-events-none">
        <img
          src={calLogo}
          alt="CAL"
          className="app-topbar-mobile-logo"
          style={{ height: 32, width: "auto", objectFit: "contain" }}
        />
      </div>

      {/* Desktop title — hidden on mobile */}
      {title && (
        <div className="hidden md:flex items-center gap-2 flex-1 min-w-0">
          <h1
            className="text-sm font-semibold text-foreground truncate"
            aria-live="polite"
          >
            {title}
          </h1>
          {titleMeta && (
            <span className="text-sm text-muted-foreground font-normal flex-shrink-0">{titleMeta}</span>
          )}
        </div>
      )}

      {/* Spacer so extras push to right on mobile too */}
      {!title && <div className="flex-1" />}

      {extras && (
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          {extras}
        </div>
      )}
    </header>
  );
}
