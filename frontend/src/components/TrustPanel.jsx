import React, { useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Collapsible "what this tool does / does not do" for trust and clarity.
 */
export default function TrustPanel({ className = "" }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const doesLines = String(t("trust.doesLines"))
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const doesNotLines = String(t("trust.doesNotLines"))
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className={`trust-panel ${open ? "open" : ""} ${className}`.trim()}>
      <button
        type="button"
        className="btn btn-start trust-panel-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {t("trust.quickLabel")}
      </button>
      {open && <div className="trust-panel-body">
        <p className="trust-panel-lead">{t("trust.lead")}</p>
        <div className="trust-panel-col">
          <h4 className="trust-panel-sub">{t("trust.doesHeading")}</h4>
          <ul className="trust-panel-list">
            {doesLines.map((line) => (
              <li key={line}>{line.replace(/^•\s*/, "")}</li>
            ))}
          </ul>
        </div>
        <div className="trust-panel-col">
          <h4 className="trust-panel-sub">{t("trust.doesNotHeading")}</h4>
          <ul className="trust-panel-list trust-panel-list-muted">
            {doesNotLines.map((line) => (
              <li key={line}>{line.replace(/^•\s*/, "")}</li>
            ))}
          </ul>
        </div>
      </div>}
    </div>
  );
}
