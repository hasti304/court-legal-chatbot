import React from "react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Scale, Volume2 } from "lucide-react";

export default function ChatMessage({ role, content, onSpeak, speechSupported }) {
  if (role === "bot") {
    return (
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: "#1e293b" }}
        >
          <span className="text-white text-xs font-semibold">AI</span>
        </div>
        <div className="max-w-[80%] xl:max-w-2xl min-w-0">
          <div className="bg-white border border-[#e2e8f0] rounded-2xl rounded-tl-none px-4 py-3 text-sm leading-relaxed shadow-sm" style={{ color: "#1e293b" }}>
            {content}
          </div>
          {speechSupported && onSpeak && typeof content === "string" && (
            <button
              type="button"
              onClick={() => onSpeak(content)}
              className="mt-1.5 flex items-center gap-1.5 text-xs transition-colors px-1"
              style={{ color: "#64748b" }}
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
      <div className="max-w-[80%] xl:max-w-lg rounded-2xl rounded-tr-none px-4 py-3 text-sm leading-relaxed" style={{ background: "#2563eb", color: "white" }}>
        {content}
      </div>
    </div>
  );
}
