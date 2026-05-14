import React from "react";
import calLogo from "../assets/cal_logo.png";
import { useTranslation } from "react-i18next";

export default function LoginLayout({
  title,
  subtitle,
  children,
  extras,
  footer,
  leftPanel,
  leftCenterPanel = null,
  showTrustBadge = false,
  progressContent = null,
}) {
  const { t } = useTranslation();

  if (leftPanel || leftCenterPanel) {
    return (
      <div className="cal-auth-root">
        <div className="cal-auth-columns">
          {/* Left panel */}
          <div className="cal-auth-left">
            <div className="cal-auth-left-bg" />
            <div className="cal-auth-left-overlay" />
            <div className="cal-auth-left-content">
              {/* Logo top-left */}
              <div className="cal-auth-left-logo-wrap">
                <img
                  src={calLogo}
                  alt="Chicago Advocate Legal, NFP logo"
                  className="cal-auth-left-logo"
                />
              </div>

              {/* Center content (value props / bullets) */}
              {leftCenterPanel && (
                <div className="cal-auth-left-center">{leftCenterPanel}</div>
              )}

              {/* Bottom content */}
              <div className="cal-auth-left-bottom">
                {leftPanel}
                {showTrustBadge && (
                  <div className="cal-auth-trust-badge">
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      width="14"
                      height="14"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {t("auth.register.trustBadge")}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="cal-auth-right">
            {extras && (
              <div className="cal-auth-right-topbar">
                {extras}
              </div>
            )}
            <div className="cal-auth-right-scroll">
              <div className="cal-auth-right-inner">
                {progressContent && progressContent}
                {title && (
                  <h1 className="cal-auth-form-title">{title}</h1>
                )}
                {subtitle && (
                  <p className="cal-auth-form-subtitle">{subtitle}</p>
                )}
                {children}
              </div>
            </div>
          </div>
        </div>

        {footer}
      </div>
    );
  }

  /* Fallback: no leftPanel — basic centered layout */
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#ffffff" }}>
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
                <h1 className="text-3xl mb-2" style={{ color: "#1A1A1A" }}>
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-base leading-relaxed" style={{ color: "#1A1A1A" }}>
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
