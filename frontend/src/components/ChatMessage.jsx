import React from "react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Scale, Volume2 } from "lucide-react";

export default function ChatMessage({ role, content, onSpeak, speechSupported }) {
  if (role === "bot") {
    return (
      <div className="flex items-start gap-3">
        <Avatar className="w-8 h-8 shrink-0 mt-0.5">
          <AvatarFallback className="bg-foreground text-background text-xs">
            <Scale className="w-3.5 h-3.5" aria-hidden />
          </AvatarFallback>
        </Avatar>
        <div className="max-w-[80%] xl:max-w-2xl min-w-0">
          <div className="bg-muted rounded-2xl rounded-tl-md px-4 py-3 text-sm text-foreground leading-relaxed">
            {content}
          </div>
          {speechSupported && onSpeak && typeof content === "string" && (
            <button
              type="button"
              onClick={() => onSpeak(content)}
              className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
              aria-label="Read aloud"
            >
              <Volume2 className="w-3 h-3" aria-hidden />
              Read aloud
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] xl:max-w-2xl bg-primary text-primary-foreground rounded-2xl rounded-tr-md px-4 py-3 text-sm leading-relaxed">
        {content}
      </div>
    </div>
  );
}
