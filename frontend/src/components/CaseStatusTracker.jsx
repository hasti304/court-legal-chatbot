import React, { useEffect, useState } from "react";
import { getApiBaseUrl } from "../utils/apiBase";

const GOLD = "#C9A84C";

const STEPS = [
  {
    key: "Submitted",
    label: "Submitted",
    desc: "We have received your intake. Our team will review it shortly.",
  },
  {
    key: "Under Review",
    label: "Under Review",
    desc: "A staff member is currently reviewing your case.",
  },
  {
    key: "Referred",
    label: "Referred",
    desc: "We have connected you with the appropriate legal resources.",
  },
  {
    key: "Closed",
    label: "Closed",
    desc: "Your case has been closed. Contact us if you need further help.",
  },
];

function formatDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

export default function CaseStatusTracker({ intakeId }) {
  const [caseStatus, setCaseStatus] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!intakeId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`${getApiBaseUrl()}/intake/my-case-status`, {
      headers: { "X-Intake-Id": intakeId },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setCaseStatus(data.case_status || "Submitted");
          setUpdatedAt(data.status_updated_at || null);
        } else {
          setCaseStatus("Submitted");
        }
      })
      .catch(() => {
        if (!cancelled) setCaseStatus("Submitted");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [intakeId]);

  if (!intakeId || loading || !caseStatus) return null;

  const currentIndex = STEPS.findIndex((s) => s.key === caseStatus);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;
  const currentStep = STEPS[safeIndex];
  const updatedDateStr = formatDate(updatedAt);

  return (
    <div
      style={{
        background: "var(--cal-bg-card)",
        borderRadius: 12,
        padding: "20px 24px",
        marginBottom: 24,
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      }}
    >
      <h2
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: "var(--cal-text-primary)",
          margin: "0 0 16px",
        }}
      >
        Case Status
      </h2>

      {/* Horizontal stepper */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          overflowX: "auto",
          paddingBottom: 4,
        }}
      >
        {STEPS.map((step, i) => (
          <React.Fragment key={step.key}>
            {/* Step dot + label */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                minWidth: 64,
                flex: "0 0 auto",
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background:
                    i === safeIndex
                      ? GOLD
                      : i < safeIndex
                      ? "#16A34A"
                      : "var(--cal-bg-input, #374151)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  flexShrink: 0,
                  border: i === safeIndex ? `2px solid ${GOLD}` : "2px solid transparent",
                  boxShadow: i === safeIndex ? `0 0 0 3px rgba(201,168,76,0.20)` : "none",
                  transition: "background 0.2s",
                }}
              >
                {i < safeIndex ? "✓" : i + 1}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: i === safeIndex ? 700 : 400,
                  color:
                    i === safeIndex
                      ? GOLD
                      : i < safeIndex
                      ? "var(--cal-text-secondary, #9CA3AF)"
                      : "var(--cal-text-muted, #6B7280)",
                  marginTop: 6,
                  textAlign: "center",
                  lineHeight: 1.3,
                  maxWidth: 64,
                  wordBreak: "break-word",
                }}
              >
                {step.label}
              </div>
            </div>

            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  minWidth: 16,
                  background: i < safeIndex ? "#16A34A" : "var(--cal-bg-input, #374151)",
                  marginTop: 14,
                  transition: "background 0.2s",
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Description of current step */}
      <div
        style={{
          marginTop: 16,
          padding: "10px 14px",
          background: "rgba(201,168,76,0.08)",
          borderLeft: `3px solid ${GOLD}`,
          borderRadius: "0 6px 6px 0",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--cal-text-secondary, #9CA3AF)",
            lineHeight: 1.5,
          }}
        >
          {currentStep.desc}
        </p>
      </div>

      {/* Last updated */}
      {updatedDateStr && (
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 12,
            color: "var(--cal-text-muted, #6B7280)",
          }}
        >
          Last updated: {updatedDateStr}
        </p>
      )}
    </div>
  );
}
