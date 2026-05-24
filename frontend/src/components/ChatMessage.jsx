import React from "react";
import { Volume2 } from "lucide-react";

function formatMessage(text) {
  return String(text || "")
    .split('\n\n')
    .map(para => `<p>${para.replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

function formatTs(ts) {
  if (!ts) return null;
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatMessage({ role, content, onSpeak, speechSupported, ts }) {
  const timeStr = formatTs(ts);

  if (role === "bot") {
    return (
      <div className="flex items-start gap-3">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: "#1B2A4A" }}
        >
          <span className="text-white text-xs font-semibold">AI</span>
        </div>
        <div className="max-w-[80%] xl:max-w-2xl min-w-0">
          <div
            className="bg-white border border-[#e2e8f0] rounded-2xl rounded-tl-none px-4 py-3 text-sm leading-relaxed shadow-sm [&_p]:m-0 [&_p+p]:mt-2"
            style={{ color: "#1e293b" }}
            dangerouslySetInnerHTML={{ __html: formatMessage(content) }}
          />
          {timeStr && (
            <span className="block mt-1 text-[10px] px-1" style={{ color: "#94a3b8" }}>{timeStr}</span>
          )}
          {speechSupported && onSpeak && typeof content === "string" && (
            <button
              type="button"
              onClick={() => onSpeak(content)}
              className="mt-1 flex items-center gap-1.5 text-xs transition-colors px-1"
              style={{ color: "#94a3b8" }}
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
    <div className="flex flex-col items-end">
      <div className="max-w-[80%] xl:max-w-lg rounded-2xl rounded-tr-none px-4 py-3 text-sm leading-relaxed" style={{ background: "#1B2A4A", color: "white" }}>
        {content}
      </div>
      {timeStr && (
        <span className="mt-1 text-[10px] pr-1" style={{ color: "#94a3b8" }}>{timeStr}</span>
      )}
    </div>
  );
}
