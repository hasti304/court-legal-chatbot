import React from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";

export default function AppTopbar({ title, canGoBack, onBack, extras }) {
  return (
    <header
      className="h-14 flex items-center gap-3 px-4 border-b border-border bg-background/95 backdrop-blur-sm shrink-0 shadow-sm"
      role="banner"
    >
      {canGoBack && (
        <>
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
        </>
      )}

      {title && (
        <h1
          className="text-sm font-semibold text-foreground flex-1 truncate"
          aria-live="polite"
        >
          {title}
        </h1>
      )}

      {extras && (
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          {extras}
        </div>
      )}
    </header>
  );
}
