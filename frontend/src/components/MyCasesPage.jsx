import React, { useState, useEffect, useRef } from "react";
import { FolderOpen, Upload, FileText } from "lucide-react";
import { getApiBaseUrl } from "../utils/apiBase";
import CaseStatusTracker from "./CaseStatusTracker";

const GOLD = "#C9A84C";
const CASES_KEY = "cal_cases_history_v1";
const MAX_SIZE_BYTES = 7 * 1024 * 1024;
const ALLOWED_EXTS = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"];

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

function UploadDocumentModal({ caseItem, authIntakeId, onClose, onUploaded }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = "." + String(file.name || "").toLowerCase().split(".").pop();
    if (!ALLOWED_EXTS.includes(ext)) {
      setStatus("error");
      setMessage("Unsupported file type. Allowed: PDF, JPG, PNG, DOC, DOCX.");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setStatus("error");
      setMessage("File is too large. Max size is 7 MB.");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setStatus("");
    setMessage("");
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || uploading) return;
    setUploading(true);
    setStatus("");
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("intake_id", caseItem.id);
      formData.append("document_context", description.trim());
      const resp = await fetch(`${getApiBaseUrl()}/documents/upload`, {
        method: "POST",
        headers: { "X-Intake-Id": authIntakeId },
        body: formData,
      });
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(payload?.detail || "Upload failed.");
      setStatus("success");
      setMessage("Document uploaded successfully.");
      onUploaded({
        id: payload.file_id,
        file_name: payload.file_name || selectedFile.name,
        uploaded_at: new Date().toISOString(),
        description: description.trim(),
        file_size: payload.file_size || selectedFile.size,
      });
      setSelectedFile(null);
      setDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setStatus("error");
      setMessage(err?.message ? String(err.message) : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

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
          background: "var(--cal-bg-card)", borderRadius: 12, padding: 28,
          maxWidth: 480, width: "100%",
          boxShadow: "0 8px 32px rgba(0,0,0,0.20)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--cal-text-primary)", marginTop: 0, marginBottom: 4 }}>
          Upload Document
        </h2>
        <p style={{ fontSize: 13, color: "var(--cal-text-muted)", marginTop: 0, marginBottom: 20 }}>
          {topic} · {formatDate(caseItem.date)}
        </p>

        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--cal-text-primary)", marginBottom: 6 }}>
          File
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          onChange={handleFileChange}
          disabled={uploading}
          style={{
            display: "block", width: "100%", fontSize: 13,
            marginBottom: 16, color: "var(--cal-text-secondary)",
          }}
        />

        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--cal-text-primary)", marginBottom: 6 }}>
          Description
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this document"
          maxLength={120}
          disabled={uploading}
          style={{
            width: "100%", boxSizing: "border-box",
            padding: "10px 12px", borderRadius: 8,
            border: "1px solid var(--cal-border, #ddd)",
            background: "var(--cal-bg-input)", color: "var(--cal-text-primary)",
            fontSize: 13, marginBottom: 16,
          }}
        />

        {status && (
          <p style={{
            fontSize: 13, marginBottom: 16,
            color: status === "success" ? "#16a34a" : "#DC2626",
          }}>
            {message}
          </p>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            style={{
              background: "transparent", border: `1px solid ${GOLD}`,
              color: GOLD, fontWeight: 700, borderRadius: 8,
              padding: "9px 20px", cursor: uploading ? "not-allowed" : "pointer", fontSize: 13,
              opacity: uploading ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            style={{
              background: GOLD, color: "#1A1A1A", fontWeight: 700,
              borderRadius: 8, padding: "9px 20px",
              border: "none", cursor: (!selectedFile || uploading) ? "not-allowed" : "pointer",
              fontSize: 13, opacity: (!selectedFile || uploading) ? 0.6 : 1,
            }}
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </div>
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

async function fetchCaseDocuments(caseId, authIntakeId) {
  const resp = await fetch(`${getApiBaseUrl()}/documents/list/${encodeURIComponent(caseId)}`, {
    headers: { "X-Intake-Id": authIntakeId },
  });
  if (!resp.ok) return [];
  const data = await resp.json().catch(() => ({}));
  return Array.isArray(data.files) ? data.files : [];
}

export default function MyCasesPage({ intakeId, onStartConsultation, onResume }) {
  const [cases, setCases] = useState([]);
  const [detailCase, setDetailCase] = useState(null);
  const [uploadCase, setUploadCase] = useState(null);
  const [caseDocuments, setCaseDocuments] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!intakeId) return;
    setLoading(true);
    fetch(`${getApiBaseUrl()}/intake/my-sessions`, {
      headers: { "X-Intake-Id": intakeId },
    })
      .then((r) => r.json())
      .then(async (data) => {
        if (!Array.isArray(data)) return;
        setCases(data);
        const docsMap = {};
        await Promise.all(
          data.map(async (c) => {
            docsMap[c.id] = await fetchCaseDocuments(c.id, intakeId);
          }),
        );
        setCaseDocuments(docsMap);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [intakeId]);

  const handleDocumentUploaded = (caseId, doc) => {
    setCaseDocuments((prev) => ({
      ...prev,
      [caseId]: [doc, ...(prev[caseId] || [])],
    }));
  };

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
          <p style={{ color: "var(--cal-text-muted)", fontSize: 14, marginBottom: 24 }}>
            Your legal consultations and matched resources.
          </p>
          <CaseStatusTracker intakeId={intakeId} />
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
        <p style={{ color: "var(--cal-text-muted)", fontSize: 14, marginBottom: 24 }}>
          Your legal consultations and matched resources.
        </p>
        <CaseStatusTracker intakeId={intakeId} />
        {cases.map((c) => {
          const topic = TOPIC_LABELS[c.topic] || c.topic || "General Legal";
          const docs = caseDocuments[c.id] || [];
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
                    onClick={() => setUploadCase(c)}
                    style={{
                      background: "transparent", border: `1px solid ${GOLD}`,
                      color: GOLD, fontWeight: 700, borderRadius: 8,
                      padding: "7px 16px", cursor: "pointer", fontSize: 13,
                      display: "inline-flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <Upload size={14} />
                    Upload Document
                  </button>
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
              {docs.length > 0 && (
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--cal-border, #eee)" }}>
                  <p style={{
                    fontSize: 12, fontWeight: 700, color: "var(--cal-text-primary)",
                    margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>
                    Uploaded Documents
                  </p>
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {docs.map((doc) => (
                      <li key={doc.id || doc.file_name} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        fontSize: 13, color: "var(--cal-text-secondary)",
                        padding: "4px 0",
                      }}>
                        <FileText size={14} style={{ color: GOLD, flexShrink: 0 }} />
                        <span style={{ color: "var(--cal-text-primary)", fontWeight: 500 }}>
                          {doc.file_name}
                        </span>
                        {doc.description && (
                          <span style={{ color: "var(--cal-text-muted)" }}>— {doc.description}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {detailCase && <CaseDetailModal caseItem={detailCase} onClose={() => setDetailCase(null)} />}
      {uploadCase && (
        <UploadDocumentModal
          caseItem={uploadCase}
          authIntakeId={intakeId}
          onClose={() => setUploadCase(null)}
          onUploaded={(doc) => handleDocumentUploaded(uploadCase.id, doc)}
        />
      )}
    </div>
  );
}
