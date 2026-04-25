import json
import os
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy import text

try:
    from ..services.ai_service import language_instruction
    from ..services.config_service import engine, groq_client, groq_configured
    from .intake_service import require_admin_access, utc_now_iso
except ImportError:
    from services.ai_service import language_instruction  # type: ignore
    from services.config_service import engine, groq_client, groq_configured  # type: ignore
    from services.intake_service import require_admin_access, utc_now_iso  # type: ignore


UPLOAD_ROOT = Path(__file__).resolve().parents[1] / "uploads" / "documents"
MAX_FILES_PER_INTAKE = 20
MAX_TOTAL_BYTES_PER_INTAKE = 60 * 1024 * 1024


def ensure_evidence_tables() -> None:
    if not engine:
        return
    create_evidence = """
    CREATE TABLE IF NOT EXISTS evidence_files (
      id TEXT PRIMARY KEY,
      intake_id TEXT NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT,
      extension TEXT,
      file_size INTEGER NOT NULL,
      uploaded_at TEXT NOT NULL,
      uploaded_by TEXT NOT NULL DEFAULT 'user',
      document_context TEXT,
      extracted_text TEXT,
      ai_summary TEXT,
      key_facts_json TEXT NOT NULL DEFAULT '[]',
      safety_notice TEXT,
      FOREIGN KEY (intake_id) REFERENCES intakes(id)
    );
    """
    create_idx = """
    CREATE INDEX IF NOT EXISTS idx_evidence_files_intake_uploaded
    ON evidence_files (intake_id, uploaded_at);
    """
    with engine.begin() as conn:
        conn.execute(text(create_evidence))
        conn.execute(text(create_idx))


def _extract_text_from_txt(content: bytes) -> str:
    for enc in ("utf-8", "latin-1"):
        try:
            return content.decode(enc)
        except Exception:
            continue
    return ""


def _extract_text_from_pdf(content: bytes) -> str:
    try:
        from pypdf import PdfReader  # type: ignore
    except Exception:
        return ""
    try:
        import io

        reader = PdfReader(io.BytesIO(content))
        chunks = []
        for page in reader.pages[:25]:
            chunks.append(page.extract_text() or "")
        return "\n".join(chunks).strip()
    except Exception:
        return ""


def _extract_text_from_docx(content: bytes) -> str:
    try:
        import io

        data = io.BytesIO(content)
        with zipfile.ZipFile(data) as zf:
            xml = zf.read("word/document.xml").decode("utf-8", errors="ignore")
        text_val = re.sub(r"<[^>]+>", " ", xml)
        return re.sub(r"\s+", " ", text_val).strip()
    except Exception:
        return ""


def _extract_text_from_image(content: bytes) -> str:
    try:
        from PIL import Image  # type: ignore
        import io
        import pytesseract  # type: ignore

        img = Image.open(io.BytesIO(content))
        return str(pytesseract.image_to_string(img) or "").strip()
    except Exception:
        return ""


def extract_text_for_file(extension: str, content: bytes) -> str:
    ext = (extension or "").lower()
    if ext == ".txt":
        return _extract_text_from_txt(content)
    if ext == ".pdf":
        return _extract_text_from_pdf(content)
    if ext == ".docx":
        return _extract_text_from_docx(content)
    if ext in {".png", ".jpg", ".jpeg"}:
        return _extract_text_from_image(content)
    return ""


def _extract_key_facts_timeline(text_value: str, uploaded_at: str, source_name: str) -> List[Dict[str, str]]:
    facts: List[Dict[str, str]] = []
    if uploaded_at:
        facts.append(
            {
                "date": uploaded_at[:10],
                "fact": f"Evidence uploaded: {source_name}",
                "source": source_name,
            }
        )
    if not text_value:
        return facts
    lines = [ln.strip() for ln in re.split(r"[\n\r]+", text_value) if ln.strip()]
    date_pattern = re.compile(r"\b(\d{1,2}/\d{1,2}/\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})\b")
    for ln in lines[:200]:
        m = date_pattern.search(ln)
        if not m:
            continue
        facts.append({"date": m.group(1), "fact": ln[:300], "source": source_name})
        if len(facts) >= 12:
            break
    return facts


def _fallback_summary(extracted_text: str, original_name: str) -> str:
    if not extracted_text.strip():
        return (
            f"Uploaded file '{original_name}' has no extracted text yet. "
            "Manual review may be needed (image scan or unsupported format)."
        )
    short = re.sub(r"\s+", " ", extracted_text).strip()[:700]
    return f"Evidence summary (auto): {short}"


def generate_ai_evidence_summary(extracted_text: str, language: str = "en") -> str:
    if not extracted_text.strip():
        return ""
    if not groq_configured or not groq_client:
        return ""
    try:
        prompt = (
            "Summarize this legal evidence in 5 concise bullet points. "
            "Then include a short 'Potential key dates/deadlines' line if any appear."
        )
        response = groq_client.chat.completions.create(
            model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
            messages=[
                {"role": "system", "content": f"You summarize legal evidence safely. {language_instruction(language)}"},
                {"role": "user", "content": f"{prompt}\n\nEvidence text:\n{extracted_text[:6000]}"},
            ],
            temperature=0.1,
        )
        return str((response.choices[0].message.content if response.choices else "") or "").strip()
    except Exception:
        return ""


