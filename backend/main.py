from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
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

# CORS must explicitly allow your GitHub Pages origin for browser requests.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://hasti304.github.io",
        "https://hasti304.github.io/court-legal-chatbot",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# --- Groq client ---
try:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("Warning: GROQ_API_KEY not found in environment variables")
        groq_configured = False
    else:
        groq_client = Groq(api_key=api_key)
        groq_configured = True
        print("Groq client initialized successfully")
except Exception as e:
    print(f"Warning: Groq client initialization failed: {e}")
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
# Postgres (Render) storage
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
    try:
        with engine.begin() as conn:
            conn.execute(text(create_intakes))
            conn.execute(text(create_events))
    except SQLAlchemyError as e:
        print(f"Warning: ensure_tables failed: {e}")

ensure_tables()

def normalize_us_phone(phone: str) -> str:
    digits = re.sub(r"[^0-9]", "", phone or "")
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) != 10:
        raise HTTPException(status_code=400, detail="Invalid phone number. Use a 10-digit US phone number.")
    return digits


# -------------
# API Schemas
# -------------
class ChatRequest(BaseModel):
    message: str
    conversation_state: dict = {}
    language: Optional[str] = "en"
    intake_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str = ""
    response_key: Optional[str] = None
    response_params: dict = {}
    options: list = []
    referrals: list = []
    conversation_state: dict = {}
    progress: dict = {}

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
    topic: str = None
    language: str = "en"

class AIChatResponse(BaseModel):
    response: str
    usage: dict = {}


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
        "endpoints": ["/health", "/chat", "/ai-chat", "/intake/start", "/intake/event", "/admin/intakes.csv"],
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


# -----------------
# Chat endpoint (existing + topic logging)
# -----------------
@app.post("/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest):
    referral_map = load_json_file(REFERRAL_MAP_PATH)

    message = (request.message or "").lower().strip()
    state = request.conversation_state or {}
    _lang = normalize_language(request.language)

    def log_topic(topic_code: str):
        if not engine or not request.intake_id:
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
                        "intake_id": request.intake_id,
                        "event_type": "topic_selected",
                        "event_value": topic_code,
                        "created_at": utc_now_iso(),
                    },
                )
        except Exception:
            pass

    if detect_crisis_keywords(message) and state.get("step") not in ["topic_selection", None]:
        return ChatResponse(
            response_key="triage.emergency.crisisDetectedBody",
            response_params={},
            options=["continue_to_legal_resources", "restart"],
            conversation_state=state,
            progress=get_step_progress(state.get("step")),
        )

    if not state or message in ["start", "restart", "begin", "start over"]:
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
            log_topic(selected_topic)
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
            state["step"] = "court_status"
        elif message in ["i don't know", "unknown"]:
            state["emergency"] = "unknown"
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
            state["step"] = "income_check"
        elif message == "no":
            state["in_court"] = False
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
        elif message == "no":
            state["income_eligible"] = False
            state["income"] = "no"
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
            new_state = {"step": "continue_check"}
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

        if message == "restart":
            new_state = {"step": "topic_selection"}
            return ChatResponse(
                response_key="triage.topic.prompt",
                response_params={},
                options=["child_support", "education", "housing", "divorce", "custody"],
                conversation_state=new_state,
                progress=get_step_progress(new_state.get("step")),
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
                response_key="triage.continueCheck.promptTopic",
                response_params={},
                options=["child_support", "education", "housing", "divorce", "custody"],
                conversation_state=new_state,
                progress=get_step_progress(new_state.get("step")),
            )

        if message == "no":
            end_state = {"step": "complete"}
            return ChatResponse(
                response_key="triage.continueCheck.goodbye",
                response_params={},
                options=["restart"],
                conversation_state=end_state,
                progress=get_step_progress(end_state.get("step")),
            )

        return ChatResponse(
            response_key="triage.continueCheck.invalid",
            response_params={},
            options=["yes", "no"],
            conversation_state=state,
            progress=get_step_progress(state.get("step")),
        )

    if message == "continue_to_legal_resources":
        new_state = {"step": "topic_selection"}
        return ChatResponse(
            response_key="triage.continueToLegalResources.prompt",
            response_params={},
            options=["child_support", "education", "housing", "divorce", "custody"],
            conversation_state=new_state,
            progress=get_step_progress(new_state.get("step")),
        )

    return ChatResponse(
        response_key="triage.fallback.prompt",
        response_params={},
        options=["restart"],
        conversation_state=state,
        progress=get_step_progress(state.get("step")),
    )


@app.post("/ai-chat", response_model=AIChatResponse)
async def ai_chat_endpoint(request: AIChatRequest):
    if not groq_configured:
        raise HTTPException(
            status_code=503,
            detail="AI assistant is not configured. Please add GROQ_API_KEY to environment variables.",
        )

    try:
        lang = normalize_language(request.language)
        system_prompt = ILLINOIS_SYSTEM_PROMPT + "\n\nLANGUAGE REQUIREMENT:\n" + language_instruction(lang)

        messages_for_groq = [{"role": "system", "content": system_prompt}]
        for msg in request.messages:
            messages_for_groq.append({"role": msg["role"], "content": msg["content"]})

        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages_for_groq,
            temperature=0.3,
            max_tokens=1000,
        )

        assistant_message = response.choices[0].message.content
        return AIChatResponse(response=assistant_message, usage={"model": "llama-3.3-70b-versatile", "provider": "groq"})
    except Exception as e:
        print(f"Error in AI chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
