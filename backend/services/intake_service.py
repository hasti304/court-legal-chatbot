import csv
import html
import io
import json
import os
import re
import time
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import desc, func, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

try:
    from ..models import Intake, IntakeSubmission, MagicLinkToken
    from .auth_password_service import hash_password
    from .admin_auth_service import admin_login_configured, admin_request_authorized
    from .config_service import ADMIN_EMAIL, ADMIN_EXPORT_KEY, ADMIN_JWT_SECRET, engine, groq_configured
    from .transactional_email import (
        email_provider_configured,
        email_provider_hint,
        send_transactional_email,
    )
except ImportError:
    from models import Intake, IntakeSubmission, MagicLinkToken  # type: ignore
    from services.auth_password_service import hash_password  # type: ignore
    from services.admin_auth_service import admin_login_configured, admin_request_authorized  # type: ignore
    from services.config_service import ADMIN_EMAIL, ADMIN_EXPORT_KEY, ADMIN_JWT_SECRET, engine, groq_configured  # type: ignore
    from services.transactional_email import (  # type: ignore
        email_provider_configured,
        email_provider_hint,
        send_transactional_email,
    )


def normalize_language(lang: Optional[str], supported_langs: set[str]) -> str:
    if not lang:
        return "en"
    lower = str(lang).strip().lower()
    if lower in supported_langs:
        return lower
    base = lower.split("-")[0]
    if base in supported_langs:
        return base
    return "en"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


_DEBUG_LOG_PATH = "debug-c1e03b.log"


def _append_debug_log(hypothesis_id: str, location: str, message: str, data: dict) -> None:
    payload = {
        "sessionId": "c1e03b",
        "runId": "initial",
        "hypothesisId": hypothesis_id,
        "id": f"log_{int(time.time() * 1000)}_{uuid.uuid4().hex[:8]}",
        "timestamp": int(time.time() * 1000),
        "location": location,
        "message": message,
        "data": data,
    }
    with open(_DEBUG_LOG_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=True) + "\n")


def normalize_us_phone(phone: str) -> str:
    digits = re.sub(r"[^0-9]", "", phone or "")
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) != 10:
        raise HTTPException(status_code=400, detail="Invalid phone number. Use a 10-digit US phone number.")
    return digits


def safe_json_dumps(value) -> str:
    try:
        return json.dumps(value, ensure_ascii=False)
    except Exception:
        return "[]"


def parse_referral_names(event_value: Optional[str]) -> List[str]:
    raw = (event_value or "").strip()
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [str(x).strip() for x in parsed if str(x).strip()]
    except Exception:
        pass
    return [x.strip() for x in raw.split("|") if x.strip()]


_DEADLINE_MONTHS = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
    "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9, "oct": 10,
    "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
}


def _classify_deadline_type(context: str) -> str:
    t = (context or "").lower()
    if any(k in t for k in ("hearing", "court date", "court appearance", "appear in court", "trial")):
        return "court_date"
    if any(k in t for k in ("respond", "response due", "answer due", "reply by")):
        return "response_due"
    if any(k in t for k in ("file", "filing", "submit paperwork", "petition due", "motion due")):
        return "filing_deadline"
    if "deadline" in t or "due" in t:
        return "general_deadline"
    return "other"


