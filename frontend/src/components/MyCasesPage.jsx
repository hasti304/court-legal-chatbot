import React, { useState, useEffect } from "react";
import { FolderOpen, ChevronRight, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { getApiBaseUrl } from "../utils/apiBase";

const GOLD = "#C9A84C";
const CASES_KEY = "cal_cases_history_v1";

const TOPIC_LABELS = {
  housing: "Housing", divorce: "Divorce", custody: "Child Custody",
  child_support: "Child Support", education: "Education", general: "General Legal",
};

function formatDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return ""; }
}

function StatusBadge({ status }) {
  const configs = {
    complete: { label: "Completed", bg: "#16a34a", color: "#fff" },
    in_progress: { label: "In Progress", bg: GOLD, color: "#1A1A1A" },
    flagged: { label: "Flagged", bg: "#DC2626", color: "#fff" },
  };
  const cfg = configs[status] || configs.in_progress;
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      borderRadius: 12, fontSize: 11, fontWeight: 700,
      padding: "3px 10px", display: "inline-block",
    }}>{cfg.label}</span>
  );
}

function CaseDetailModal({ caseItem, onClose }) {
  const topic = TOPIC_LABELS[caseItem.topic] || caseItem.topic || "General";
  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 9999, padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--cal-bg-card)", borderRadius: 12, padding: 32,
          maxWidth: 520, width: "100%", maxHeight: "80vh", overflowY: "auto",
          boxShadow: "0 8px 32px rgba(0,0,0,0.20)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--cal-text-primary)", marginTop: 0, marginBottom: 8 }}>
          Case Summary
        </h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          <span style={{ background: GOLD, color: "#1A1A1A", borderRadius: 4, fontSize: 11, fontWeight: 600, padding: "2px 8px" }}>
            {topic}
          </span>
          <StatusBadge status={caseItem.status} />
          <span style={{ fontSize: 12, color: "var(--cal-text-muted)" }}>{formatDate(caseItem.date)}</span>
        </div>
        {caseItem.riskScore != null && (
          <p style={{ fontSize: 14, color: "var(--cal-text-secondary)", marginBottom: 12 }}>
            Risk Score: <strong>{caseItem.riskScore}/100</strong>
          </p>
        )}
        {caseItem.referrals && caseItem.referrals.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--cal-text-primary)", marginBottom: 8 }}>Matched Resources:</p>
            {caseItem.referrals.map((ref, i) => (
              <div key={i} style={{
                background: "var(--cal-bg-input)", borderRadius: 8, padding: "10px 14px",
                marginBottom: 8, fontSize: 13,
              }}>
                <p style={{ fontWeight: 600, color: "var(--cal-text-primary)", margin: "0 0 4px" }}>{ref.name}</p>
                {ref.phone && <p style={{ color: "var(--cal-text-secondary)", margin: "0 0 2px" }}>{ref.phone}</p>}
                {ref.url && (
                  <a href={ref.url} target="_blank" rel="noopener noreferrer"
                    style={{ color: GOLD, fontSize: 12, fontWeight: 600 }}>Visit Website</a>
                )}
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "transparent", border: `1px solid ${GOLD}`,
            color: GOLD, fontWeight: 700, borderRadius: 8,
            padding: "10px 24px", cursor: "pointer", fontSize: 14,
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

export function loadCasesFromStorage() {
  try { return JSON.parse(localStorage.getItem(CASES_KEY) || "[]"); } catch { return []; }
}

export function saveCaseToStorage(caseData) {
  try {
    const all = loadCasesFromStorage();
    const idx = all.findIndex((c) => c.id === caseData.id);
    if (idx >= 0) { all[idx] = caseData; }
    else { all.unshift(caseData); }
    localStorage.setItem(CASES_KEY, JSON.stringify(all.slice(0, 20)));
  } catch {}
}

export default function MyCasesPage({ intakeId, onStartConsultation, onResume }) {
  const [cases, setCases] = useState([]);
  const [detailCase, setDetailCase] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!intakeId) return;
    setLoading(true);
    fetch(`${getApiBaseUrl()}/intake/my-sessions`, {
      headers: { "X-Intake-Id": intakeId },
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCases(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [intakeId]);

  if (loading) {
    return (
      <div style={{ background: "var(--cal-bg-page)", minHeight: "100%", padding: "32px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--cal-text-primary)", marginBottom: 4 }}>My Cases</h1>
          <p style={{ color: "var(--cal-text-muted)", fontSize: 14, textAlign: "center", padding: "56px 0" }}>Loading your cases…</p>
        </div>
      </div>
    );
  }

  if (cases.length === 0) {
    return (
      <div style={{ background: "var(--cal-bg-page)", minHeight: "100%", padding: "32px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--cal-text-primary)", marginBottom: 4 }}>My Cases</h1>
          <p style={{ color: "var(--cal-text-muted)", fontSize: 14, marginBottom: 40 }}>
            Your legal consultations and matched resources.
          </p>
          <div style={{ textAlign: "center", padding: "56px 24px" }}>
            <FolderOpen style={{ color: GOLD, width: 48, height: 48, margin: "0 auto 16px", display: "block" }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--cal-text-primary)", marginBottom: 8 }}>No cases yet</h3>
            <p style={{ color: "var(--cal-text-muted)", fontSize: 14, marginBottom: 24 }}>
              Start a consultation to get matched with legal resources.
            </p>
            <button
              type="button"
              onClick={onStartConsultation}
              style={{
                background: GOLD, color: "#1A1A1A", fontWeight: 700,
                borderRadius: 8, padding: "11px 28px",
                border: "none", cursor: "pointer", fontSize: 14,
              }}
            >
              Start Consultation
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--cal-bg-page)", minHeight: "100%", padding: "32px 24px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--cal-text-primary)", marginBottom: 4 }}>My Cases</h1>
        <p style={{ color: "var(--cal-text-muted)", fontSize: 14, marginBottom: 28 }}>
          Your legal consultations and matched resources.
        </p>
        {cases.map((c) => {
          const topic = TOPIC_LABELS[c.topic] || c.topic || "General Legal";
          return (
            <div key={c.id} style={{
              background: "var(--cal-bg-card)", borderRadius: 12,
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              padding: "20px 24px", marginBottom: 14,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{
                      background: GOLD, color: "#1A1A1A", borderRadius: 4,
                      fontSize: 11, fontWeight: 600, padding: "2px 8px",
                    }}>{topic}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <p style={{ color: "var(--cal-text-muted)", fontSize: 13, margin: "4px 0" }}>
                    {formatDate(c.date)}
                  </p>
                  {c.riskScore != null && (
                    <p style={{ color: "var(--cal-text-secondary)", fontSize: 13, margin: "2px 0" }}>
                      Risk Score: <strong>{c.riskScore}/100</strong>
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setDetailCase(c)}
                    style={{
                      background: "transparent", border: `1px solid ${GOLD}`,
                      color: GOLD, fontWeight: 700, borderRadius: 8,
                      padding: "7px 16px", cursor: "pointer", fontSize: 13,
                    }}
                  >
                    View details
                  </button>
                  {c.status !== "complete" && (
                    <button
                      type="button"
                      onClick={onResume}
                      style={{
                        background: GOLD, color: "#1A1A1A", fontWeight: 700,
                        borderRadius: 8, padding: "7px 16px",
                        border: "none", cursor: "pointer", fontSize: 13,
                      }}
                    >
                      Resume
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {detailCase && <CaseDetailModal caseItem={detailCase} onClose={() => setDetailCase(null)} />}
    </div>
  );
}
