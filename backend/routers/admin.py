from typing import Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

try:
    from ..database import get_db
    from ..schemas.intake import AdminIntakeCreateRequest
    from ..services.admin_auth_service import try_login
    from ..services.config_service import SUPPORTED_LANGS
    from ..services.evidence_service import get_evidence_timeline_for_admin
    from ..services.intake_service import (
        admin_health_checks,
        admin_create_intake,
        admin_delete_intake,
        admin_stats,
        basic_analytics,
        export_intakes_csv,
        list_intake_events_for_admin,
        list_intakes_for_admin,
        send_intake_staff_email,
        set_intake_admin_status,
    )
except ImportError:
    from database import get_db  # type: ignore
    from schemas.intake import AdminIntakeCreateRequest  # type: ignore
    from services.admin_auth_service import try_login  # type: ignore
    from services.config_service import SUPPORTED_LANGS  # type: ignore
    from services.evidence_service import get_evidence_timeline_for_admin  # type: ignore
    from services.intake_service import (  # type: ignore
        admin_health_checks,
        admin_create_intake,
        admin_delete_intake,
        admin_stats,
        basic_analytics,
        export_intakes_csv,
        list_intake_events_for_admin,
        list_intakes_for_admin,
        send_intake_staff_email,
        set_intake_admin_status,
    )

router = APIRouter()


class AdminLoginBody(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=500)


class AdminIntakeStatusBody(BaseModel):
    status: Literal["pending", "rejected", "accepted"]
    send_notification: bool = False
    notification_note: str = Field(default="", max_length=4000)

    @field_validator("notification_note")
    @classmethod
    def strip_note(cls, v: str) -> str:
        return (v or "").strip()


class AdminIntakeEmailBody(BaseModel):
    subject: str = Field(min_length=1, max_length=240)
    body: str = Field(min_length=1, max_length=8000)

    @field_validator("subject", "body")
    @classmethod
    def strip_text(cls, v: str) -> str:
        return (v or "").strip()


@router.post("/admin/login")
def admin_login_endpoint(body: AdminLoginBody):
    token, expires_in = try_login(body.email, body.password)
    return {"access_token": token, "token_type": "bearer", "expires_in": expires_in}


@router.get("/admin/intakes")
def admin_intakes_list_endpoint(request: Request, db: Session = Depends(get_db)):
    return list_intakes_for_admin(request=request, db=db)


@router.get("/admin/intakes/{intake_id}/events")
def admin_intake_events_endpoint(
    intake_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    return list_intake_events_for_admin(request=request, intake_id=intake_id, db=db)


@router.get("/admin/intakes/{intake_id}/evidence")
def admin_intake_evidence_endpoint(
    intake_id: str,
    request: Request,
):
    return get_evidence_timeline_for_admin(request=request, intake_id=intake_id)


@router.post("/admin/intakes")
def admin_intake_create_endpoint(
    body: AdminIntakeCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    return admin_create_intake(
        request=request,
        db=db,
        supported_langs=SUPPORTED_LANGS,
        payload=body,
    )


@router.delete("/admin/intakes/{intake_id}")
def admin_intake_delete_endpoint(
    intake_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    return admin_delete_intake(request=request, intake_id=intake_id, db=db)


@router.patch("/admin/intakes/{intake_id}/status")
def admin_intake_status_endpoint(
    intake_id: str,
    body: AdminIntakeStatusBody,
    request: Request,
    db: Session = Depends(get_db),
):
    return set_intake_admin_status(
        request=request,
        intake_id=intake_id,
        status=body.status,
        db=db,
        send_notification=body.send_notification,
        notification_note=body.notification_note,
    )


@router.post("/admin/intakes/{intake_id}/email")
def admin_intake_send_email_endpoint(
    intake_id: str,
    body: AdminIntakeEmailBody,
    request: Request,
    db: Session = Depends(get_db),
):
    return send_intake_staff_email(request, intake_id, body.subject, body.body, db)


@router.get("/admin/intakes.csv")
def export_intakes_csv_endpoint(request: Request):
    return export_intakes_csv(request)


@router.get("/admin/stats")
def admin_stats_endpoint(request: Request):
    return admin_stats(request)


@router.get("/admin/basic-analytics")
def basic_analytics_endpoint(request: Request, db: Session = Depends(get_db)):
    return basic_analytics(request=request, db=db)


@router.get("/admin/health-checks")
def admin_health_checks_endpoint(request: Request, db: Session = Depends(get_db)):
    return admin_health_checks(request=request, db=db)
