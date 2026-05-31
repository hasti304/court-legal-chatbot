import React, { useState, useRef, useEffect } from "react";
import { Upload, FileText, FileImage, File, Download, Trash2 } from "lucide-react";
import { getApiBaseUrl } from "../utils/apiBase";

const GOLD = "#C9A84C";
const DOCS_STORAGE_KEY = "cal_uploaded_docs_v1";
const MAX_SIZE_BYTES = 7 * 1024 * 1024;
const ALLOWED_EXTS = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"];

function getStoredDocs(intakeId) {
  try {
    const all = JSON.parse(localStorage.getItem(DOCS_STORAGE_KEY) || "{}");
    return Array.isArray(all[intakeId]) ? all[intakeId] : [];
  } catch {
    return [];
  }
}

export function saveDocToStorage(intakeId, doc) {
  try {
    const all = JSON.parse(localStorage.getItem(DOCS_STORAGE_KEY) || "{}");
    const existing = Array.isArray(all[intakeId]) ? all[intakeId] : [];
    all[intakeId] = [doc, ...existing];
    localStorage.setItem(DOCS_STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

function removeDocFromStorage(intakeId, fileId) {
  try {
    const all = JSON.parse(localStorage.getItem(DOCS_STORAGE_KEY) || "{}");
    const existing = Array.isArray(all[intakeId]) ? all[intakeId] : [];
    all[intakeId] = existing.filter((d) => d.file_id !== fileId);
    localStorage.setItem(DOCS_STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

function getFileIcon(filename) {
  const ext = String(filename || "").toLowerCase().split(".").pop();
  if (ext === "pdf") return <FileText className="w-5 h-5 shrink-0" style={{ color: GOLD }} />;
  if (["jpg", "jpeg", "png"].includes(ext)) return <FileImage className="w-5 h-5 shrink-0" style={{ color: GOLD }} />;
  return <File className="w-5 h-5 shrink-0" style={{ color: GOLD }} />;
}

function formatSize(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(isoString) {
  if (!isoString) return "";
  try {
    return new Date(isoString).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch {
    return isoString;
  }
}

export default function DocumentsPage({ intakeId }) {
  const [docs, setDocs] = useState(() => getStoredDocs(intakeId || ""));
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setDocs(getStoredDocs(intakeId || ""));
  }, [intakeId]);

  const handleFileSelect = (file) => {
    if (!file) return;
    const ext = "." + String(file.name || "").toLowerCase().split(".").pop();
    if (!ALLOWED_EXTS.includes(ext)) {
      setUploadStatus("error");
      setUploadMessage("Unsupported file type. Allowed: PDF, JPG, PNG, DOCX. Max size: 7MB.");
      setSelectedFile(null);
      return;
    }
    setUploadStatus("");
    setUploadMessage("");
    setSelectedFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || uploading) return;
    if (!intakeId) {
      setUploadStatus("error");
      setUploadMessage("Please complete your consultation intake before uploading documents.");
      return;
    }
    if (selectedFile.size > MAX_SIZE_BYTES) {
      setUploadStatus("error");
      setUploadMessage("File is too large. Max size is 7MB.");
      return;
    }
    setUploading(true);
    setUploadStatus("");
    setUploadMessage("");
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("intake_id", intakeId);
      formData.append("document_context", "user_documents_page");
      const resp = await fetch(`${getApiBaseUrl()}/documents/upload`, {
        method: "POST",
        headers: { "X-Intake-Id": intakeId },
        body: formData,
      });
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(payload?.detail || "Upload failed.");
      const newDoc = {
        file_id: payload.file_id,
        file_name: payload.file_name || selectedFile.name,
        file_size: payload.file_size || selectedFile.size,
        uploaded_at: new Date().toISOString(),
      };
      saveDocToStorage(intakeId, newDoc);
      setDocs(getStoredDocs(intakeId));
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadStatus("success");
      setUploadMessage("File uploaded successfully");
    } catch (err) {
      setUploadStatus("error");
      setUploadMessage("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (fileId) => {
    removeDocFromStorage(intakeId || "", fileId);
    setDocs(getStoredDocs(intakeId || ""));
    setConfirmDeleteId(null);
  };

  return (
    <div style={{ background: "var(--cal-bg-page)", minHeight: "100%", padding: "32px 24px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--cal-text-primary)", marginBottom: 4 }}>
          My Documents
        </h1>
        <p style={{ color: "var(--cal-text-muted)", marginBottom: 28, fontSize: 14 }}>
          Upload and manage documents related to your legal case. Do not upload highly sensitive originals unless requested by staff.
        </p>

        {/* Upload Card */}
        <div style={{
          background: "var(--cal-bg-card)", borderRadius: 12,
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)", padding: 24, marginBottom: 20,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--cal-text-primary)", marginBottom: 16 }}>
            Upload a Document
          </h2>

          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            style={{
              border: `2px dashed ${GOLD}`,
              borderRadius: 8,
              background: dragOver ? "rgba(201,168,76,0.08)" : "var(--cal-bg-input)",
              padding: "36px 24px",
              textAlign: "center",
              cursor: "pointer",
              transition: "background 0.15s",
              marginBottom: 8,
            }}
          >
            <Upload style={{ color: GOLD, margin: "0 auto 10px", display: "block", width: 28, height: 28 }} />
            <p style={{ color: "var(--cal-text-secondary)", fontWeight: 500, fontSize: 14, margin: 0 }}>
              Drag and drop a file here, or click to browse
            </p>
          </div>
          <p style={{ fontSize: 12, color: "var(--cal-text-muted)", marginBottom: 16 }}>
            Accepted formats: PDF, JPG, PNG, DOCX. Max size: 7MB.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            style={{ display: "none" }}
            onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
          />

          {selectedFile && (
            <div style={{
              background: "var(--cal-bg-input)", borderRadius: 8, padding: "8px 12px",
              marginBottom: 12, display: "flex", alignItems: "center", gap: 10,
            }}>
              {getFileIcon(selectedFile.name)}
              <span style={{ color: "var(--cal-text-primary)", fontWeight: 500, fontSize: 14, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selectedFile.name}
              </span>
              <span style={{ color: "var(--cal-text-muted)", fontSize: 12, flexShrink: 0 }}>
                {formatSize(selectedFile.size)}
              </span>
            </div>
          )}

          {uploadStatus === "success" && (
            <p style={{ color: "#16a34a", fontWeight: 500, fontSize: 14, marginBottom: 12 }}>
              {uploadMessage}
            </p>
          )}
          {uploadStatus === "error" && (
            <p style={{ color: "#DC2626", fontWeight: 500, fontSize: 14, marginBottom: 12 }}>
              {uploadMessage}
            </p>
          )}

          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            style={{
              background: selectedFile && !uploading ? GOLD : "var(--cal-border)",
              color: selectedFile && !uploading ? "#1A1A1A" : "var(--cal-text-muted)",
              fontWeight: 700,
              borderRadius: 8,
              padding: "10px 24px",
              border: "none",
              cursor: selectedFile && !uploading ? "pointer" : "not-allowed",
              fontSize: 14,
              transition: "background 0.15s",
            }}
          >
            {uploading ? "Uploading…" : "Upload file"}
          </button>
        </div>

        {/* Documents List Card */}
        <div style={{
          background: "var(--cal-bg-card)", borderRadius: 12,
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)", padding: 24,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--cal-text-primary)", marginBottom: 16 }}>
            Your Documents
          </h2>

          {docs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px" }}>
              <Upload style={{
                color: GOLD, width: 40, height: 40,
                margin: "0 auto 14px", display: "block",
              }} />
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--cal-text-primary)", marginBottom: 6 }}>
                No documents yet
              </h3>
              <p style={{ color: "var(--cal-text-muted)", fontSize: 14 }}>
                Upload your first document above
              </p>
            </div>
          ) : (
            <div>
              {docs.map((doc, idx) => (
                <div key={doc.file_id}>
                  {idx > 0 && (
                    <div style={{ height: 1, background: "var(--cal-border)", margin: "12px 0" }} />
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {getFileIcon(doc.file_name)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontWeight: 600, color: "var(--cal-text-primary)", fontSize: 14, margin: 0,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {doc.file_name}
                      </p>
                      <p style={{ color: "var(--cal-text-muted)", fontSize: 12, margin: "2px 0 0" }}>
                        {formatDate(doc.uploaded_at)}
                        {doc.file_size ? ` · ${formatSize(doc.file_size)}` : ""}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                      {confirmDeleteId === doc.file_id ? (
                        <>
                          <span style={{ fontSize: 12, color: "var(--cal-text-secondary)" }}>Are you sure?</span>
                          <button
                            type="button"
                            onClick={() => handleDelete(doc.file_id)}
                            style={{
                              fontSize: 12, color: "#DC2626", background: "none",
                              border: "none", cursor: "pointer", fontWeight: 700,
                            }}
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            style={{
                              fontSize: 12, color: "var(--cal-text-muted)", background: "none",
                              border: "none", cursor: "pointer",
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <a
                            href={`${getApiBaseUrl()}/documents/file/${doc.file_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: 12, color: GOLD, border: `1px solid ${GOLD}`,
                              borderRadius: 6, padding: "4px 10px",
                              textDecoration: "none", fontWeight: 600,
                            }}
                          >
                            Download
                          </a>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(doc.file_id)}
                            style={{
                              fontSize: 12, color: "#DC2626", background: "none",
                              border: "none", cursor: "pointer", fontWeight: 600,
                            }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