def _safe_date(year: int, month: int, day: int) -> Optional[date]:
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _extract_date_candidates(text_value: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    if not text_value:
        return out
    today = datetime.now(timezone.utc).date()
    low = text_value.lower()
    for m in re.finditer(r"\b(?:in\s+)?(\d{1,3})\s+days?\b", low):
        days = int(m.group(1))
        if 0 <= days <= 365:
            out.append({"due_date": today + timedelta(days=days), "source_phrase": m.group(0)})
    if re.search(r"\btomorrow\b", low):
        out.append({"due_date": today + timedelta(days=1), "source_phrase": "tomorrow"})
    if re.search(r"\bnext week\b", low):
        out.append({"due_date": today + timedelta(days=7), "source_phrase": "next week"})
    for m in re.finditer(r"\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b", text_value):
        mm = int(m.group(1)); dd = int(m.group(2)); yy = today.year
        if m.group(3):
            yy = int(m.group(3))
            if yy < 100:
                yy += 2000
        d = _safe_date(yy, mm, dd)
        if d:
            out.append({"due_date": d, "source_phrase": m.group(0)})
    month_names = "|".join(sorted(_DEADLINE_MONTHS.keys(), key=len, reverse=True))
    patt1 = re.compile(rf"\b({month_names})\s+(\d{{1,2}})(?:st|nd|rd|th)?(?:,?\s+(\d{{2,4}}))?\b", re.IGNORECASE)
    patt2 = re.compile(rf"\b(\d{{1,2}})(?:st|nd|rd|th)?\s+({month_names})(?:,?\s+(\d{{2,4}}))?\b", re.IGNORECASE)
    for m in patt1.finditer(text_value):
        year = today.year if not m.group(3) else int(m.group(3)) + (2000 if int(m.group(3)) < 100 else 0)
        d = _safe_date(year, int(_DEADLINE_MONTHS.get(m.group(1).lower()) or 0), int(m.group(2)))
        if d:
            out.append({"due_date": d, "source_phrase": m.group(0)})
    for m in patt2.finditer(text_value):
        year = today.year if not m.group(3) else int(m.group(3)) + (2000 if int(m.group(3)) < 100 else 0)
        d = _safe_date(year, int(_DEADLINE_MONTHS.get(m.group(2).lower()) or 0), int(m.group(1)))
        if d:
            out.append({"due_date": d, "source_phrase": m.group(0)})
    uniq: Dict[str, Dict[str, Any]] = {}
    for item in out:
        key = f'{item["due_date"].isoformat()}::{item["source_phrase"].strip().lower()}'
        uniq[key] = item
    return list(uniq.values())


def _extract_deadlines_from_text(text_value: str, source_type: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for cand in _extract_date_candidates(text_value):
        phrase = str(cand.get("source_phrase") or "").strip()
        due = cand.get("due_date")
        if phrase and isinstance(due, date):
            out.append(
                {
                    "deadline_type": _classify_deadline_type(text_value),
                    "due_date": due.isoformat(),
                    "source_phrase": phrase[:255],
                    "source_type": source_type,
                    "source_excerpt": text_value[:1000],
                }
            )
    return out


def refresh_deadlines_for_intake(conn, intake_id: str) -> None:
    iid = (intake_id or "").strip()
    if not iid:
        return
    summary_row = conn.execute(
        text("SELECT problem_summary FROM triage_sessions WHERE intake_id = :iid"),
        {"iid": iid},
    ).mappings().first()
    events = conn.execute(
        text(
            """
            SELECT event_type, event_value
            FROM intake_events
            WHERE intake_id = :iid
              AND event_type IN ('problem_summary', 'problem_summary_alternate_topic')
            ORDER BY created_at DESC
            LIMIT 20
            """
        ),
        {"iid": iid},
    ).mappings().all()
    raw_texts: List[Dict[str, str]] = []
    summary_text = str((summary_row or {}).get("problem_summary") or "").strip()
    if summary_text:
        raw_texts.append({"source_type": "summary", "text": summary_text})
    for ev in events:
        txt = str(ev.get("event_value") or "").strip()
        if txt:
            raw_texts.append({"source_type": "chat_event", "text": txt})
    deadlines: List[Dict[str, Any]] = []
    for source in raw_texts:
        deadlines.extend(_extract_deadlines_from_text(source.get("text", ""), source.get("source_type", "summary")))
    conn.execute(text("DELETE FROM intake_deadlines WHERE intake_id = :iid"), {"iid": iid})
    for d in deadlines:
        conn.execute(
            text(
                """
                INSERT INTO intake_deadlines (
                  id, intake_id, deadline_type, due_date, source_phrase, source_type, source_excerpt, created_at
                ) VALUES (
                  :id, :intake_id, :deadline_type, :due_date, :source_phrase, :source_type, :source_excerpt, :created_at
                )
                """
            ),
            {
                "id": os.urandom(16).hex(),
                "intake_id": iid,
                "deadline_type": d["deadline_type"],
                "due_date": d["due_date"],
                "source_phrase": d["source_phrase"],
                "source_type": d["source_type"],
                "source_excerpt": d["source_excerpt"],
                "created_at": utc_now_iso(),
            },
        )


def require_admin_access(request: Request) -> None:
    if admin_request_authorized(request):
        return
    if ADMIN_EXPORT_KEY and request.headers.get("X-Admin-Key", "") == ADMIN_EXPORT_KEY:
        return
    raise HTTPException(status_code=401, detail="Unauthorized")


def ensure_tables():
    if not engine:
        return

    create_intakes = """
    CREATE TABLE IF NOT EXISTS intakes (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      zip TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'en',
      consent BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TEXT NOT NULL,
      password_hash TEXT
    );
    """

    create_events = """
    CREATE TABLE IF NOT EXISTS intake_events (
      id TEXT PRIMARY KEY,
      intake_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_value TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (intake_id) REFERENCES intakes(id)
    );
    """

    create_triage_sessions = """
    CREATE TABLE IF NOT EXISTS triage_sessions (
      intake_id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      topic TEXT,
      emergency TEXT,
      in_court BOOLEAN,
      income TEXT,
      zip_code TEXT,
      level INTEGER,
      referral_count INTEGER NOT NULL DEFAULT 0,
      referral_names TEXT NOT NULL DEFAULT '[]',
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      completed_at TEXT,
      ai_used BOOLEAN NOT NULL DEFAULT FALSE,
      ai_used_at TEXT,
      restart_count INTEGER NOT NULL DEFAULT 0,
      back_count INTEGER NOT NULL DEFAULT 0,
      last_event_type TEXT,
      problem_summary TEXT,
      FOREIGN KEY (intake_id) REFERENCES intakes(id)
    );
    """

    create_events_index = """
    CREATE INDEX IF NOT EXISTS idx_intake_events_intake_id_created_at
    ON intake_events (intake_id, created_at);
    """

    create_sessions_topic_index = """
    CREATE INDEX IF NOT EXISTS idx_triage_sessions_topic
    ON triage_sessions (topic);
    """

    create_sessions_zip_index = """
    CREATE INDEX IF NOT EXISTS idx_triage_sessions_zip
    ON triage_sessions (zip_code);
    """

    create_deadlines = """
    CREATE TABLE IF NOT EXISTS intake_deadlines (
      id TEXT PRIMARY KEY,
      intake_id TEXT NOT NULL,
      deadline_type TEXT NOT NULL,
      due_date TEXT NOT NULL,
      source_phrase TEXT,
      source_type TEXT NOT NULL DEFAULT 'summary',
      source_excerpt TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (intake_id) REFERENCES intakes(id)
    );
    """

    create_deadlines_index = """
    CREATE INDEX IF NOT EXISTS idx_intake_deadlines_intake_due
    ON intake_deadlines (intake_id, due_date);
    """

    try:
        with engine.begin() as conn:
            conn.execute(text(create_intakes))
            conn.execute(text(create_events))
            conn.execute(text(create_triage_sessions))
            conn.execute(text(create_events_index))
            conn.execute(text(create_sessions_topic_index))
            conn.execute(text(create_sessions_zip_index))
            conn.execute(text(create_deadlines))
            conn.execute(text(create_deadlines_index))
            _migrate_intakes_admin_status(conn)
            _migrate_intakes_password_hash(conn)
            _migrate_intakes_login_count(conn)
            _migrate_triage_sessions_problem_summary(conn)
    except SQLAlchemyError as e:
        print(f"Warning: ensure_tables failed: {e}")


def _migrate_intakes_admin_status(conn) -> None:
    """Add admin_status for case review (pending / rejected / accepted)."""
    try:
        dialect = conn.engine.dialect.name
    except Exception:
        dialect = ""
    try:
        if dialect == "sqlite":
            cols = {r[1] for r in conn.execute(text("PRAGMA table_info(intakes)")).fetchall()}
            if "admin_status" in cols:
                return
            conn.execute(text("ALTER TABLE intakes ADD COLUMN admin_status TEXT DEFAULT 'pending'"))
            conn.execute(text("UPDATE intakes SET admin_status = 'pending' WHERE admin_status IS NULL"))
        else:
            try:
                conn.execute(text("ALTER TABLE intakes ADD COLUMN admin_status VARCHAR(32) DEFAULT 'pending'"))
            except Exception:
                pass
    except Exception as e:
        print(f"Warning: intakes admin_status migration skipped: {e}")


def _migrate_triage_sessions_problem_summary(conn) -> None:
    """Add problem_summary for client narrative captured during triage."""
    try:
        dialect = conn.engine.dialect.name
    except Exception:
        dialect = ""
    try:
        if dialect == "sqlite":
            cols = {r[1] for r in conn.execute(text("PRAGMA table_info(triage_sessions)")).fetchall()}
            if "problem_summary" in cols:
                return
            conn.execute(text("ALTER TABLE triage_sessions ADD COLUMN problem_summary TEXT"))
        else:
            try:
                conn.execute(text("ALTER TABLE triage_sessions ADD COLUMN problem_summary TEXT"))
            except Exception:
                pass
    except Exception as e:
        print(f"Warning: triage_sessions problem_summary migration skipped: {e}")


def _migrate_intakes_login_count(conn) -> None:
    """Track successful navigator sign-ins (password or magic link) for admin reporting."""
    try:
        dialect = conn.engine.dialect.name
    except Exception:
        dialect = ""
    try:
        if dialect == "sqlite":
            cols = {r[1] for r in conn.execute(text("PRAGMA table_info(intakes)")).fetchall()}
            if "login_count" in cols:
                return
            conn.execute(text("ALTER TABLE intakes ADD COLUMN login_count INTEGER NOT NULL DEFAULT 0"))
        else:
            try:
                conn.execute(text("ALTER TABLE intakes ADD COLUMN login_count INTEGER NOT NULL DEFAULT 0"))
            except Exception:
                pass
    except Exception as e:
        print(f"Warning: intakes login_count migration skipped: {e}")


def _migrate_intakes_password_hash(conn) -> None:
    """Add password_hash for direct email+password login."""
    try:
        dialect = conn.engine.dialect.name
    except Exception:
        dialect = ""
    try:
        if dialect == "sqlite":
            cols = {r[1] for r in conn.execute(text("PRAGMA table_info(intakes)")).fetchall()}
            if "password_hash" in cols:
                return
            conn.execute(text("ALTER TABLE intakes ADD COLUMN password_hash TEXT"))
        else:
            try:
                conn.execute(text("ALTER TABLE intakes ADD COLUMN password_hash TEXT"))
            except Exception:
                pass
    except Exception as e:
        print(f"Warning: intakes password_hash migration skipped: {e}")


def ensure_triage_session_row(conn, intake_id: str):
    intake_exists = conn.execute(
        text("SELECT 1 FROM intakes WHERE id = :intake_id"),
        {"intake_id": intake_id},
    ).first()
    if not intake_exists:
        return False

    conn.execute(
        text("""
        INSERT INTO triage_sessions (
          intake_id,
          started_at,
          last_seen_at,
          topic,
          emergency,
          in_court,
          income,
          zip_code,
          level,
          referral_count,
          referral_names,
          completed,
          completed_at,
          ai_used,
          ai_used_at,
          restart_count,
          back_count,
          last_event_type
        )
        VALUES (
          :intake_id,
          :started_at,
          :last_seen_at,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL,
          0,
          '[]',
          FALSE,
          NULL,
          FALSE,
          NULL,
          0,
          0,
          'intake_started'
        )
        ON CONFLICT (intake_id) DO NOTHING
        """),
        {
            "intake_id": intake_id,
            "started_at": utc_now_iso(),
            "last_seen_at": utc_now_iso(),
        },
    )
    return True


def update_triage_session_from_event(conn, intake_id: str, event_type: str, event_value: Optional[str] = None):
    if not ensure_triage_session_row(conn, intake_id):
        return
    now = utc_now_iso()
    event_type = (event_type or "").strip().lower()
    event_value = (event_value or "").strip()
    base_params = {"intake_id": intake_id, "now": now, "event_type": event_type}

    if event_type == "topic_selected":
        conn.execute(
            text("""
            UPDATE triage_sessions
            SET topic = :topic, last_seen_at = :now, last_event_type = :event_type
            WHERE intake_id = :intake_id
            """),
            {**base_params, "topic": event_value or None},
        )
        return
    if event_type == "emergency_answer":
        emergency_value = event_value.lower() if event_value else None
        conn.execute(
            text("""
            UPDATE triage_sessions
            SET emergency = :emergency, last_seen_at = :now, last_event_type = :event_type
            WHERE intake_id = :intake_id
            """),
            {**base_params, "emergency": emergency_value},
        )
        return
    if event_type == "court_answer":
        lowered = event_value.lower()
        in_court = True if lowered == "yes" else False if lowered == "no" else None
        conn.execute(
            text("""
            UPDATE triage_sessions
            SET in_court = :in_court, last_seen_at = :now, last_event_type = :event_type
            WHERE intake_id = :intake_id
            """),
            {**base_params, "in_court": in_court},
        )
        return
    if event_type == "income_answer":
        normalized_income = "yes" if event_value.lower() in {"yes", "not_sure"} else "no" if event_value.lower() == "no" else None
        conn.execute(
            text("""
            UPDATE triage_sessions
            SET income = :income, last_seen_at = :now, last_event_type = :event_type
            WHERE intake_id = :intake_id
            """),
            {**base_params, "income": normalized_income},
        )
        return
    if event_type == "problem_summary":
        conn.execute(
            text("""
            UPDATE triage_sessions
            SET problem_summary = :problem_summary, last_seen_at = :now, last_event_type = :event_type
            WHERE intake_id = :intake_id
            """),
            {**base_params, "problem_summary": event_value or None},
        )
        refresh_deadlines_for_intake(conn, intake_id)
        return
    if event_type == "zip_entered":
        conn.execute(
            text("""
            UPDATE triage_sessions
            SET zip_code = :zip_code, last_seen_at = :now, last_event_type = :event_type
            WHERE intake_id = :intake_id
            """),
            {**base_params, "zip_code": event_value or None},
        )
        return
    if event_type == "triage_level_assigned":
        try:
            level = int(event_value)
        except Exception:
            level = None
        conn.execute(
            text("""
            UPDATE triage_sessions
            SET level = :level, last_seen_at = :now, last_event_type = :event_type
            WHERE intake_id = :intake_id
            """),
            {**base_params, "level": level},
        )
        return
    if event_type == "referrals_shown":
        referral_names = parse_referral_names(event_value)
        conn.execute(
            text("""
            UPDATE triage_sessions
            SET referral_count = :referral_count, referral_names = :referral_names, last_seen_at = :now, last_event_type = :event_type
            WHERE intake_id = :intake_id
            """),
            {**base_params, "referral_count": len(referral_names), "referral_names": safe_json_dumps(referral_names)},
        )
        return
    if event_type == "triage_completed":
        conn.execute(
            text("""
            UPDATE triage_sessions
            SET completed = TRUE, completed_at = COALESCE(completed_at, :now), last_seen_at = :now, last_event_type = :event_type
            WHERE intake_id = :intake_id
            """),
            base_params,
        )
        return
    if event_type == "ai_assistant_opened":
        conn.execute(
            text("""
            UPDATE triage_sessions
            SET ai_used = TRUE, ai_used_at = COALESCE(ai_used_at, :now), last_seen_at = :now, last_event_type = :event_type
            WHERE intake_id = :intake_id
            """),
            base_params,
        )
        return
    if event_type == "triage_restart":
        conn.execute(
            text("""
            UPDATE triage_sessions
            SET restart_count = restart_count + 1, last_seen_at = :now, last_event_type = :event_type
            WHERE intake_id = :intake_id
            """),
            base_params,
        )
        return
    if event_type == "triage_back":
        conn.execute(
            text("""
            UPDATE triage_sessions
            SET back_count = back_count + 1, last_seen_at = :now, last_event_type = :event_type
            WHERE intake_id = :intake_id
            """),
            base_params,
        )
        return

    conn.execute(
        text("""
        UPDATE triage_sessions
        SET last_seen_at = :now, last_event_type = :event_type
        WHERE intake_id = :intake_id
        """),
        base_params,
    )


def log_intake_event(intake_id: Optional[str], event_type: str, event_value: Optional[str] = None):
    if not engine or not intake_id:
        return
    try:
        ensure_tables()
        with engine.begin() as conn:
            conn.execute(
                text("""
                INSERT INTO intake_events (id, intake_id, event_type, event_value, created_at)
                VALUES (:id, :intake_id, :event_type, :event_value, :created_at)
                """),
                {
                    "id": os.urandom(16).hex(),
                    "intake_id": intake_id,
                    "event_type": (event_type or "").strip(),
                    "event_value": (event_value or "").strip(),
                    "created_at": utc_now_iso(),
                },
            )
            update_triage_session_from_event(conn=conn, intake_id=intake_id, event_type=event_type, event_value=event_value)
            if (event_type or "").strip().lower() in {"problem_summary", "problem_summary_alternate_topic"}:
                refresh_deadlines_for_intake(conn, intake_id)
    except Exception as e:
        print(f"Warning: failed to log intake event '{event_type}': {e}")


def create_intake_start(req, db: Session, supported_langs: set[str]):
    if not req.consent:
        raise HTTPException(status_code=400, detail="Consent is required")

    phone_digits = normalize_us_phone(req.phone)
    intake_id = os.urandom(16).hex()
    lang = normalize_language(req.language, supported_langs)
    password_hash = hash_password(req.password) if getattr(req, "password", None) else None

    try:
        row = Intake(
            id=intake_id,
            first_name=req.first_name.strip(),
            last_name=req.last_name.strip(),
            email=req.email.strip().lower(),
            phone=phone_digits,
            zip=req.zip.strip(),
            language=lang,
            consent=True,
            created_at=utc_now_iso(),
            password_hash=password_hash,
        )
        db.add(row)
        db.commit()
        if engine:
            ensure_tables()
            with engine.begin() as conn:
                ensure_triage_session_row(conn, intake_id)
        return {"status": "success", "intake_id": intake_id}
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


def create_intake_event(req):
    if not engine:
        raise HTTPException(status_code=503, detail="Database not configured")
    intake_id = (req.intake_id or "").strip()
    if not intake_id or not req.event_type:
        raise HTTPException(status_code=400, detail="Missing intake_id or event_type")
    event_id = os.urandom(16).hex()
    try:
        ensure_tables()
        with engine.begin() as conn:
            intake_exists = conn.execute(
                text("SELECT 1 FROM intakes WHERE id = :intake_id"),
                {"intake_id": intake_id},
            ).first()
            if not intake_exists:
                raise HTTPException(status_code=404, detail="Intake session not found. Please restart intake.")
            conn.execute(
                text("""
                INSERT INTO intake_events (id, intake_id, event_type, event_value, created_at)
                VALUES (:id, :intake_id, :event_type, :event_value, :created_at)
                """),
                {
                    "id": event_id,
                    "intake_id": intake_id,
                    "event_type": req.event_type.strip(),
                    "event_value": (req.event_value or "").strip(),
                    "created_at": utc_now_iso(),
                },
            )
            update_triage_session_from_event(
                conn=conn,
                intake_id=intake_id,
                event_type=req.event_type,
                event_value=req.event_value,
            )
            if (req.event_type or "").strip().lower() in {"problem_summary", "problem_summary_alternate_topic"}:
                refresh_deadlines_for_intake(conn, intake_id)
        return {"status": "ok"}
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


def create_submission(payload, db: Session):
    name = (payload.name or "").strip()
    email = (payload.email or "").strip().lower()
    phone = (payload.phone or "").strip()
    zip_code = (payload.zip_code or "").strip()
    issue_type = (payload.issue_type or "").strip()
    message = (payload.message or "").strip()

    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email is required")
    if not phone:
        raise HTTPException(status_code=400, detail="phone is required")
    if not zip_code:
        raise HTTPException(status_code=400, detail="zip_code is required")
    if not issue_type:
        raise HTTPException(status_code=400, detail="issue_type is required")
    if not message:
        raise HTTPException(status_code=400, detail="message is required")

    row = IntakeSubmission(
        name=name,
        email=email,
        phone=phone,
        zip_code=zip_code,
        issue_type=issue_type,
        message=message,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_submissions(request: Request, limit: int, db: Session):
    require_admin_access(request)
    safe_limit = max(1, min(limit, 100))
    return (
        db.query(IntakeSubmission)
        .order_by(IntakeSubmission.timestamp.desc())
        .limit(safe_limit)
        .all()
    )


def _humanize_topic(topic: Optional[str]) -> str:
    if not topic or not str(topic).strip():
        return "—"
    return str(topic).replace("_", " ").strip().title()


def record_navigator_sign_in(intake_id: str, db: Session) -> None:
    """Increment login_count and append a navigator_login row to intake_events."""
    iid = (intake_id or "").strip()
    if not iid:
        return
    row = db.query(Intake).filter(Intake.id == iid).first()
    if not row:
        return
    try:
        n = int(getattr(row, "login_count", 0) or 0)
    except (TypeError, ValueError):
        n = 0
    row.login_count = n + 1
    db.add(row)
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        return
    log_intake_event(iid, "navigator_login", "")


def list_intake_events_for_admin(request: Request, intake_id: str, db: Session) -> dict:
    """Chronicle of triage topics, logins, and mismatch events for one intake."""
    require_admin_access(request)
    ensure_tables()
    iid = (intake_id or "").strip()
    if len(iid) < 8:
        raise HTTPException(status_code=400, detail="Invalid intake id")
    exists = db.query(Intake.id).filter(Intake.id == iid).first()
    if not exists:
        raise HTTPException(status_code=404, detail="Intake not found")
    if not engine:
        raise HTTPException(status_code=503, detail="Database not configured")
    rows = db.execute(
        text(
            """
            SELECT event_type, event_value, created_at
            FROM intake_events
            WHERE intake_id = :iid
            ORDER BY created_at DESC
            LIMIT 400
            """
        ),
        {"iid": iid},
    ).mappings().all()
    return {"intake_id": iid, "events": [dict(r) for r in rows]}


def list_intakes_for_admin(request: Request, db: Session):
    """Navigator intakes with triage topic and admin review status."""
    require_admin_access(request)
    ensure_tables()
    safe_limit = 500
    bind = db.get_bind()
    dialect_name = getattr(getattr(bind, "dialect", None), "name", "") if bind is not None else ""

    def _column_exists(table_name: str, column_name: str) -> bool:
        try:
            if dialect_name == "sqlite":
                cols = db.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
                return any(str(c[1]) == column_name for c in cols)
            row = db.execute(
                text(
                    """
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = :table_name
                      AND column_name = :column_name
                    LIMIT 1
                    """
                ),
                {"table_name": table_name, "column_name": column_name},
            ).first()
            return row is not None
        except Exception:
            return False

    def _table_exists(table_name: str) -> bool:
        try:
            if dialect_name == "sqlite":
                row = db.execute(
                    text("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = :table_name LIMIT 1"),
                    {"table_name": table_name},
                ).first()
                return row is not None
            row = db.execute(
                text(
                    """
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_name = :table_name
                    LIMIT 1
                    """
                ),
                {"table_name": table_name},
            ).first()
            return row is not None
        except Exception:
            return False

    has_triage_sessions = _table_exists("triage_sessions")
    has_deadlines = _table_exists("intake_deadlines")
    has_intake_events = _table_exists("intake_events")
    has_admin_status = _column_exists("intakes", "admin_status")
    has_login_count = _column_exists("intakes", "login_count")
    has_problem_summary = has_triage_sessions and _column_exists("triage_sessions", "problem_summary")

    admin_status_expr = (
        "COALESCE(NULLIF(TRIM(i.admin_status), ''), 'pending') AS admin_status"
        if has_admin_status
        else "'pending' AS admin_status"
    )
    login_count_expr = "COALESCE(i.login_count, 0) AS login_count" if has_login_count else "0 AS login_count"
    problem_summary_expr = "ts.problem_summary AS problem_summary" if has_problem_summary else "NULL AS problem_summary"
    issue_topic_expr = "ts.topic AS issue_topic" if has_triage_sessions else "NULL AS issue_topic"
    consent_expr = (
        "CAST(i.consent AS INTEGER) AS consent"
        if dialect_name == "sqlite"
        else "CASE WHEN i.consent THEN 1 ELSE 0 END AS consent"
    )
    next_deadline_date_expr = (
        """
              (
                SELECT MIN(d.due_date)
                FROM intake_deadlines d
                WHERE d.intake_id = i.id
              ) AS next_deadline_date,
        """
        if has_deadlines
        else "NULL AS next_deadline_date,"
    )
    next_deadline_type_expr = (
        """
              (
                SELECT d2.deadline_type
                FROM intake_deadlines d2
                WHERE d2.intake_id = i.id
                ORDER BY d2.due_date ASC
                LIMIT 1
              ) AS next_deadline_type,
        """
        if has_deadlines
        else "NULL AS next_deadline_type,"
    )
    deadline_count_expr = (
        """
              (
                SELECT COUNT(*)
                FROM intake_deadlines d3
                WHERE d3.intake_id = i.id
              ) AS deadline_count
        """
        if has_deadlines
        else "0 AS deadline_count"
    )
    triage_join = "LEFT JOIN triage_sessions ts ON ts.intake_id = i.id" if has_triage_sessions else ""

    # region agent log
    _append_debug_log(
        "H5",
        "backend/services/intake_service.py:list_intakes_for_admin:start",
        "Admin intakes list start",
        {"safe_limit": safe_limit},
    )
    # endregion

    rows = db.execute(
        text(
            f"""
            SELECT
              i.id,
              i.first_name,
              i.last_name,
              i.email,
              i.phone,
              i.zip,
              i.language,
              {consent_expr},
              i.created_at,
              {admin_status_expr},
              {login_count_expr},
              {issue_topic_expr},
              {problem_summary_expr},
              {next_deadline_date_expr}
              {next_deadline_type_expr}
              {deadline_count_expr}
            FROM intakes i
            {triage_join}
            ORDER BY i.created_at DESC
            LIMIT :lim
            """
        ),
        {"lim": safe_limit},
    ).mappings().all()
    # region agent log
    _append_debug_log(
        "H5",
        "backend/services/intake_service.py:list_intakes_for_admin:rows",
        "Primary intake rows fetched",
        {"rows_count": len(rows)},
    )
    # endregion
    intake_ids = [str(r.get("id") or "").strip() for r in rows if str(r.get("id") or "").strip()]
    intake_id_set = set(intake_ids)
    intake_events_by_id: Dict[str, List[Dict[str, Any]]] = {}
    if intake_ids and has_intake_events:
        try:
            # Scope event reads strictly to the visible intake set to avoid full-table scans/timeouts.
            chunks = [intake_ids[i:i + 100] for i in range(0, len(intake_ids), 100)]
            total_event_rows = 0
            for chunk in chunks:
                params = {f"iid{i}": v for i, v in enumerate(chunk)}
                placeholders = ", ".join(f":iid{i}" for i in range(len(chunk)))
                event_rows = db.execute(
                    text(
                        f"""
                        SELECT intake_id, event_type, event_value, created_at
                        FROM intake_events
                        WHERE intake_id IN ({placeholders})
                          AND event_type IN (
                            'topic_selected',
                            'problem_summary',
                            'problem_summary_alternate_topic',
                            'navigator_login'
                          )
                        ORDER BY created_at DESC
                        """
                    ),
                    params,
                ).mappings().all()
                total_event_rows += len(event_rows)
                for er in event_rows:
                    iid = str(er.get("intake_id") or "").strip()
                    if not iid or iid not in intake_id_set:
                        continue
                    intake_events_by_id.setdefault(iid, []).append(dict(er))
            # region agent log
            _append_debug_log(
                "H6",
                "backend/services/intake_service.py:list_intakes_for_admin:events",
                "Scoped intake event rows fetched",
                {"intake_count": len(intake_ids), "event_rows_count": total_event_rows, "chunk_count": len(chunks)},
            )
            # endregion
        except Exception:
            intake_events_by_id = {}
            # region agent log
            _append_debug_log(
                "H6",
                "backend/services/intake_service.py:list_intakes_for_admin:event_query_exception",
                "Event enrichment query failed and was skipped",
                {"intake_count": len(intake_ids)},
            )
            # endregion
    out = []
    for r in rows:
        d = dict(r)
        topic = d.get("issue_topic")
        d["issue"] = _humanize_topic(topic)
        d["issue_topic"] = topic or None
        events = intake_events_by_id.get(str(d.get("id") or ""), [])
        topics: List[str] = []
        summaries: List[str] = []
        for ev in events:
            et = str(ev.get("event_type") or "").strip().lower()
            evv = str(ev.get("event_value") or "").strip()
            if et == "topic_selected" and evv:
                hum = _humanize_topic(evv)
                if hum not in topics:
                    topics.append(hum)
            if et in {"problem_summary", "problem_summary_alternate_topic"} and evv:
                if evv not in summaries:
                    summaries.append(evv)
        if not topics and d.get("issue"):
            topics = [str(d.get("issue"))]
        if not summaries and str(d.get("problem_summary") or "").strip():
            summaries = [str(d.get("problem_summary") or "").strip()]
        d["issues"] = topics
        d["summaries"] = summaries
        next_deadline_date = str(d.get("next_deadline_date") or "").strip()
        if next_deadline_date:
            try:
                due = datetime.fromisoformat(next_deadline_date[:10]).date()
                today = datetime.now(timezone.utc).date()
                d["next_deadline_days_left"] = (due - today).days
            except Exception:
                d["next_deadline_days_left"] = None
        else:
            d["next_deadline_days_left"] = None
        if "consent" in d:
            d["consent"] = bool(d.get("consent"))
        out.append(d)
    return out


def _intake_status_email_parts(
    first_name: str, last_name: str, status: str, note: str
) -> tuple[str, str, str]:
    """Returns (subject, text, html) or empty strings if no template for status."""
    greeting = f"{(first_name or '').strip()} {(last_name or '').strip()}".strip() or "Hello"
    note_t = (note or "").strip()
    note_plain = f"\n\nMessage from our team:\n{note_t}\n" if note_t else ""
    note_html = (
        f'<p style="margin-top:16px"><strong>Message from our team:</strong></p>'
        f'<p style="white-space:pre-wrap">{html.escape(note_t)}</p>'
        if note_t
        else ""
    )
    if status == "accepted":
        subject = "Your CAL navigator request — accepted"
        text = (
            f"Hello {greeting},\n\n"
            "Thank you for registering with the Chicago Advocate Legal resource navigator. "
            "Your account request has been accepted. You can sign in with the email you used when you created your account.\n"
            f"{note_plain}\n"
            "If you have questions about this message, please use the contact information on our website.\n"
        )
        html_body = (
            f"<p>Hello {html.escape(greeting)},</p>"
            "<p>Thank you for registering with the Chicago Advocate Legal resource navigator. "
            "Your account request has been <strong>accepted</strong>. You can sign in with the email you used when you created your account.</p>"
            f"{note_html}"
            "<p>If you have questions about this message, please use the contact information on our website.</p>"
        )
        return subject, text, html_body
    if status == "rejected":
        subject = "Your CAL navigator request — update"
        text = (
            f"Hello {greeting},\n\n"
            "We reviewed your registration for the Chicago Advocate Legal resource navigator. "
            "We are not able to approve this account request at this time.\n"
            f"{note_plain}\n"
            "If you believe this is an error, you may contact us using the information on our website.\n"
        )
        html_body = (
            f"<p>Hello {html.escape(greeting)},</p>"
            "<p>We reviewed your registration for the Chicago Advocate Legal resource navigator. "
            "We are <strong>not able to approve</strong> this account request at this time.</p>"
            f"{note_html}"
            "<p>If you believe this is an error, you may contact us using the information on our website.</p>"
        )
        return subject, text, html_body
    return "", "", ""


def send_intake_status_notification_email(
    *,
    email: str,
    first_name: str,
    last_name: str,
    status: str,
    note: str,
) -> bool:
    if status not in ("accepted", "rejected"):
        return False
    subject, text_body, html_body = _intake_status_email_parts(first_name, last_name, status, note)
    if not subject:
        return False
    return send_transactional_email(email, subject, text_body, html_body)


def set_intake_admin_status(
    request: Request,
    intake_id: str,
    status: str,
    db: Session,
    *,
    send_notification: bool = False,
    notification_note: str = "",
) -> dict:
    require_admin_access(request)
    ensure_tables()
    st = (status or "").strip().lower()
    if st not in ("pending", "rejected", "accepted"):
        raise HTTPException(status_code=400, detail="status must be pending, rejected, or accepted")
    row = db.query(Intake).filter(Intake.id == intake_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Intake not found")
    row.admin_status = st
    db.commit()
    db.refresh(row)
    email_sent = False
    if send_notification and st in ("accepted", "rejected"):
        email_sent = send_intake_status_notification_email(
            email=row.email,
            first_name=row.first_name or "",
            last_name=row.last_name or "",
            status=st,
            note=notification_note or "",
        )
    return {
        "id": row.id,
        "admin_status": row.admin_status,
        "first_name": row.first_name,
        "last_name": row.last_name,
        "email": row.email,
        "email_sent": email_sent,
    }


def send_intake_staff_email(request: Request, intake_id: str, subject: str, body: str, db: Session) -> dict:
    require_admin_access(request)
    ensure_tables()
    subj = (subject or "").strip()
    raw_body = (body or "").strip()
    if not subj:
        raise HTTPException(status_code=400, detail="subject is required")
    if len(subj) > 240:
        raise HTTPException(status_code=400, detail="subject is too long (max 240 characters)")
    if not raw_body:
        raise HTTPException(status_code=400, detail="body is required")
    if len(raw_body) > 8000:
        raise HTTPException(status_code=400, detail="body is too long (max 8000 characters)")
    row = db.query(Intake).filter(Intake.id == intake_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Intake not found")
    to_email = (row.email or "").strip()
    if "@" not in to_email:
        raise HTTPException(status_code=400, detail="Intake has no valid email")
    esc = html.escape(raw_body)
    html_body = (
        "<p>The following message is from Chicago Advocate Legal staff regarding your "
        "navigator registration.</p>"
        f'<pre style="white-space:pre-wrap;font-family:system-ui,Segoe UI,sans-serif;font-size:15px;">{esc}</pre>'
    )
    ok = send_transactional_email(to_email, subj, raw_body, html_body)
    return {"ok": True, "email_sent": ok}


def admin_create_intake(request: Request, db: Session, supported_langs: set[str], payload) -> dict:
    """Create a navigator intake account (e.g. personal client). Defaults to accepted so they can sign in."""
    require_admin_access(request)
    ensure_tables()
    phone_digits = normalize_us_phone(payload.phone)
    email_norm = str(payload.email).strip().lower()
    if "@" not in email_norm:
        raise HTTPException(status_code=400, detail="Valid email is required")
    existing = db.query(Intake).filter(Intake.email == email_norm).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail="An intake with this email already exists. Delete or edit the existing account first.",
        )
    lang = normalize_language(getattr(payload, "language", None), supported_langs)
    intake_id = os.urandom(16).hex()
    try:
        row = Intake(
            id=intake_id,
            first_name=str(payload.first_name).strip(),
            last_name=str(payload.last_name).strip(),
            email=email_norm,
            phone=phone_digits,
            zip=str(payload.zip).strip(),
            language=lang,
            consent=True,
            created_at=utc_now_iso(),
            admin_status="accepted",
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        if engine:
            with engine.begin() as conn:
                ensure_triage_session_row(conn, intake_id)
        return {
            "id": row.id,
            "first_name": row.first_name,
            "last_name": row.last_name,
            "email": row.email,
            "admin_status": row.admin_status,
        }
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


def admin_delete_intake(request: Request, intake_id: str, db: Session) -> dict:
    """Remove an intake and related triage/events/magic-link rows for that email."""
    require_admin_access(request)
    ensure_tables()
    iid = (intake_id or "").strip()
    if not iid:
        raise HTTPException(status_code=400, detail="Invalid intake id")
    row = db.query(Intake).filter(Intake.id == iid).first()
    if not row:
        raise HTTPException(status_code=404, detail="Intake not found")
    email = (row.email or "").strip().lower()
    try:
        db.execute(text("DELETE FROM intake_events WHERE intake_id = :iid"), {"iid": iid})
        db.execute(text("DELETE FROM triage_sessions WHERE intake_id = :iid"), {"iid": iid})
        db.execute(text("DELETE FROM intake_deadlines WHERE intake_id = :iid"), {"iid": iid})
        if email:
            db.query(MagicLinkToken).filter(MagicLinkToken.email == email).delete(synchronize_session=False)
        db.delete(row)
        db.commit()
        return {"ok": True, "id": iid}
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


def get_submission(submission_id: int, request: Request, db: Session):
    require_admin_access(request)
    row = db.query(IntakeSubmission).filter(IntakeSubmission.id == submission_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Submission not found")
    return row


def _csv_topics_selected_expr(dialect_name: str) -> str:
    """PostgreSQL string_agg vs SQLite group_concat for admin CSV export."""
    if dialect_name == "sqlite":
        return """COALESCE((
                    SELECT GROUP_CONCAT(e.event_value, '; ')
                    FROM intake_events e
                    WHERE e.intake_id = i.id AND e.event_type = 'topic_selected'
                  ), '') AS topics_selected"""
    return """COALESCE((
                    SELECT string_agg(e.event_value, '; ' ORDER BY e.created_at)
                    FROM intake_events e
                    WHERE e.intake_id = i.id AND e.event_type = 'topic_selected'
                  ), '') AS topics_selected"""


def export_intakes_csv(request: Request):
    if not engine:
        raise HTTPException(status_code=503, detail="Database not configured")
    require_admin_access(request)
    try:
        ensure_tables()
        dialect = getattr(engine.dialect, "name", "") or "sqlite"
        topics_expr = _csv_topics_selected_expr(dialect)
        with engine.begin() as conn:
            rows = conn.execute(
                text(
                    f"""
                SELECT
                  i.id,
                  i.first_name,
                  i.last_name,
                  i.email,
                  i.phone,
                  i.zip,
                  i.language,
                  i.consent,
                  i.created_at,
                  COALESCE(NULLIF(TRIM(i.admin_status), ''), 'pending') AS admin_status,
                  COALESCE(i.login_count, 0) AS login_count,
                  COALESCE(ts.topic, '') AS triage_topic,
                  COALESCE(ts.problem_summary, '') AS problem_summary,
                  {topics_expr}
                FROM intakes i
                LEFT JOIN triage_sessions ts ON ts.intake_id = i.id
                ORDER BY i.created_at DESC
            """
                )
            ).fetchall()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "intake_id",
            "first_name",
            "last_name",
            "email",
            "phone_digits",
            "zip",
            "language",
            "consent",
            "created_at",
            "admin_status",
            "login_count",
            "triage_topic",
            "problem_summary",
            "topics_selected",
        ])
        for r in rows:
            writer.writerow(list(r))
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=intakes.csv"},
        )
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


def _admin_stats_overview_sql(dialect_name: str) -> str:
    """FILTER aggregate is PostgreSQL-only; use CASE sums on SQLite."""
    if dialect_name == "sqlite":
        return """
                SELECT
                  COUNT(*) AS total_sessions,
                  SUM(CASE WHEN completed THEN 1 ELSE 0 END) AS completed_sessions,
                  SUM(CASE WHEN ai_used THEN 1 ELSE 0 END) AS ai_used_sessions,
                  SUM(CASE WHEN emergency = 'yes' THEN 1 ELSE 0 END) AS emergency_sessions
                FROM triage_sessions
            """
    return """
                SELECT
                  COUNT(*) AS total_sessions,
                  COUNT(*) FILTER (WHERE completed = TRUE) AS completed_sessions,
                  COUNT(*) FILTER (WHERE ai_used = TRUE) AS ai_used_sessions,
                  COUNT(*) FILTER (WHERE emergency = 'yes') AS emergency_sessions
                FROM triage_sessions
            """


def admin_stats(request: Request):
    if not engine:
        raise HTTPException(status_code=503, detail="Database not configured")
    require_admin_access(request)
    try:
        ensure_tables()
        dialect = getattr(engine.dialect, "name", "") or "sqlite"
        with engine.begin() as conn:
            overview = conn.execute(text(_admin_stats_overview_sql(dialect))).mappings().first()

            top_topics = conn.execute(text("""
                SELECT topic, COUNT(*) AS count
                FROM triage_sessions
                WHERE topic IS NOT NULL AND topic <> ''
                GROUP BY topic
                ORDER BY count DESC, topic ASC
                LIMIT 10
            """)).mappings().all()

            top_zips = conn.execute(text("""
                SELECT zip_code, COUNT(*) AS count
                FROM triage_sessions
                WHERE zip_code IS NOT NULL AND zip_code <> ''
                GROUP BY zip_code
                ORDER BY count DESC, zip_code ASC
                LIMIT 5
            """)).mappings().all()

            level_breakdown = conn.execute(text("""
                SELECT level, COUNT(*) AS count
                FROM triage_sessions
                WHERE level IS NOT NULL
                GROUP BY level
                ORDER BY level ASC
            """)).mappings().all()

            recent_sessions = conn.execute(text("""
                SELECT
                  intake_id,
                  started_at,
                  last_seen_at,
                  topic,
                  emergency,
                  in_court,
                  income,
                  zip_code,
                  level,
                  referral_count,
                  completed,
                  ai_used,
                  restart_count,
                  back_count
                FROM triage_sessions
                ORDER BY started_at DESC
                LIMIT 20
            """)).mappings().all()

            feedback = conn.execute(text("""
                SELECT
                  SUM(CASE WHEN event_value = 'helpful_yes' THEN 1 ELSE 0 END) AS helpful_yes,
                  SUM(CASE WHEN event_value = 'helpful_no' THEN 1 ELSE 0 END) AS helpful_no
                FROM intake_events
                WHERE event_type = 'triage_feedback'
            """)).mappings().first()

            # Cross-cutting feature analytics (guarded for partially migrated environments).
            try:
                timeline_usage = conn.execute(
                    text(
                        """
                        SELECT
                          SUM(CASE WHEN event_type = 'timeline_step_viewed' THEN 1 ELSE 0 END) AS step_views,
                          SUM(CASE WHEN event_type = 'timeline_checklist_toggled' THEN 1 ELSE 0 END) AS checklist_toggles
                        FROM intake_events
                        """
                    )
                ).mappings().first()
            except Exception:
                timeline_usage = {"step_views": 0, "checklist_toggles": 0}

            try:
                deadline_stats = conn.execute(
                    text(
                        """
                        SELECT
                          COUNT(*) AS total_deadlines,
                          SUM(CASE WHEN due_date < :today THEN 1 ELSE 0 END) AS overdue_deadlines
                        FROM intake_deadlines
                        """
                    ),
                    {"today": datetime.now(timezone.utc).date().isoformat()},
                ).mappings().first()
            except Exception:
                deadline_stats = {"total_deadlines": 0, "overdue_deadlines": 0}

            try:
                evidence_stats = conn.execute(
                    text(
                        """
                        SELECT
                          COUNT(*) AS total_evidence_files,
                          SUM(CASE WHEN COALESCE(TRIM(ai_summary), '') <> '' THEN 1 ELSE 0 END) AS ai_summary_ready
                        FROM evidence_files
                        """
                    )
                ).mappings().first()
            except Exception:
                evidence_stats = {"total_evidence_files": 0, "ai_summary_ready": 0}

        total_sessions = int(overview["total_sessions"] or 0)
        completed_sessions = int(overview["completed_sessions"] or 0)
        ai_used_sessions = int(overview["ai_used_sessions"] or 0)
        emergency_sessions = int(overview["emergency_sessions"] or 0)
        completion_rate = round((completed_sessions / total_sessions) * 100, 2) if total_sessions else 0.0
        helpful_yes = int((feedback or {}).get("helpful_yes") or 0)
        helpful_no = int((feedback or {}).get("helpful_no") or 0)
        feedback_total = helpful_yes + helpful_no
        helpful_rate = round((helpful_yes / feedback_total) * 100, 2) if feedback_total else 0.0
        timeline_step_views = int((timeline_usage or {}).get("step_views") or 0)
        timeline_checklist_toggles = int((timeline_usage or {}).get("checklist_toggles") or 0)
        total_deadlines = int((deadline_stats or {}).get("total_deadlines") or 0)
        overdue_deadlines = int((deadline_stats or {}).get("overdue_deadlines") or 0)
        total_evidence_files = int((evidence_stats or {}).get("total_evidence_files") or 0)
        ai_summary_ready = int((evidence_stats or {}).get("ai_summary_ready") or 0)
        ai_summary_rate = round((ai_summary_ready / total_evidence_files) * 100, 2) if total_evidence_files else 0.0

        return JSONResponse(
            {
                "overview": {
                    "total_sessions": total_sessions,
                    "completed_sessions": completed_sessions,
                    "incomplete_sessions": max(total_sessions - completed_sessions, 0),
                    "completion_rate_percent": completion_rate,
                    "ai_used_sessions": ai_used_sessions,
                    "emergency_sessions": emergency_sessions,
                    "feedback_total": feedback_total,
                    "helpful_yes": helpful_yes,
                    "helpful_no": helpful_no,
                    "helpful_rate_percent": helpful_rate,
                    "timeline_step_views": timeline_step_views,
                    "timeline_checklist_toggles": timeline_checklist_toggles,
                    "total_deadlines": total_deadlines,
                    "overdue_deadlines": overdue_deadlines,
                    "total_evidence_files": total_evidence_files,
                    "ai_summary_ready": ai_summary_ready,
                    "ai_summary_rate_percent": ai_summary_rate,
                },
                "top_topics": [dict(row) for row in top_topics],
                "top_zips": [dict(row) for row in top_zips],
                "level_breakdown": [dict(row) for row in level_breakdown],
                "recent_sessions": [dict(row) for row in recent_sessions],
            }
        )
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


def basic_analytics(request: Request, db: Session):
    require_admin_access(request)
    try:
        total_users = int(db.query(func.count(Intake.id)).scalar() or 0)
        submissions = int(db.query(func.count(IntakeSubmission.id)).scalar() or 0)

        top_issue_row = (
            db.query(
                IntakeSubmission.issue_type.label("issue_type"),
                func.count(IntakeSubmission.id).label("count"),
            )
            .group_by(IntakeSubmission.issue_type)
            .order_by(desc("count"), IntakeSubmission.issue_type.asc())
            .first()
        )

        most_common_issue_type = (
            str(top_issue_row.issue_type)
            if top_issue_row and top_issue_row.issue_type
            else None
        )

        return {
            "total_users": total_users,
            "most_common_issue_type": most_common_issue_type,
            "number_of_submissions": submissions,
        }
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


def admin_health_checks(request: Request, db: Session) -> dict:
    """Quick regression-oriented health checks for core app flows."""
    require_admin_access(request)
    ensure_tables()
    checks = []

    # Check 1: database connectivity.
    try:
        total_intakes = int(db.query(func.count(Intake.id)).scalar() or 0)
        checks.append(
            {
                "name": "Database connectivity",
                "status": "pass",
                "detail": f"Connected. Intakes count: {total_intakes}.",
            }
        )
    except Exception as e:
        checks.append({"name": "Database connectivity", "status": "fail", "detail": str(e)})

    # Check 1b: basic DB read for sessions/events to catch partial migration issues.
    try:
        sessions = int(db.execute(text("SELECT COUNT(*) FROM triage_sessions")).scalar() or 0)
        events = int(db.execute(text("SELECT COUNT(*) FROM intake_events")).scalar() or 0)
        checks.append(
            {
                "name": "Session/event analytics tables",
                "status": "pass",
                "detail": f"Triage sessions: {sessions}. Intake events: {events}.",
            }
        )
    except Exception as e:
        checks.append({"name": "Session/event analytics tables", "status": "fail", "detail": str(e)})

    # Check 2: critical tables for new roadmap tasks.
    required_tables = ["triage_sessions", "intake_deadlines", "evidence_files"]
    missing = []
    try:
        for tname in required_tables:
            row = db.execute(text(f"SELECT 1 FROM {tname} LIMIT 1")).first()
            _ = row  # intentionally unused; just validates table queryability
        checks.append(
            {
                "name": "Core feature tables",
                "status": "pass",
                "detail": "Deadline, triage, and evidence tables available.",
            }
        )
    except Exception:
        # isolate exact table availability with sqlite/postgres-safe checks
        for tname in required_tables:
            try:
                db.execute(text(f"SELECT 1 FROM {tname} LIMIT 1")).first()
            except Exception:
                missing.append(tname)
        checks.append(
            {
                "name": "Core feature tables",
                "status": "fail" if missing else "pass",
                "detail": f"Missing or inaccessible tables: {', '.join(missing)}" if missing else "All tables accessible.",
            }
        )

    # Check 3: uploads directory write access.
    try:
        from pathlib import Path

        upload_root = Path(__file__).resolve().parents[1] / "uploads" / "documents"
        upload_root.mkdir(parents=True, exist_ok=True)
        probe = upload_root / f".probe_{os.urandom(6).hex()}"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink(missing_ok=True)
        checks.append(
            {
                "name": "Upload storage writable",
                "status": "pass",
                "detail": str(upload_root),
            }
        )
    except Exception as e:
        checks.append({"name": "Upload storage writable", "status": "fail", "detail": str(e)})

    # Check 4: optional AI provider status.
    checks.append(
        {
            "name": "AI summarization provider",
            "status": "pass" if groq_configured else "warn",
            "detail": "Configured" if groq_configured else "Not configured (fallback summaries active).",
        }
    )

    # Check 5: transactional email provider (required for magic-link and staff email notifications).
    email_ok = bool(email_provider_configured())
    checks.append(
        {
            "name": "Transactional email provider",
            "status": "pass" if email_ok else "warn",
            "detail": email_provider_hint() if email_ok else "Not configured; sign-in links/notifications may fail.",
        }
    )

    # Check 6: admin auth configuration sanity.
    has_admin_email = bool((ADMIN_EMAIL or "").strip())
    has_admin_jwt = bool((ADMIN_JWT_SECRET or "").strip() or (ADMIN_EXPORT_KEY or "").strip())
    if has_admin_email and has_admin_jwt and admin_login_configured():
        checks.append(
            {
                "name": "Admin auth configuration",
                "status": "pass",
                "detail": "Admin email, password source, and JWT secret are configured.",
            }
        )
    else:
        missing_bits = []
        if not has_admin_email:
            missing_bits.append("ADMIN_EMAIL")
        if not has_admin_jwt:
            missing_bits.append("ADMIN_JWT_SECRET (or ADMIN_EXPORT_KEY)")
        if not admin_login_configured():
            missing_bits.append("admin password source")
        checks.append(
            {
                "name": "Admin auth configuration",
                "status": "fail",
                "detail": f"Missing/invalid: {', '.join(missing_bits)}",
            }
        )

    failed = sum(1 for c in checks if c["status"] == "fail")
    warned = sum(1 for c in checks if c["status"] == "warn")
    return {
        "ok": failed == 0,
        "failed_checks": failed,
        "warn_checks": warned,
        "checks": checks,
    }
