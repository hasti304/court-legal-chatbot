import React, { useEffect, useMemo, useRef, useState } from "react";
import { FaExclamationTriangle, FaTimes, FaSignOutAlt, FaPhone } from "react-icons/fa";
import "./EmergencyButton.css";
import { useTranslation } from "react-i18next";

const EmergencyButton = () => {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const closeButtonRef = useRef(null);

  const emergencyResources = useMemo(
    () => [
      {
        name: t("emergency.resources.emsName"),
        phone: "911",
        description: t("emergency.resources.emsDesc"),
        urgent: true,
      },
      {
        name: t("emergency.resources.ndvName"),
        phone: "1-800-799-7233",
        description: t("emergency.resources.ndvDesc"),
      },
      {
        name: t("emergency.resources.idvName"),
        phone: "1-877-863-6338",
        description: t("emergency.resources.idvDesc"),
      },
      {
        name: t("emergency.resources.lifelineName"),
        phone: "988",
        description: t("emergency.resources.lifelineDesc"),
      },
      {
        name: t("emergency.resources.dcfsName"),
        phone: "1-800-252-2873",
        description: t("emergency.resources.dcfsDesc"),
      },
      {
        name: t("emergency.resources.rainnName"),
        phone: "1-800-656-4673",
        description: t("emergency.resources.rainnDesc"),
      },
    ],
    [t]
  );

  useEffect(() => {
    if (!showModal) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    closeButtonRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowModal(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showModal]);

  const openModal = () => setShowModal(true);
  const closeModal = () => setShowModal(false);

  const quickExit = () => {
    try {
      localStorage.removeItem("cal_chatbot_state_v1");
      localStorage.removeItem("cal_first_visit_done_v1");
      window.location.replace("https://www.google.com");
    } catch (e) {
      window.location.href = "https://www.google.com";
    }
  };

  const getDiscreetUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("mode", "discreet");
    return url.toString();
  };

  const getRegularUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("mode");
    return url.toString();
  };

  const toTelHref = (phone) => {
    const digits = String(phone || "").replace(/[^0-9]/g, "");
    return `tel:${digits}`;
  };

  return (
    <>
      <button
        className="emergency-floating-button"
        onClick={openModal}
        title={t("emergency.button")}
        aria-label={t("emergency.button")}
        type="button"
      >
        <FaExclamationTriangle size={24} />
        <span>{t("emergency.button")}</span>
      </button>

      {showModal && (
        <div
          className="emergency-modal-overlay"
          onClick={closeModal}
          role="presentation"
        >
          <div
            className="emergency-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="emergency-modal-title"
          >
            <div className="emergency-modal-header">
              <h2 id="emergency-modal-title">{t("emergency.title")}</h2>
              <button
                ref={closeButtonRef}
                className="emergency-close-btn"
                onClick={closeModal}
                aria-label="Close emergency resources"
                type="button"
              >
                <FaTimes size={24} />
              </button>
            </div>

            <div className="emergency-modal-body">
              <p className="emergency-warning">{t("emergency.warning")}</p>

              <div className="emergency-resources-grid">
                {emergencyResources.map((resource, index) => (
                  <div
                    key={index}
                    className={`emergency-resource-card${
                      resource.urgent ? " emergency-resource-card--urgent" : ""
                    }`}
                  >
                    <h3>{resource.name}</h3>
                    <p>{resource.description}</p>
                    <a
                      href={toTelHref(resource.phone)}
                      className={`emergency-call-button${
                        resource.urgent ? " emergency-call-button--urgent" : ""
                      }`}
                    >
                      <FaPhone className="emergency-call-icon" aria-hidden />
                      {t("emergency.callAction", { phone: resource.phone })}
                    </a>
                  </div>
                ))}
              </div>

              <div className="emergency-safety-notice">
                <strong>{t("emergency.safetyNoteTitle")}</strong>
                <span>{t("emergency.safetyNoteText")}</span>
                <span>{t("emergency.installHint")}</span>

                <div className="discreet-install-actions">
                  <a className="discreet-link-button" href={getDiscreetUrl()}>
                    {t("emergency.installDiscreet")}
                  </a>
                  <a className="discreet-link-button discreet-link-secondary" href={getRegularUrl()}>
                    {t("emergency.installRegular")}
                  </a>
                </div>

                <button
                  className="quick-exit-button"
                  onClick={quickExit}
                  type="button"
                >
                  <FaSignOutAlt />
                  <span>{t("emergency.quickExit")}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EmergencyButton;