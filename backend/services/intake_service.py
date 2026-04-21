import csv
import html
import io
import json
import os
import re
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import desc, func, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

try:
    from ..models import Intake, IntakeSubmission, MagicLinkToken
    from .auth_password_service import hash_password
    from .admin_auth_service import admin_request_authorized
    from .config_service import ADMIN_EXPORT_KEY, engine
    from .transactional_email import send_transactional_email
except ImportError:
    from models import Intake, IntakeSubmission, MagicLinkToken  # type: ignore
    from services.auth_password_service import hash_password  # type: ignore
    from services.admin_auth_service import admin_request_authorized  # type: ignore
    from services.config_service import ADMIN_EXPORT_KEY, engine  # type: ignore
    from services.transactional_email import send_transactional_email  # type: ignore


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

    try:
        with engine.begin() as conn:
            conn.execute(text(create_intakes))
            conn.execute(text(create_events))
            conn.execute(text(create_triage_sessions))
            conn.execute(text(create_events_index))
            conn.execute(text(create_sessions_topic_index))
            conn.execute(text(create_sessions_zip_index))
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
    rows = db.execute(
        text(
            """
            SELECT
              i.id,
              i.first_name,
              i.last_name,
              i.email,
              i.phone,
              i.zip,
              i.language,
              CAST(i.consent AS INTEGER) AS consent,
              i.created_at,
              COALESCE(NULLIF(TRIM(i.admin_status), ''), 'pending') AS admin_status,
              COALESCE(i.login_count, 0) AS login_count,
              ts.topic AS issue_topic,
              ts.problem_summary AS problem_summary
            FROM intakes i
            LEFT JOIN triage_sessions ts ON ts.intake_id = i.id
            ORDER BY i.created_at DESC
            LIMIT :lim
            """
        ),
        {"lim": safe_limit},
    ).mappings().all()
    out = []
    for r in rows:
        d = dict(r)
        topic = d.get("issue_topic")
        d["issue"] = _humanize_topic(topic)
        d["issue_topic"] = topic or None
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

        total_sessions = int(overview["total_sessions"] or 0)
        completed_sessions = int(overview["completed_sessions"] or 0)
        ai_used_sessions = int(overview["ai_used_sessions"] or 0)
        emergency_sessions = int(overview["emergency_sessions"] or 0)
        completion_rate = round((completed_sessions / total_sessions) * 100, 2) if total_sessions else 0.0
        helpful_yes = int((feedback or {}).get("helpful_yes") or 0)
        helpful_no = int((feedback or {}).get("helpful_no") or 0)
        feedback_total = helpful_yes + helpful_no
        helpful_rate = round((helpful_yes / feedback_total) * 100, 2) if feedback_total else 0.0

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
