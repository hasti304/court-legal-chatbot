import React from "react";
import { QRCodeSVG } from "qrcode.react";

function QRResumeCard({ sessionToken }) {
  const resumeUrl = `https://court-legal-chatbot.vercel.app/?session=${encodeURIComponent(sessionToken)}`;

  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "10px",
        marginTop: "8px",
      }}
    >
      <p
        style={{
          fontSize: "0.8125rem",
          color: "#475569",
          textAlign: "center",
          margin: 0,
          lineHeight: 1.4,
        }}
      >
        Scan this code to continue on your phone. Your progress will transfer automatically.
      </p>
      <div
        style={{
          padding: "8px",
          background: "#fff",
          borderRadius: "8px",
          border: "1px solid #e2e8f0",
        }}
      >
        <QRCodeSVG value={resumeUrl} size={148} level="M" includeMargin={false} />
      </div>
      <p style={{ fontSize: "0.75rem", color: "#94a3b8", margin: 0 }}>
        Code expires in 24 hours
      </p>
    </div>
  );
}

export default QRResumeCard;
