import React from "react";
import calLogo from "../assets/cal_logo.png";

export default function LoginLayout({ title, subtitle, children, extras, footer, leftPanel }) {
  if (leftPanel) {
    return (
      <div className="auth-github-page auth-github-page--light min-h-screen flex flex-col">
        {extras && (
          <div className="flex items-center justify-end gap-2 px-6 pt-4 shrink-0">
            {extras}
          </div>
        )}
        <div className="flex-1 flex auth-split-inner">
          {leftPanel}
          <div className="auth-split-form-col flex flex-col justify-center">
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
