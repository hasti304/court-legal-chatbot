import React, { useMemo, useState } from "react";
import { getApiBaseUrl } from "../utils/apiBase";

const API_BASE = getApiBaseUrl();

const TEMPLATE_LABELS = {
  demand_letter: "Demand Letter",
  lease_termination: "Lease Termination Letter",
  nda_template: "Mutual NDA (Basic)",
  complaint_draft: "Complaint Draft (Starter)",
};

const TOPIC_DEFAULT_TEMPLATE = {
  housing: "lease_termination",
  education: "demand_letter",
  child_support: "complaint_draft",
  divorce: "complaint_draft",
  custody: "complaint_draft",
  general: "demand_letter",
};

const TEMPLATES = {
  demand_letter: `{{today}}

To: {{recipient_name}}
Address: {{recipient_address}}

Subject: {{subject_line}}

Dear {{recipient_name}},

I am writing regarding: {{issue_summary}}.

I request the following action: {{requested_action}}.
Please respond by {{deadline}}.

Supporting details:
{{additional_notes}}

Sincerely,
{{sender_name}}
{{sender_email}}
{{sender_phone}}`,
  lease_termination: `{{today}}

To: {{recipient_name}}
Address: {{recipient_address}}

Subject: Notice of Lease Termination

Dear {{recipient_name}},

This letter serves as formal notice that I intend to terminate my lease regarding:
{{subject_line}}.

Reason / context:
{{issue_summary}}

Requested next step:
{{requested_action}}

Requested effective date / deadline:
{{deadline}}

Additional details:
{{additional_notes}}

Sincerely,
{{sender_name}}
{{sender_email}}
{{sender_phone}}`,
  nda_template: `MUTUAL NON-DISCLOSURE AGREEMENT (BASIC)
Date: {{today}}

Party 1: {{sender_name}}
Party 2: {{recipient_name}}

Purpose:
{{subject_line}}

Confidential Information:
{{issue_summary}}

Obligations:
- Use information only for the stated purpose.
- Do not disclose to third parties without permission.
- Protect information with reasonable care.

Term / Deadline:
{{deadline}}

Notes:
{{additional_notes}}

Signatures:
{{sender_name}} ____________________
{{recipient_name}} ____________________`,
  complaint_draft: `{{today}}

IN THE APPROPRIATE COURT

Plaintiff: {{sender_name}}
Defendant: {{recipient_name}}

Case Topic:
{{subject_line}}

FACTS:
{{issue_summary}}

RELIEF REQUESTED:
{{requested_action}}

IMPORTANT DATE / DEADLINE:
{{deadline}}

SUPPORTING NOTES:
{{additional_notes}}

Respectfully submitted,
{{sender_name}}
{{sender_email}}
{{sender_phone}}`,
};

const todayLabel = () =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date());

const buildDocFromTemplate = (template, values) => {
  let output = String(template || "");
  Object.entries(values).forEach(([key, value]) => {
    const safeValue = String(value || "").trim() || "—";
    output = output.replaceAll(`{{${key}}}`, safeValue);
  });
  return output;
};

const sanitizeFilename = (name) =>
  String(name || "document")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || "");
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error("File read failed"));
    reader.readAsDataURL(blob);
  });

const MAX_UPLOAD_SIZE_BYTES = 7 * 1024 * 1024;
const ALLOWED_UPLOAD_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg", ".doc", ".docx", ".txt"];

