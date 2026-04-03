from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel, Field
import json
import os
import io
import csv
import re
from typing import List, Dict, Optional
from datetime import datetime, timezone
from dotenv import load_dotenv
from groq import Groq

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")

TRIAGE_QUESTIONS_PATH = os.path.join(DATA_DIR, "triage_questions.json")
REFERRAL_MAP_PATH = os.path.join(DATA_DIR, "referral_map.json")

app = FastAPI()

ALLOWED_ORIGINS = [
    "https://court-legal-chatbot-frontend.onrender.com",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://hasti304.github.io",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400,
)

# --- Groq client ---
groq_client = None
groq_configured = False

try:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("Warning: GROQ_API_KEY not found in environment variables")
    else:
        groq_client = Groq(api_key=api_key)
        groq_configured = True
        print("Groq client initialized successfully")
except Exception as e:
    print(f"Warning: Groq client initialization failed: {type(e).__name__}: {e}")
    groq_configured = False

SUPPORTED_LANGS = {"en", "es"}


def normalize_language(lang: Optional[str]) -> str:
    if not lang:
        return "en"
    lower = str(lang).strip().lower()
    if lower in SUPPORTED_LANGS:
        return lower
    base = lower.split("-")[0]
    if base in SUPPORTED_LANGS:
        return base
    return "en"


def load_json_file(file_path: str):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail=f"Data file not found: {file_path}")
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail=f"Invalid JSON in file: {file_path}")


def detect_crisis_keywords(message: str) -> bool:
    crisis_keywords = [
        "abuse", "abused", "abusing",
        "hurt", "hurting", "hitting", "hit me",
        "danger", "dangerous", "scared", "afraid",
        "threatened", "threatening", "threats",
        "kill", "suicide", "die", "dying",
        "weapon", "gun", "knife",
        "emergency", "urgent", "help me",
        "violence", "violent", "attack"
    ]
    message_lower = (message or "").lower()
    return any(keyword in message_lower for keyword in crisis_keywords)


def normalize_step(step: Optional[str]) -> str:
    if not step:
        return "topic_selection"
    return step


def get_step_progress(step: Optional[str]) -> dict:
    step = normalize_step(step)
    steps_map = {
        "topic_selection": {"current": 1, "total": 5, "label_key": "progress.selectTopic"},
        "emergency_check": {"current": 2, "total": 5, "label_key": "progress.emergencyCheck"},
        "court_status": {"current": 3, "total": 5, "label_key": "progress.courtStatus"},
        "income_check": {"current": 4, "total": 5, "label_key": "progress.incomeLevel"},
        "get_zip": {"current": 5, "total": 5, "label_key": "progress.yourLocation"},
        "complete": {"current": 5, "total": 5, "label_key": "progress.resourcesReady"},
        "resource_selected": {"current": 5, "total": 5, "label_key": "progress.resourcesReady"},
        "continue_check": {"current": 5, "total": 5, "label_key": "progress.resourcesReady"},
    }
    return steps_map.get(step, {"current": 1, "total": 5, "label_key": "progress.defaultLabel"})


# -------------------------
# Postgres storage
# -------------------------
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
ADMIN_EXPORT_KEY = os.getenv("ADMIN_EXPORT_KEY", "").strip()

engine = None
if DATABASE_URL:
    try:
        engine = create_engine(DATABASE_URL, pool_pre_ping=True)
    except Exception as e:
        print(f"Warning: failed to create DB engine: {e}")
        engine = None


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


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
      created_at TEXT NOT NULL
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
    except SQLAlchemyError as e:
        print(f"Warning: ensure_tables failed: {e}")


ensure_tables()


def ensure_triage_session_row(conn, intake_id: str):
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


