import base64
import os
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

try:
    from ..schemas.documents import DocumentEmailRequest
    from ..services.evidence_service import (
        assert_evidence_upload_allowed,
        extract_text_for_file,
        generate_ai_evidence_summary,
        get_evidence_file_for_admin,
        save_evidence_record,
        _extract_key_facts_timeline,
    )
    from ..services.intake_service import log_intake_event
    from ..services.transactional_email import send_transactional_email
except ImportError:
    from schemas.documents import DocumentEmailRequest  # type: ignore
    from services.evidence_service import (  # type: ignore
        assert_evidence_upload_allowed,
        extract_text_for_file,
        generate_ai_evidence_summary,
        get_evidence_file_for_admin,
        save_evidence_record,
        _extract_key_facts_timeline,
    )
    from services.intake_service import log_intake_event  # type: ignore
    from services.transactional_email import send_transactional_email  # type: ignore

router = APIRouter()
MAX_UPLOAD_BYTES = 7 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".doc", ".docx", ".txt"}
ALLOWED_MIME_BY_EXTENSION = {
    ".pdf": {"application/pdf"},
    ".png": {"image/png"},
    ".jpg": {"image/jpeg"},
    ".jpeg": {"image/jpeg"},
    ".doc": {"application/msword"},
    ".docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"},
    ".txt": {"text/plain"},
}
UPLOAD_ROOT = Path(__file__).resolve().parents[1] / "uploads" / "documents"


def _looks_like_expected_file(content: bytes, ext: str) -> bool:
    sig = content[:12]
    e = (ext or "").lower()
    if e == ".pdf":
        return sig.startswith(b"%PDF")
    if e == ".png":
        return sig.startswith(b"\x89PNG\r\n\x1a\n")
    if e in {".jpg", ".jpeg"}:
        return sig.startswith(b"\xff\xd8")
    if e == ".docx":
        return sig.startswith(b"PK\x03\x04")
    if e == ".doc":
        # Legacy .doc signature can vary; extension+mime validation used primarily.
        return True
    if e == ".txt":
        return True
    return False


@router.post("/documents/email")
def send_document_email(req: DocumentEmailRequest):
    attachment_bytes = None
    attachment_name = (req.attachment_filename or "").strip()
    encoded = (req.attachment_base64 or "").strip()

    if encoded:
        if not attachment_name:
            raise HTTPException(status_code=400, detail="attachment_filename is required when attachment_base64 is provided")
        try:
            attachment_bytes = base64.b64decode(encoded, validate=True)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid attachment_base64")
        if len(attachment_bytes) > 3 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Attachment too large (max 3 MB)")

    ok = send_transactional_email(
        to_email=req.to_email,
        subject=req.subject,
        text_body=req.body_text,
        html_body=req.html_body or req.body_text.replace("\n", "<br/>"),
        attachment_bytes=attachment_bytes,
        attachment_filename=attachment_name,
        attachment_content_type="application/pdf",
    )
    if ok:
        log_intake_event(req.intake_id, "document_emailed", attachment_name or "text_only")
    return {"ok": True, "email_sent": ok}


@router.post("/documents/upload")
async def upload_supporting_document(
    file: UploadFile = File(...),
    intake_id: str = Form(...),
    document_context: str = Form(default=""),
):
    original_name = (file.filename or "").strip()
    if not original_name:
        raise HTTPException(status_code=400, detail="File name is required")

    ext = Path(original_name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Allowed: PDF, PNG, JPG, DOC, DOCX, TXT.",
        )

    content = await file.read()
    size = len(content or b"")
    if size <= 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if size > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 7 MB)")
    content_type = (file.content_type or "").strip().lower()
    allowed_mimes = ALLOWED_MIME_BY_EXTENSION.get(ext, set())
    if content_type and allowed_mimes and content_type not in allowed_mimes:
        raise HTTPException(
            status_code=400,
            detail=f"File type mismatch. Expected {', '.join(sorted(allowed_mimes))}.",
        )
    if not _looks_like_expected_file(content, ext):
        raise HTTPException(status_code=400, detail="File content does not match the selected file type.")

    safe_base = Path(original_name).stem
    safe_base = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in safe_base).strip("_")
    if not safe_base:
        safe_base = "document"
    intake_value = (intake_id or "").strip()
    assert_evidence_upload_allowed(intake_value, size)

    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    saved_name = f"{os.urandom(10).hex()}_{safe_base[:80]}{ext}"
    saved_path = UPLOAD_ROOT / saved_name
    with open(saved_path, "wb") as out:
        out.write(content)

    context = (document_context or "").strip()
    extracted = extract_text_for_file(ext, content)
    ai_summary = generate_ai_evidence_summary(extracted, language="en")
    if not ai_summary:
        ai_summary = (
            f"Evidence file uploaded: {original_name}. "
            "AI summary unavailable; please review the source document."
        )
    uploaded_at = datetime.now(timezone.utc).isoformat()
    key_facts = _extract_key_facts_timeline(extracted, uploaded_at, original_name)
    safety_notice = (
        "This summary is automatically generated for informational review only. "
        "Verify facts directly from the source file before legal use."
    )
    evidence_id = save_evidence_record(
        intake_id=intake_value,
        original_name=original_name,
        stored_name=saved_name,
        extension=ext,
        file_size=size,
        mime_type=file.content_type or "",
        document_context=context,
        extracted_text=extracted,
        ai_summary=ai_summary,
        key_facts=key_facts,
        safety_notice=safety_notice,
    )
    event_value = f"{saved_name}|{size}|{context[:120]}"
    log_intake_event(intake_value, "supporting_document_uploaded", event_value)

    return {
        "ok": True,
        "file_id": evidence_id,
        "file_name": original_name,
        "stored_name": saved_name,
        "file_size": size,
        "summary": ai_summary,
        "key_facts": key_facts[:6],
        "safety_notice": safety_notice,
    }


@router.get("/documents/file/{evidence_id}")
def get_uploaded_document(evidence_id: str, request: Request):
    return get_evidence_file_for_admin(request, evidence_id)
