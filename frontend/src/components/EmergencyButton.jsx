import React, { useState } from 'react';
import { FaExclamationTriangle, FaTimes } from 'react-icons/fa';
import './EmergencyButton.css';

const EmergencyButton = () => {
  const [showModal, setShowModal] = useState(false);

  const emergencyResources = [
    {
      name: "Emergency Services (Police/Fire/Ambulance)",
      phone: "911",
      description: "Immediate life-threatening emergency",
      color: "#dc2626"
    },
    {
      name: "National Domestic Violence Hotline",
      phone: "1-800-799-7233",
      description: "24/7 support for domestic violence survivors",
      color: "#ea580c"
    },
    {
      name: "Illinois Domestic Violence Hotline",
      phone: "1-877-863-6338",
      description: "Illinois-specific domestic violence resources",
      color: "#d97706"
    },
    {
      name: "National Suicide Prevention Lifeline",
      phone: "988",
      description: "24/7 mental health crisis support",
      color: "#7c3aed"
    },
    {
      name: "Illinois Child Abuse Hotline (DCFS)",
      phone: "1-800-252-2873",
      description: "Report child abuse or neglect",
      color: "#0891b2"
    },
    {
      name: "National Sexual Assault Hotline (RAINN)",
      phone: "1-800-656-4673",
      description: "Confidential support for sexual assault survivors",
      color: "#db2777"
    }
  ];

  return (
    <>
      {/* Floating Emergency Button */}
      <button 
        className="emergency-floating-button"
        onClick={() => setShowModal(true)}
        title="Emergency Resources"
      >
        <FaExclamationTriangle size={24} />
        <span>EMERGENCY</span>
      </button>

      {/* Emergency Modal */}
      {showModal && (
        <div className="emergency-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="emergency-modal" onClick={(e) => e.stopPropagation()}>
            <div className="emergency-modal-header">
              <h2>🚨 Emergency Resources</h2>
              <button 
                className="emergency-close-btn"
                onClick={() => setShowModal(false)}
              >
                <FaTimes size={24} />
              </button>
            </div>

            <div className="emergency-modal-body">
              <p className="emergency-warning">
                If you are in immediate danger, call 911 now.
              </p>

              <div className="emergency-resources-grid">
                {emergencyResources.map((resource, index) => (
                  <div 
                    key={index} 
                    className="emergency-resource-card"
                    style={{ borderLeftColor: resource.color }}
                  >
                    <h3>{resource.name}</h3>
                    <p>{resource.description}</p>
                    <a 
                      href={`tel:${resource.phone.replace(/[^0-9]/g, '')}`}
                      className="emergency-call-button"
                      style={{ background: resource.color }}
                    >
                      📞 Call {resource.phone}
                    </a>
                  </div>
                ))}
              </div>

              <div className="emergency-safety-notice">
                <strong>Safety Note:</strong> If someone is monitoring your internet activity, 
                consider calling instead of using online resources. 
                <button 
                  className="quick-exit-button"
                  onClick={() => window.location.href = 'https://www.google.com'}
                >
                  Quick Exit →
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