def update_triage_session_from_event(conn, intake_id: str, event_type: str, event_value: Optional[str] = None):
    ensure_triage_session_row(conn, intake_id)

    now = utc_now_iso()
    event_type = (event_type or "").strip().lower()
    event_value = (event_value or "").strip()

    base_params = {
        "intake_id": intake_id,
        "now": now,
        "event_type": event_type,
    }

    if event_type == "topic_selected":
        conn.execute(
            text("""
            UPDATE triage_sessions
            SET
              topic = :topic,
              last_seen_at = :now,
              last_event_type = :event_type
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
            SET
              emergency = :emergency,
              last_seen_at = :now,
              last_event_type = :event_type
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
            SET
              in_court = :in_court,
              last_seen_at = :now,
              last_event_type = :event_type
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
            SET
              income = :income,
              last_seen_at = :now,
              last_event_type = :event_type
            WHERE intake_id = :intake_id
            """),
            {**base_params, "income": normalized_income},
        )
        return

    if event_type == "zip_entered":
        conn.execute(
            text("""
            UPDATE triage_sessions
            SET
              zip_code = :zip_code,
              last_seen_at = :now,
              last_event_type = :event_type
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
            SET
              level = :level,
              last_seen_at = :now,
              last_event_type = :event_type
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
            SET
              referral_count = :referral_count,
              referral_names = :referral_names,
              last_seen_at = :now,
              last_event_type = :event_type
            WHERE intake_id = :intake_id
            """),
            {
                **base_params,
                "referral_count": len(referral_names),
                "referral_names": safe_json_dumps(referral_names),
            },
        )
        return

    if event_type == "triage_completed":
        conn.execute(
            text("""
            UPDATE triage_sessions
            SET
              completed = TRUE,
              completed_at = COALESCE(completed_at, :now),
              last_seen_at = :now,
              last_event_type = :event_type
            WHERE intake_id = :intake_id
            """),
            base_params,
        )
        return

    if event_type == "ai_assistant_opened":
        conn.execute(
            text("""
            UPDATE triage_sessions
            SET
              ai_used = TRUE,
              ai_used_at = COALESCE(ai_used_at, :now),
              last_seen_at = :now,
              last_event_type = :event_type
            WHERE intake_id = :intake_id
            """),
            base_params,
        )
        return

    if event_type == "triage_restart":
        conn.execute(
            text("""
            UPDATE triage_sessions
            SET
              restart_count = restart_count + 1,
              last_seen_at = :now,
              last_event_type = :event_type
            WHERE intake_id = :intake_id
            """),
            base_params,
        )
        return

    if event_type == "triage_back":
        conn.execute(
            text("""
            UPDATE triage_sessions
            SET
              back_count = back_count + 1,
              last_seen_at = :now,
              last_event_type = :event_type
            WHERE intake_id = :intake_id
            """),
            base_params,
        )
        return

    conn.execute(
        text("""
        UPDATE triage_sessions
        SET
          last_seen_at = :now,
          last_event_type = :event_type
        WHERE intake_id = :intake_id
        """),
        base_params,
    )


def normalize_us_phone(phone: str) -> str:
    digits = re.sub(r"[^0-9]", "", phone or "")
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) != 10:
        raise HTTPException(status_code=400, detail="Invalid phone number. Use a 10-digit US phone number.")
    return digits


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

            update_triage_session_from_event(
                conn=conn,
                intake_id=intake_id,
                event_type=event_type,
                event_value=event_value,
            )
    except Exception as e:
        print(f"Warning: failed to log intake event '{event_type}': {e}")


# -------------
# API Schemas
# -------------
class ChatRequest(BaseModel):
    message: str
    conversation_state: dict = Field(default_factory=dict)
    language: Optional[str] = "en"
    intake_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str = ""
    response_key: Optional[str] = None
    response_params: dict = Field(default_factory=dict)
    options: list = Field(default_factory=list)
    referrals: list = Field(default_factory=list)
    conversation_state: dict = Field(default_factory=dict)
    progress: dict = Field(default_factory=dict)


class IntakeStartRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str
    zip: str
    language: Optional[str] = "en"
    consent: bool


class IntakeStartResponse(BaseModel):
    intake_id: str


class IntakeEventRequest(BaseModel):
    intake_id: str
    event_type: str
    event_value: Optional[str] = None


class AIChatRequest(BaseModel):
    messages: List[Dict[str, str]]
    topic: Optional[str] = None
    language: str = "en"
    intake_id: Optional[str] = None


class AIChatResponse(BaseModel):
    response: str
    usage: dict = Field(default_factory=dict)


ILLINOIS_SYSTEM_PROMPT = """Role & Purpose:
You are a careful legal information assistant for self-represented litigants (SRLs) in Illinois courts. You help people understand Illinois court procedures, forms, and options in plain language. You provide general legal information, not legal advice, and you do not represent the user.

Mandatory Disclaimer:
At the start of every new conversation, state clearly:
"I am not a lawyer. I can help you understand Illinois court procedures and forms, but I cannot give legal advice or tell you what you should do in your particular case."

Final Rule:
When in doubt, provide educational information only—not legal advice.
"""


def language_instruction(lang: str) -> str:
    l = (lang or "en").strip().lower()
    if l.startswith("es"):
        return "IMPORTANT: Respond ONLY in Spanish. Do NOT use English."
    return "IMPORTANT: Respond ONLY in English."


@app.get("/")
def read_root():
    return {
        "message": "Illinois Legal Triage Chatbot API",
        "status": "active",
        "endpoints": [
            "/health",
            "/chat",
            "/ai-chat",
            "/intake/start",
            "/intake/event",
            "/admin/intakes.csv",
            "/admin/stats",
        ],
    }


@app.get("/health")
def health_check():
    triage_exists = os.path.exists(TRIAGE_QUESTIONS_PATH)
    referral_exists = os.path.exists(REFERRAL_MAP_PATH)
    return {
        "status": "healthy",
        "data_files": {"triage_questions": triage_exists, "referral_map": referral_exists},
        "features": {
            "triage_chatbot": True,
            "ai_assistant": groq_configured,
            "crisis_detection": True,
            "progress_tracking": True,
            "intake_storage": bool(engine),
            "analytics": bool(engine),
        },
    }


# -----------------
# Intake endpoints
# -----------------
@app.post("/intake/start", response_model=IntakeStartResponse)
def intake_start(req: IntakeStartRequest):
    if not engine:
        raise HTTPException(status_code=503, detail="Database not configured")

    if not req.consent:
        raise HTTPException(status_code=400, detail="Consent is required")

    if not (req.first_name or "").strip():
        raise HTTPException(status_code=400, detail="First name is required")
    if not (req.last_name or "").strip():
        raise HTTPException(status_code=400, detail="Last name is required")
    if not (req.email or "").strip() or "@" not in req.email:
        raise HTTPException(status_code=400, detail="Valid email is required")
    if not (req.zip or "").strip() or not req.zip.strip().isdigit() or len(req.zip.strip()) != 5:
        raise HTTPException(status_code=400, detail="Valid 5-digit ZIP is required")

    phone_digits = normalize_us_phone(req.phone)
    intake_id = os.urandom(16).hex()
    lang = normalize_language(req.language)

    try:
        ensure_tables()
        with engine.begin() as conn:
            conn.execute(
                text("""
                INSERT INTO intakes (id, first_name, last_name, email, phone, zip, language, consent, created_at)
                VALUES (:id, :first_name, :last_name, :email, :phone, :zip, :language, :consent, :created_at)
                """),
                {
                    "id": intake_id,
                    "first_name": req.first_name.strip(),
                    "last_name": req.last_name.strip(),
                    "email": req.email.strip().lower(),
                    "phone": phone_digits,
                    "zip": req.zip.strip(),
                    "language": lang,
                    "consent": True,
                    "created_at": utc_now_iso(),
                },
            )
            ensure_triage_session_row(conn, intake_id)

        return IntakeStartResponse(intake_id=intake_id)
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.post("/intake/event")
def intake_event(req: IntakeEventRequest):
    if not engine:
        raise HTTPException(status_code=503, detail="Database not configured")

    if not req.intake_id or not req.event_type:
        raise HTTPException(status_code=400, detail="Missing intake_id or event_type")

    event_id = os.urandom(16).hex()

    try:
        ensure_tables()
        with engine.begin() as conn:
            conn.execute(
                text("""
                INSERT INTO intake_events (id, intake_id, event_type, event_value, created_at)
                VALUES (:id, :intake_id, :event_type, :event_value, :created_at)
                """),
                {
                    "id": event_id,
                    "intake_id": req.intake_id,
                    "event_type": req.event_type.strip(),
                    "event_value": (req.event_value or "").strip(),
                    "created_at": utc_now_iso(),
                },
            )

            update_triage_session_from_event(
                conn=conn,
                intake_id=req.intake_id,
                event_type=req.event_type,
                event_value=req.event_value,
            )

        return {"status": "ok"}
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


