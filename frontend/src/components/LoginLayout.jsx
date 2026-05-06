import React from "react";
import calLogo from "../assets/cal_logo.png";

export default function LoginLayout({ title, subtitle, children, extras, footer }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f0f2f5" }}>
      {/* Top-right extras (theme toggle, lang picker) */}
      {extras && (
        <div className="flex items-center justify-end gap-2 px-6 pt-4 shrink-0">
          {extras}
        </div>
      )}

      {/* Centered content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        {/* Logo above card */}
        <img
          src={calLogo}
          alt="Court Legal AI"
          className="h-24 w-auto object-contain mb-6 drop-shadow-sm"
        />

        {/* Card */}
        <div
          className="w-full bg-white rounded-2xl p-8"
          style={{ maxWidth: 540, boxShadow: "0 4px 24px rgba(0,0,0,0.09)" }}
        >
          {(title || subtitle) && (
            <div className="mb-6">
              {title && (
                <h1 className="text-2xl font-bold mb-1.5" style={{ color: "#1a2d4a" }}>
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-sm leading-relaxed" style={{ color: "#c05621" }}>
                  {subtitle}
                </p>
              )}
            </div>
          )}
          {children}
        </div>
      </div>

      {footer}
    </div>
  );
}
