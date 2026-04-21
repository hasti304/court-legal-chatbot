import os

from fastapi import APIRouter

try:
    from ..services.config_service import (
        REFERRAL_MAP_PATH,
        REFERRAL_OFFICE_GEO_PATH,
        TRIAGE_QUESTIONS_PATH,
        groq_configured,
    )
    from ..services.intake_service import engine
except ImportError:
    from services.config_service import (  # type: ignore
        REFERRAL_MAP_PATH,
        REFERRAL_OFFICE_GEO_PATH,
        TRIAGE_QUESTIONS_PATH,
        groq_configured,
    )
    from services.intake_service import engine  # type: ignore

router = APIRouter()


@router.get("/")
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
            "/intake/submissions",
            "/intake/submissions/{submission_id}",
            "/auth/magic-link/request",
            "/auth/magic-link/verify",
            "/auth/password/login",
            "/auth/password/forgot",
            "/auth/password/reset",
            "/auth/config-status",
            "/documents/email",
            "/resources",
            "/resources/{resource_id}",
            "/resources/categories",
            "/resources/suggested",
            "/admin/login",
            "/admin/intakes",
            "/admin/intakes/{intake_id}",
            "/admin/intakes/{intake_id}/events",
            "/admin/intakes/{intake_id}/status",
            "/admin/intakes/{intake_id}/email",
            "/admin/intakes.csv",
            "/admin/stats",
            "/admin/basic-analytics",
            "/admin/resources",
            "/admin/resources/bulk-import",
            "/admin/resources/bulk-import/csv",
            "/admin/resources/bulk-import/template.csv",
            "/admin/resources/{resource_id}",
            "/admin/resources/stale",
        ],
    }


@router.get("/health")
def health_check():
    triage_exists = os.path.exists(TRIAGE_QUESTIONS_PATH)
    referral_exists = os.path.exists(REFERRAL_MAP_PATH)
    referral_geo_exists = os.path.exists(REFERRAL_OFFICE_GEO_PATH)
    return {
        "status": "healthy",
        "data_files": {
            "triage_questions": triage_exists,
            "referral_map": referral_exists,
            "referral_office_geo": referral_geo_exists,
        },
        "features": {
            "triage_chatbot": True,
            "ai_assistant": groq_configured,
            "crisis_detection": True,
            "progress_tracking": True,
            "intake_storage": bool(engine),
            "analytics": bool(engine),
            "resource_hub": True,
        },
    }