# -----------------
# Admin CSV export
# -----------------
@app.get("/admin/intakes.csv")
def export_intakes_csv(request: Request):
    if not engine:
        raise HTTPException(status_code=503, detail="Database not configured")
    if not ADMIN_EXPORT_KEY:
        raise HTTPException(status_code=500, detail="ADMIN_EXPORT_KEY not configured")

    provided = request.headers.get("X-Admin-Key", "")
    if provided != ADMIN_EXPORT_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        ensure_tables()
        with engine.begin() as conn:
            rows = conn.execute(text("""
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
                  COALESCE((
                    SELECT string_agg(e.event_value, '; ' ORDER BY e.created_at)
                    FROM intake_events e
                    WHERE e.intake_id = i.id AND e.event_type = 'topic_selected'
                  ), '') AS topics_selected
                FROM intakes i
                ORDER BY i.created_at DESC
            """)).fetchall()

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


@app.get("/admin/stats")
def admin_stats(request: Request):
    if not engine:
        raise HTTPException(status_code=503, detail="Database not configured")
    if not ADMIN_EXPORT_KEY:
        raise HTTPException(status_code=500, detail="ADMIN_EXPORT_KEY not configured")

    provided = request.headers.get("X-Admin-Key", "")
    if provided != ADMIN_EXPORT_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        ensure_tables()
        with engine.begin() as conn:
            overview = conn.execute(text("""
                SELECT
                  COUNT(*) AS total_sessions,
                  COUNT(*) FILTER (WHERE completed = TRUE) AS completed_sessions,
                  COUNT(*) FILTER (WHERE ai_used = TRUE) AS ai_used_sessions,
                  COUNT(*) FILTER (WHERE emergency = 'yes') AS emergency_sessions
                FROM triage_sessions
            """)).mappings().first()

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

        total_sessions = int(overview["total_sessions"] or 0)
        completed_sessions = int(overview["completed_sessions"] or 0)
        ai_used_sessions = int(overview["ai_used_sessions"] or 0)
        emergency_sessions = int(overview["emergency_sessions"] or 0)

        completion_rate = round(
            (completed_sessions / total_sessions) * 100, 2
        ) if total_sessions else 0.0

        return JSONResponse(
            {
                "overview": {
                    "total_sessions": total_sessions,
                    "completed_sessions": completed_sessions,
                    "incomplete_sessions": max(total_sessions - completed_sessions, 0),
                    "completion_rate_percent": completion_rate,
                    "ai_used_sessions": ai_used_sessions,
                    "emergency_sessions": emergency_sessions,
                },
                "top_topics": [dict(row) for row in top_topics],
                "top_zips": [dict(row) for row in top_zips],
                "level_breakdown": [dict(row) for row in level_breakdown],
                "recent_sessions": [dict(row) for row in recent_sessions],
            }
        )
    except SQLAlchemyError as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


