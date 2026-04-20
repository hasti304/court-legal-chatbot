import React from "react";
import { useTranslation } from "react-i18next";

/**
 * Institutional footer: disclaimer, privacy, contact — used on landing and intake flows.
 */
export default function SiteFooter({
  supportEmail,
  onPrivacyClick,
  className = "",
  showStaffSignIn = false,
}) {
  const { t } = useTranslation();

  return (
    <footer className={`site-footer ${className}`.trim()} role="contentinfo">
      <div className="site-footer-inner">
        <p className="site-footer-org">{t("site.footerOrg")}</p>
        <p className="site-footer-disclaimer">{t("site.footerDisclaimer")}</p>
        <p className="site-footer-contact">
          {t("site.footerContactLabel")}{" "}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
        </p>
        {typeof onPrivacyClick === "function" && (
          <p className="site-footer-privacy">
            <button
              type="button"
              className="link-button site-footer-privacy-btn"
              onClick={onPrivacyClick}
            >
              {t("intake.privacyLink")}
            </button>
          </p>
        )}
        {showStaffSignIn ? (
          <p className="site-footer-staff">
            <a className="site-footer-staff-link" href="#/admin">
              {t("site.staffSignIn")}
            </a>
          </p>
        ) : null}
      </div>
    </footer>
  );
}
