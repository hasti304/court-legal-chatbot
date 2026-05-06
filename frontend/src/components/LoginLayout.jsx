import React from "react";
import calLogo from "../assets/cal_logo.png";

export default function LoginLayout({ title, subtitle, children, extras, footer, leftPanel }) {
  if (leftPanel) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {/* Left dark-blue panel */}
          <div
            className="login-split-left"
            style={{
              width: "42%",
              minWidth: 280,
              background: "linear-gradient(145deg, #1a3560 0%, #1e419c 60%, #2355b8 100%)",
              padding: "40px 48px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {leftPanel}
          </div>

          {/* Right form panel */}
          <div
            style={{
              flex: 1,
              background: "#f8fafc",
              display: "flex",
              flexDirection: "column",
              padding: "32px 48px",
              overflowY: "auto",
            }}
          >
            {extras && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "24px", flexShrink: 0 }}>
                {extras}
              </div>
            )}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                maxWidth: 560,
                width: "100%",
                margin: "0 auto",
              }}
            >
              {title && (
                <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "#1e293b", marginBottom: "8px", lineHeight: 1.2 }}>
                  {title}
                </h1>
              )}
              {subtitle && (
                <p style={{ color: "#64748b", marginBottom: "20px", lineHeight: 1.6 }}>
                  {subtitle}
                </p>
              )}
              {children}
            </div>
          </div>
        </div>
        {footer}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f5f5f7" }}>
      {extras && (
        <div className="flex items-center justify-end gap-2 px-6 pt-4 shrink-0">
          {extras}
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <img
          src={calLogo}
          alt="Court Legal AI"
          className="h-32 w-auto object-contain mb-8"
        />

        <div
          className="w-full bg-white rounded-2xl p-8 md:p-12"
          style={{ maxWidth: 672, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
        >
          {(title || subtitle) && (
            <div className="mb-6">
              {title && (
                <h1 className="text-3xl mb-2" style={{ color: "#1e293b" }}>
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-base leading-relaxed" style={{ color: "#1e293b" }}>
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
