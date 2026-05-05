import React from "react";
import { CheckCircle, Shield } from "lucide-react";
import calLogo from "../assets/cal_logo.png";

const TRUST_BULLETS = [
  "Free legal guidance for qualifying residents",
  "Illinois-specific laws and local resources",
  "Private, secure, and confidential",
];

export default function LoginLayout({ title, subtitle, children, extras, footer }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex flex-1">
        {/* LEFT: Trust Panel */}
        <aside
          className="hidden lg:flex lg:w-5/12 xl:w-2/5 flex-col justify-between p-10 xl:p-14 bg-foreground text-background shrink-0"
          aria-label="About Court Legal AI"
        >
          <div>
            {/* Brand */}
            <div className="flex items-center gap-3 mb-12">
              <img
                src={calLogo}
                alt="Court Legal AI"
                className="w-9 h-9 object-contain brightness-0 invert"
              />
              <span className="text-lg font-semibold tracking-tight leading-none">
                Court Legal AI
              </span>
            </div>

            {/* Hero */}
            <h1 className="text-3xl xl:text-4xl font-bold leading-tight mb-4 text-background">
              Get guidance for your legal issue in minutes
            </h1>
            <p className="text-background/65 text-[15px] leading-relaxed mb-10">
              Free, confidential legal guidance for Illinois residents — no appointment needed.
            </p>

            {/* Trust bullets */}
            <ul className="space-y-4 mb-10" aria-label="Platform benefits">
              {TRUST_BULLETS.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle className="w-[18px] h-[18px] text-background/75 shrink-0 mt-0.5" aria-hidden />
                  <span className="text-background/75 text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>

            {/* Testimonial */}
            <blockquote className="rounded-2xl border border-background/15 p-5">
              <p className="text-background/60 text-sm italic leading-relaxed mb-2.5">
                "This tool helped me understand my rights as a tenant and connect with legal aid within minutes."
              </p>
              <footer className="text-background/40 text-xs">— Illinois resident, Housing case</footer>
            </blockquote>
          </div>

          {/* Emergency notice */}
          <div className="flex items-start gap-3 rounded-2xl border border-background/15 p-4 mt-6">
            <Shield className="w-4 h-4 text-background/50 shrink-0 mt-0.5" aria-hidden />
            <p className="text-background/50 text-xs leading-relaxed">
              <strong className="text-background/70">In immediate danger?</strong> Call{" "}
              <strong className="text-background/70">911</strong> or the National DV Hotline at{" "}
              <strong className="text-background/70">1-800-799-7233</strong>.
            </p>
          </div>
        </aside>

        {/* RIGHT: Auth area */}
        <div className="flex-1 flex flex-col bg-background min-w-0">
          {/* Extras (theme toggle, lang picker) */}
          {extras && (
            <div className="flex items-center justify-end gap-2 px-8 pt-5 shrink-0">
              {extras}
            </div>
          )}

          <div className="flex-1 flex flex-col justify-center items-center px-6 sm:px-10 py-8">
            {/* Mobile brand */}
            <div className="lg:hidden flex items-center gap-2.5 mb-8 w-full max-w-[420px]">
              <img src={calLogo} alt="Court Legal AI" className="w-8 h-8 object-contain" />
              <span className="font-semibold text-foreground">Court Legal AI</span>
            </div>

            <div className="w-full max-w-[420px]">
              {(title || subtitle) && (
                <div className="mb-7">
                  {title && (
                    <h2 className="text-2xl font-bold text-foreground">{title}</h2>
                  )}
                  {subtitle && (
                    <p className="text-muted-foreground text-sm mt-1.5 leading-relaxed">{subtitle}</p>
                  )}
                </div>
              )}
              {children}
            </div>
          </div>
        </div>
      </div>

      {/* Footer (full width) */}
      {footer}
    </div>
  );
}
