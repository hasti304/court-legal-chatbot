import React, { useState } from "react";
import { FaExclamationTriangle, FaTimes } from "react-icons/fa";
import "./EmergencyButton.css";
import { useTranslation } from "react-i18next";

const EmergencyButton = () => {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);

  const emergencyResources = [
    { name: t("emergency.resources.emsName"), phone: "911", description: t("emergency.resources.emsDesc"), color: "#dc2626" },
    { name: t("emergency.resources.ndvName"), phone: "1-800-799-7233", description: t("emergency.resources.ndvDesc"), color: "#ea580c" },
    { name: t("emergency.resources.idvName"), phone: "1-877-863-6338", description: t("emergency.resources.idvDesc"), color: "#d97706" },
    { name: t("emergency.resources.lifelineName"), phone: "988", description: t("emergency.resources.lifelineDesc"), color: "#7c3aed" },
    { name: t("emergency.resources.dcfsName"), phone: "1-800-252-2873", description: t("emergency.resources.dcfsDesc"), color: "#0891b2" },
    { name: t("emergency.resources.rainnName"), phone: "1-800-656-4673", description: t("emergency.resources.rainnDesc"), color: "#db2777" }
  ];

  return (
    <>
      <button className="emergency-floating-button" onClick={() => setShowModal(true)} title={t("emergency.button")}>
        <FaExclamationTriangle size={24} />
        <span>{t("emergency.button")}</span>
      </button>

      {showModal && (
        <div className="emergency-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="emergency-modal" onClick={(e) => e.stopPropagation()}>
            <div className="emergency-modal-header">
              <h2>{t("emergency.title")}</h2>
              <button className="emergency-close-btn" onClick={() => setShowModal(false)}>
                <FaTimes size={24} />
              </button>
            </div>

            <div className="emergency-modal-body">
              <p className="emergency-warning">{t("emergency.warning")}</p>

              <div className="emergency-resources-grid">
                {emergencyResources.map((resource, index) => (
                  <div key={index} className="emergency-resource-card" style={{ borderLeftColor: resource.color }}>
                    <h3>{resource.name}</h3>
                    <p>{resource.description}</p>
                    <a
                      href={`tel:${resource.phone.replace(/[^0-9]/g, "")}`}
                      className="emergency-call-button"
                      style={{ background: resource.color }}
                    >
                      📞 Call {resource.phone}
                    </a>
                  </div>
                ))}
              </div>

              <div className="emergency-safety-notice">
                <strong>{t("emergency.safetyNoteTitle")}</strong>
                {t("emergency.safetyNoteText")}
                <button className="quick-exit-button" onClick={() => (window.location.href = "https://www.google.com")}>
                  {t("emergency.quickExit")}
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