# -----------------
# Chat endpoint
# -----------------
@app.post("/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest):
    referral_map = load_json_file(REFERRAL_MAP_PATH)

    message = (request.message or "").lower().strip()
    state = request.conversation_state or {}
    _lang = normalize_language(request.language)

    if detect_crisis_keywords(message) and state.get("step") not in ["topic_selection", None]:
        return ChatResponse(
            response_key="triage.emergency.crisisDetectedBody",
            response_params={},
            options=["continue_to_legal_resources", "restart"],
            conversation_state=state,
            progress=get_step_progress(state.get("step")),
        )

    if not state or message in ["start", "begin", "start over"]:
        new_state = {"step": "topic_selection"}
        return ChatResponse(
            response_key="triage.topic.prompt",
            response_params={},
            options=["child_support", "education", "housing", "divorce", "custody"],
            conversation_state=new_state,
            progress=get_step_progress(new_state.get("step")),
        )

    if message == "restart":
        log_intake_event(request.intake_id, "triage_restart", "restart")
        new_state = {"step": "topic_selection"}
        return ChatResponse(
            response_key="triage.topic.prompt",
            response_params={},
            options=["child_support", "education", "housing", "divorce", "custody"],
            conversation_state=new_state,
            progress=get_step_progress(new_state.get("step")),
        )

    if state.get("step") == "topic_selection":
        topics = {
            "child support": "child_support",
            "child_support": "child_support",
            "education": "education",
            "housing": "housing",
            "divorce": "divorce",
            "custody": "custody",
        }
        selected_topic = topics.get(message)

        if selected_topic:
            log_intake_event(request.intake_id, "topic_selected", selected_topic)
            state["topic"] = selected_topic
            state["step"] = "emergency_check"
            return ChatResponse(
                response_key="triage.topic.selected",
                response_params={"topic": selected_topic},
                options=["yes", "no", "unknown"],
                conversation_state=state,
                progress=get_step_progress(state.get("step")),
            )

        return ChatResponse(
            response_key="triage.topic.invalid",
            response_params={},
            options=["child_support", "education", "housing", "divorce", "custody"],
            conversation_state=state,
            progress=get_step_progress(state.get("step")),
        )

    if state.get("step") == "emergency_check":
        if message == "yes":
            state["emergency"] = "yes"
            log_intake_event(request.intake_id, "emergency_answer", "yes")
            state["step"] = "court_status"
            return ChatResponse(
                response_key="triage.emergency.policeNote",
                response_params={},
                options=["yes", "no"],
                conversation_state=state,
                progress=get_step_progress(state.get("step")),
            )

        if message == "no":
            state["emergency"] = "no"
            log_intake_event(request.intake_id, "emergency_answer", "no")
            state["step"] = "court_status"
        elif message in ["i don't know", "unknown", "not sure", "not_sure"]:
            state["emergency"] = "unknown"
            log_intake_event(request.intake_id, "emergency_answer", "unknown")
            state["step"] = "court_status"
        else:
            return ChatResponse(
                response_key="triage.emergency.invalid",
                response_params={},
                options=["yes", "no", "unknown"],
                conversation_state=state,
                progress=get_step_progress(state.get("step")),
            )

        return ChatResponse(
            response_key="triage.court.prompt",
            response_params={},
            options=["yes", "no"],
            conversation_state=state,
            progress=get_step_progress(state.get("step")),
        )

    if state.get("step") == "court_status":
        if message == "yes":
            state["in_court"] = True
            log_intake_event(request.intake_id, "court_answer", "yes")
            state["step"] = "income_check"
        elif message == "no":
            state["in_court"] = False
            log_intake_event(request.intake_id, "court_answer", "no")
            state["step"] = "income_check"
        else:
            return ChatResponse(
                response_key="triage.court.invalid",
                response_params={},
                options=["yes", "no"],
                conversation_state=state,
                progress=get_step_progress(state.get("step")),
            )

        return ChatResponse(
            response_key="triage.income.prompt",
            response_params={},
            options=["yes", "no", "not_sure"],
            conversation_state=state,
            progress=get_step_progress(state.get("step")),
        )

    if state.get("step") == "income_check":
        if message in ["yes", "not_sure"]:
            state["income_eligible"] = True
            state["income"] = "yes"
            log_intake_event(request.intake_id, "income_answer", message)
        elif message == "no":
            state["income_eligible"] = False
            state["income"] = "no"
            log_intake_event(request.intake_id, "income_answer", "no")
        else:
            return ChatResponse(
                response_key="triage.income.invalid",
                response_params={},
                options=["yes", "no", "not_sure"],
                conversation_state=state,
                progress=get_step_progress(state.get("step")),
            )

        state["step"] = "get_zip"
        return ChatResponse(
            response_key="triage.zip.prompt",
            response_params={},
            options=[],
            conversation_state=state,
            progress=get_step_progress(state.get("step")),
        )

    if state.get("step") == "get_zip":
        if message.isdigit() and len(message) == 5:
            state["zip_code"] = message
            log_intake_event(request.intake_id, "zip_entered", message)

            topic = state.get("topic", "general")
            emergency = state.get("emergency", "no")
            in_court = state.get("in_court", False)
            income_eligible = state.get("income_eligible", False)

            if emergency == "yes" or in_court:
                level = 3
                level_name = "direct legal assistance"
            elif (not in_court) and income_eligible:
                level = 2
                level_name = "self-help legal information"
            else:
                level = 1
                level_name = "general legal information"

            state["level"] = level
            log_intake_event(request.intake_id, "triage_level_assigned", str(level))

            referrals = referral_map.get(topic, {}).get(f"level_{level}", [])

            if not income_eligible:
                referrals = [
                    ref for ref in referrals
                    if not any(
                        keyword in ref.get("name", "").lower()
                        for keyword in ["legal aid", "prairie state", "carpls"]
                    )
                ]
                for ref in referrals:
                    if "Chicago Advocate Legal, NFP" in ref.get("name", ""):
                        ref["is_nfp"] = True

            referral_names = [ref.get("name", "").strip() for ref in referrals if ref.get("name")]
            log_intake_event(request.intake_id, "referrals_shown", json.dumps(referral_names, ensure_ascii=False))
            log_intake_event(request.intake_id, "triage_completed", "complete")

            final_state = {
                "step": "complete",
                "topic": topic,
                "level": level,
                "zip_code": message,
                "income": state.get("income", "yes"),
            }

            return ChatResponse(
                response_key="triage.results.intro",
                response_params={"levelName": level_name, "topic": topic},
                referrals=referrals,
                options=["continue", "restart", "connect"],
                conversation_state=final_state,
                progress=get_step_progress(final_state.get("step")),
            )

        return ChatResponse(
            response_key="triage.zip.invalid",
            response_params={},
            options=[],
            conversation_state=state,
            progress=get_step_progress(state.get("step")),
        )

    if state.get("step") == "complete":
        if message == "continue":
            new_state = {
                "step": "continue_check",
                "topic": state.get("topic"),
                "level": state.get("level"),
                "zip_code": state.get("zip_code"),
                "income": state.get("income"),
            }
            return ChatResponse(
                response_key="triage.continueCheck.prompt",
                response_params={},
                options=["yes", "no"],
                conversation_state=new_state,
                progress=get_step_progress(new_state.get("step")),
            )

        if message == "connect":
            topic = state.get("topic", "general")
            level = state.get("level", 1)
            zip_code = state.get("zip_code", "")
            income = state.get("income", "yes")

            referrals = referral_map.get(topic, {}).get(f"level_{level}", [])

            if income == "no":
                referrals = [
                    ref for ref in referrals
                    if not any(
                        keyword in ref.get("name", "").lower()
                        for keyword in ["legal aid", "prairie state", "carpls"]
                    )
                ]
                for ref in referrals:
                    if "Chicago Advocate Legal, NFP" in ref.get("name", ""):
                        ref["is_nfp"] = True

            top_resource = referrals[0] if referrals else None
            if top_resource:
                selected_state = {
                    "step": "resource_selected",
                    "topic": topic,
                    "level": level,
                    "zip_code": zip_code,
                    "income": income,
                }
                return ChatResponse(
                    response_key="triage.results.connectTop",
                    response_params={},
                    referrals=[top_resource],
                    options=["restart"],
                    conversation_state=selected_state,
                    progress=get_step_progress(selected_state.get("step")),
                )

            return ChatResponse(
                response_key="triage.results.connectFallback",
                response_params={},
                options=["restart"],
                conversation_state=state,
                progress=get_step_progress(state.get("step")),
            )

        return ChatResponse(
            response_key="triage.results.completeButtonsHint",
            response_params={},
            options=["continue", "restart", "connect"],
            conversation_state=state,
            progress=get_step_progress(state.get("step")),
        )

    if state.get("step") == "continue_check":
        if message == "yes":
            new_state = {"step": "topic_selection"}
            return ChatResponse(
                response_key="triage.topic.prompt",
                response_params={},
                options=["child_support", "education", "housing", "divorce", "custody"],
                conversation_state=new_state,
                progress=get_step_progress(new_state.get("step")),
            )

        if message == "no":
            return ChatResponse(
                response_key="triage.goodbye",
                response_params={},
                options=["restart"],
                conversation_state={"step": "complete"},
                progress=get_step_progress("complete"),
            )

        return ChatResponse(
            response_key="triage.continueCheck.invalid",
            response_params={},
            options=["yes", "no"],
            conversation_state=state,
            progress=get_step_progress(state.get("step")),
        )

    if state.get("step") == "resource_selected":
        return ChatResponse(
            response_key="triage.results.connectTop",
            response_params={},
            options=["restart"],
            conversation_state=state,
            progress=get_step_progress(state.get("step")),
        )

    return ChatResponse(
        response_key="triage.topic.prompt",
        response_params={},
        options=["child_support", "education", "housing", "divorce", "custody"],
        conversation_state={"step": "topic_selection"},
        progress=get_step_progress("topic_selection"),
    )


# -----------------
# AI chat endpoint
# -----------------
@app.post("/ai-chat", response_model=AIChatResponse)
def ai_chat(req: AIChatRequest):
    if not groq_configured or not groq_client:
        raise HTTPException(status_code=503, detail="AI assistant is not configured")

    if not req.messages:
        raise HTTPException(status_code=400, detail="messages are required")

    log_intake_event(req.intake_id, "ai_assistant_opened", req.topic or "general")

    try:
        system_parts = [
            ILLINOIS_SYSTEM_PROMPT,
            language_instruction(req.language),
        ]

        if req.topic:
            system_parts.append(f"Topic focus: {req.topic}")

        response = groq_client.chat.completions.create(
            model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
            messages=[
                {"role": "system", "content": "\n\n".join(system_parts)},
                *req.messages,
            ],
            temperature=0.2,
        )

        content = response.choices[0].message.content if response.choices else ""
        usage = {}

        if getattr(response, "usage", None):
            usage = {
                "prompt_tokens": getattr(response.usage, "prompt_tokens", 0),
                "completion_tokens": getattr(response.usage, "completion_tokens", 0),
                "total_tokens": getattr(response.usage, "total_tokens", 0),
            }

        return AIChatResponse(
            response=content or "I'm sorry, I couldn't generate a response right now.",
            usage=usage,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI chat error: {str(e)}")