export default function DocumentGeneratorPanel({ topic = "general", intakeId = "" }) {
  const [templateId, setTemplateId] = useState(
    TOPIC_DEFAULT_TEMPLATE[String(topic || "general")] || "demand_letter"
  );
  const [form, setForm] = useState({
    sender_name: "",
    sender_email: "",
    delivery_email: "",
    sender_phone: "",
    recipient_name: "",
    recipient_address: "",
    subject_line: "",
    issue_summary: "",
    requested_action: "",
    deadline: "",
    additional_notes: "",
  });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedUpload, setSelectedUpload] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  const documentText = useMemo(() => {
    const template = TEMPLATES[templateId] || TEMPLATES.demand_letter;
    return buildDocFromTemplate(template, {
      today: todayLabel(),
      ...form,
    });
  }, [templateId, form]);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const createPdfBlob = async () => {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({
      unit: "pt",
      format: "a4",
    });
    const margin = 40;
    const maxWidth = 515;
    const lines = pdf.splitTextToSize(documentText, maxWidth);
    pdf.setFont("times", "normal");
    pdf.setFontSize(12);
    let y = margin;
    lines.forEach((line) => {
      if (y > 780) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(line, margin, y);
      y += 18;
    });
    return pdf.output("blob");
  };

  const handleDownloadPdf = async () => {
    try {
      const blob = await createPdfBlob();
      const filename = `${sanitizeFilename(TEMPLATE_LABELS[templateId] || "document")}-${Date.now()}.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("PDF downloaded.");
    } catch {
      setStatus("Could not generate PDF. Please try again.");
    }
  };

  const handleEmailDocument = async () => {
    const toEmail = String(form.delivery_email || "").trim().toLowerCase();
    const senderCopyEmail = String(form.sender_email || "").trim().toLowerCase();
    if (!toEmail || !toEmail.includes("@")) {
      setStatus("Enter a valid recipient email (court contact or person receiving this draft).");
      return;
    }
    if (!senderCopyEmail || !senderCopyEmail.includes("@")) {
      setStatus("Enter your email so we can send you a copy.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const blob = await createPdfBlob();
      const base64 = await blobToBase64(blob);
      const filename = `${sanitizeFilename(TEMPLATE_LABELS[templateId] || "document")}.pdf`;
      const htmlBody = `<p>Your generated legal draft is attached.</p><pre style="white-space:pre-wrap;font-family:system-ui,sans-serif;">${documentText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</pre>`;
      const payloadFor = (email) => ({
        to_email: email,
        subject: `${TEMPLATE_LABELS[templateId]} draft`,
        body_text: `Your generated legal draft is attached.\n\n${documentText}`,
        html_body: htmlBody,
        attachment_filename: filename,
        attachment_base64: base64,
        intake_id: intakeId || null,
      });
      const targets = [toEmail];
      if (senderCopyEmail !== toEmail) targets.push(senderCopyEmail);

      const results = await Promise.all(
        targets.map(async (email) => {
          const response = await fetch(`${API_BASE}/documents/email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payloadFor(email)),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            throw new Error(payload?.detail ? String(payload.detail) : `Unable to send email to ${email}.`);
          }
          return payload?.email_sent === true;
        })
      );

      if (results.every(Boolean)) {
        setStatus("Email sent to recipient and a copy sent to you.");
      } else {
        setStatus(
          "Email provider is not configured on the server. Configure RESEND_API_KEY or SMTP to enable delivery."
        );
      }
    } catch (err) {
      setStatus(err?.message ? String(err.message) : "Unable to send email right now.");
    } finally {
      setBusy(false);
    }
  };

  const handleUploadDocument = async () => {
    if (!selectedUpload) {
      setStatus("Choose a file to upload first.");
      return;
    }
    if (!intakeId) {
      setStatus("Please complete intake/login before uploading evidence.");
      return;
    }
    const name = String(selectedUpload.name || "").toLowerCase();
    const hasAllowedExt = ALLOWED_UPLOAD_EXTENSIONS.some((ext) => name.endsWith(ext));
    if (!hasAllowedExt) {
      setStatus("Unsupported file type. Allowed: PDF, PNG, JPG, DOC, DOCX, TXT.");
      return;
    }
    if (Number(selectedUpload.size || 0) > MAX_UPLOAD_SIZE_BYTES) {
      setStatus("File is too large. Max upload size is 7 MB.");
      return;
    }
    setUploadBusy(true);
    setStatus("");
    try {
      const formData = new FormData();
      formData.append("file", selectedUpload);
      formData.append("intake_id", intakeId || "");
      formData.append("document_context", templateId);
      const response = await fetch(`${API_BASE}/documents/upload`, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.detail ? String(payload.detail) : "Upload failed.");
      }
      setSelectedUpload(null);
      setStatus("Document uploaded successfully. Staff can review it with your intake.");
    } catch (err) {
      setStatus(err?.message ? String(err.message) : "Unable to upload document right now.");
    } finally {
      setUploadBusy(false);
    }
  };

  return (
    <div className="doc-generator-panel">
      <h4 className="doc-generator-title">Document Generator (v1)</h4>
      <p className="doc-generator-disclaimer">
        General information only. Review carefully before using any draft.
      </p>
      <p className="doc-generator-disclaimer">
        Purpose: this tool helps you create a starter draft letter/form from your case details so you can review,
        edit, and send it to the right person (including court contacts when appropriate).
      </p>

      <label className="doc-generator-label" htmlFor="doc-template">
        Template
      </label>
      <select
        id="doc-template"
        className="doc-generator-input"
        value={templateId}
        onChange={(e) => setTemplateId(e.target.value)}
      >
        {Object.entries(TEMPLATE_LABELS).map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>

      <div className="doc-generator-grid">
        <input
          className="doc-generator-input"
          placeholder="Your full name"
          value={form.sender_name}
          onChange={(e) => update("sender_name", e.target.value)}
        />
        <input
          className="doc-generator-input"
          placeholder="Your email"
          value={form.sender_email}
          onChange={(e) => update("sender_email", e.target.value)}
        />
        <input
          className="doc-generator-input"
          placeholder="Send email to (you, court, or court staff)"
          value={form.delivery_email}
          onChange={(e) => update("delivery_email", e.target.value)}
        />
        <input
          className="doc-generator-input"
          placeholder="Your phone"
          value={form.sender_phone}
          onChange={(e) => update("sender_phone", e.target.value)}
        />
        <input
          className="doc-generator-input"
          placeholder="Recipient name"
          value={form.recipient_name}
          onChange={(e) => update("recipient_name", e.target.value)}
        />
      </div>

      <input
        className="doc-generator-input"
        placeholder="Recipient address"
        value={form.recipient_address}
        onChange={(e) => update("recipient_address", e.target.value)}
      />
      <input
        className="doc-generator-input"
        placeholder="Subject / case reference"
        value={form.subject_line}
        onChange={(e) => update("subject_line", e.target.value)}
      />
      <textarea
        className="doc-generator-input doc-generator-textarea"
        placeholder="Issue summary"
        value={form.issue_summary}
        onChange={(e) => update("issue_summary", e.target.value)}
      />
      <textarea
        className="doc-generator-input doc-generator-textarea"
        placeholder="Requested action"
        value={form.requested_action}
        onChange={(e) => update("requested_action", e.target.value)}
      />
      <input
        className="doc-generator-input"
        placeholder="Deadline / date"
        value={form.deadline}
        onChange={(e) => update("deadline", e.target.value)}
      />
      <textarea
        className="doc-generator-input doc-generator-textarea"
        placeholder="Additional notes"
        value={form.additional_notes}
        onChange={(e) => update("additional_notes", e.target.value)}
      />

      <div className="doc-generator-actions">
        <button type="button" className="btn btn-copy-template" onClick={handleDownloadPdf}>
          Download as PDF
        </button>
        <button
          type="button"
          className="btn btn-copy-template"
          disabled={busy}
          onClick={handleEmailDocument}
        >
          {busy ? "Sending..." : "Send by email"}
        </button>
      </div>

      <label className="doc-generator-label" htmlFor="supporting-upload">
        Upload related document (optional)
      </label>
      <input
        id="supporting-upload"
        className="doc-generator-input"
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt"
        onChange={(e) => setSelectedUpload(e.target.files?.[0] || null)}
      />
      <p className="doc-generator-disclaimer">
        Safety note: do not upload highly sensitive originals unless requested by staff. Max file size: 7 MB.
      </p>
      <div className="doc-generator-actions">
        <button
          type="button"
          className="btn btn-copy-template"
          disabled={uploadBusy}
          onClick={handleUploadDocument}
        >
          {uploadBusy ? "Uploading..." : "Upload file"}
        </button>
      </div>

      {status ? <p className="doc-generator-status">{status}</p> : null}
    </div>
  );
}
