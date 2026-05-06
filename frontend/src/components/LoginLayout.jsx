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
          className="hidden lg:flex lg:w-5/12 xl:w-2/5 flex-col justify-between p-10 xl:p-14 shrink-0 relative overflow-hidden"
          style={{ background: "linear-gradient(145deg, #1e3a8a 0%, #1e40af 45%, #312e81 100%)" }}
          aria-label="About Court Legal AI"
        >
          {/* Subtle background pattern */}
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }} />

          <div className="relative">
            {/* Brand */}
            <div className="flex items-center gap-3 mb-12">
              <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center">
                <img
                  src={calLogo}
                  alt="Court Legal AI"
                  className="w-6 h-6 object-contain brightness-0 invert"
                />
              </div>
              <span className="text-lg font-bold tracking-tight leading-none text-white">
                Court Legal AI
              </span>
            </div>

            {/* Hero */}
            <h1 className="text-3xl xl:text-4xl font-extrabold leading-tight mb-4 text-white">
              Get guidance for your legal issue in minutes
            </h1>
            <p className="text-white/65 text-[15px] leading-relaxed mb-10">
              Free, confidential legal guidance for Illinois residents — no appointment needed.
            </p>

            {/* Trust bullets */}
            <ul className="space-y-4 mb-10" aria-label="Platform benefits">
              {TRUST_BULLETS.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle className="w-3 h-3 text-white" aria-hidden />
                  </div>
                  <span className="text-white/80 text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>

            {/* Testimonial */}
            <blockquote className="rounded-2xl bg-white/10 border border-white/15 p-5 backdrop-blur-sm">
              <p className="text-white/70 text-sm italic leading-relaxed mb-3">
                "This tool helped me understand my rights as a tenant and connect with legal aid within minutes."
              </p>
              <footer className="text-white/45 text-xs font-medium">— Illinois resident, Housing case</footer>
            </blockquote>
          </div>

          {/* Emergency notice */}
          <div className="relative flex items-start gap-3 rounded-2xl bg-white/10 border border-white/15 p-4 mt-6 backdrop-blur-sm">
            <Shield className="w-4 h-4 text-white/60 shrink-0 mt-0.5" aria-hidden />
            <p className="text-white/55 text-xs leading-relaxed">
              <strong className="text-white/80">In immediate danger?</strong> Call{" "}
              <strong className="text-white/80">911</strong> or the National DV Hotline at{" "}
              <strong className="text-white/80">1-800-799-7233</strong>.
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
              <span className="font-bold text-foreground">Court Legal AI</span>
            </div>

            <div className="w-full max-w-[420px]">
              {(title || subtitle) && (
                <div className="mb-7">
                  {title && (
                    <h2 className="text-2xl font-extrabold text-foreground">{title}</h2>
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