def save_evidence_record(
    *,
    intake_id: str,
    original_name: str,
    stored_name: str,
    extension: str,
    file_size: int,
    mime_type: str,
    document_context: str,
    extracted_text: str,
    ai_summary: str,
    key_facts: List[Dict[str, str]],
    safety_notice: str,
) -> str:
    if not engine:
        raise HTTPException(status_code=503, detail="Database not configured")
    ensure_evidence_tables()
    uploaded_at = utc_now_iso()
    evidence_id = os.urandom(16).hex()
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM intakes WHERE id = :iid"), {"iid": intake_id}).first()
        if not exists:
            raise HTTPException(status_code=404, detail="Intake not found")
        conn.execute(
            text(
                """
                INSERT INTO evidence_files (
                  id, intake_id, original_name, stored_name, mime_type, extension, file_size,
                  uploaded_at, uploaded_by, document_context, extracted_text, ai_summary,
                  key_facts_json, safety_notice
                ) VALUES (
                  :id, :intake_id, :original_name, :stored_name, :mime_type, :extension, :file_size,
                  :uploaded_at, 'user', :document_context, :extracted_text, :ai_summary,
                  :key_facts_json, :safety_notice
                )
                """
            ),
            {
                "id": evidence_id,
                "intake_id": intake_id,
                "original_name": original_name,
                "stored_name": stored_name,
                "mime_type": mime_type,
                "extension": extension,
                "file_size": int(file_size or 0),
                "uploaded_at": uploaded_at,
                "document_context": document_context[:120],
                "extracted_text": extracted_text[:50000],
                "ai_summary": ai_summary[:12000],
                "key_facts_json": json.dumps(key_facts, ensure_ascii=False),
                "safety_notice": safety_notice[:4000],
            },
        )
    return evidence_id


def assert_evidence_upload_allowed(intake_id: str, incoming_size: int) -> None:
    if not engine:
        raise HTTPException(status_code=503, detail="Database not configured")
    ensure_evidence_tables()
    iid = (intake_id or "").strip()
    if not iid:
        raise HTTPException(status_code=400, detail="intake_id is required")
    with engine.begin() as conn:
        exists = conn.execute(text("SELECT 1 FROM intakes WHERE id = :iid"), {"iid": iid}).first()
        if not exists:
            raise HTTPException(status_code=404, detail="Intake not found")
        stats = conn.execute(
            text(
                """
                SELECT COUNT(*) AS file_count, COALESCE(SUM(file_size), 0) AS total_bytes
                FROM evidence_files
                WHERE intake_id = :iid
                """
            ),
            {"iid": iid},
        ).mappings().first()
    file_count = int((stats or {}).get("file_count") or 0)
    total_bytes = int((stats or {}).get("total_bytes") or 0)
    if file_count >= MAX_FILES_PER_INTAKE:
        raise HTTPException(
            status_code=400,
            detail=f"File limit reached for this case (max {MAX_FILES_PER_INTAKE} uploads).",
        )
    if total_bytes + int(incoming_size or 0) > MAX_TOTAL_BYTES_PER_INTAKE:
        raise HTTPException(
            status_code=400,
            detail="Total upload storage limit reached for this case. Please remove older files.",
        )


def get_evidence_timeline_for_admin(request: Request, intake_id: str) -> Dict[str, Any]:
    require_admin_access(request)
    if not engine:
        raise HTTPException(status_code=503, detail="Database not configured")
    ensure_evidence_tables()
    iid = (intake_id or "").strip()
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT id, original_name, stored_name, extension, file_size, uploaded_at,
                       document_context, ai_summary, key_facts_json, safety_notice
                FROM evidence_files
                WHERE intake_id = :iid
                ORDER BY uploaded_at DESC
                """
            ),
            {"iid": iid},
        ).mappings().all()
    files = []
    timeline = []
    for row in rows:
        d = dict(row)
        facts = []
        try:
            facts = json.loads(str(d.get("key_facts_json") or "[]"))
            if not isinstance(facts, list):
                facts = []
        except Exception:
            facts = []
        file_item = {
            "id": d.get("id"),
            "name": d.get("original_name"),
            "uploaded_at": d.get("uploaded_at"),
            "file_size": d.get("file_size"),
            "context": d.get("document_context"),
            "summary": d.get("ai_summary"),
            "safety_notice": d.get("safety_notice"),
            "source_link": f"/documents/file/{d.get('id')}",
        }
        files.append(file_item)
        for f in facts:
            timeline.append(
                {
                    "date": f.get("date"),
                    "fact": f.get("fact"),
                    "source": d.get("original_name"),
                    "source_link": f"/documents/file/{d.get('id')}",
                }
            )
    return {"intake_id": iid, "files": files, "timeline": timeline}


def get_evidence_file_for_admin(request: Request, evidence_id: str):
    require_admin_access(request)
    if not engine:
        raise HTTPException(status_code=503, detail="Database not configured")
    ensure_evidence_tables()
    with engine.begin() as conn:
        row = conn.execute(
            text("SELECT original_name, stored_name FROM evidence_files WHERE id = :id"),
            {"id": (evidence_id or "").strip()},
        ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Evidence file not found")
    stored_name = str(row.get("stored_name") or "")
    original_name = str(row.get("original_name") or "evidence")
    target = (UPLOAD_ROOT / stored_name).resolve()
    if not str(target).startswith(str(UPLOAD_ROOT.resolve())) or not target.is_file():
        raise HTTPException(status_code=404, detail="Stored evidence file missing")
    return FileResponse(path=str(target), filename=original_name)

