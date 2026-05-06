import React, { useRef, useEffect } from "react";
import { Send, RotateCcw, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

export default function ChatInput({
  value,
  onChange,
  onSubmit,
  onRestart,
  onBack,
  loading,
  placeholder,
  options,
  onOptionClick,
  safeOptionLabel,
}) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  return (
    <div className="border-t border-border bg-background px-4 pt-3 pb-4 shrink-0">
      {/* Quick option buttons */}
      {options && options.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label="Quick replies">
          {options.map((opt, i) => (
            <Button
              key={i}
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl text-xs h-8 font-normal"
              onClick={() => onOptionClick?.(opt)}
              disabled={loading}
            >
              {safeOptionLabel ? safeOptionLabel(opt) : String(opt)}
            </Button>
          ))}
        </div>
      )}

      {/* Input row */}
      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Type your message…"}
          disabled={loading}
          rows={1}
          className="resize-none rounded-2xl flex-1 min-h-[44px] max-h-40 py-2.5 text-sm leading-relaxed"
          aria-label="Message input"
        />
        <Button
          type="submit"
          size="icon"
          className="rounded-xl h-11 w-11 shrink-0"
          disabled={loading || !value.trim()}
          aria-label="Send message"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          ) : (
            <Send className="w-4 h-4" aria-hidden />
          )}
        </Button>
      </form>

      {/* Action buttons row */}
      <div className="flex items-center gap-1 mt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-xl h-7 text-xs text-muted-foreground gap-1.5 px-2"
          onClick={onBack}
          disabled={loading}
        >
          <ArrowLeft className="w-3 h-3" aria-hidden />
          Back
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="rounded-xl h-7 text-xs text-muted-foreground gap-1.5 px-2"
          onClick={onRestart}
          disabled={loading}
        >
          <RotateCcw className="w-3 h-3" aria-hidden />
          Restart
        </Button>
      </div>
    </div>
  );
}
