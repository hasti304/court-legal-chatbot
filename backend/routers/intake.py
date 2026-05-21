from typing import List

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

try:
    from ..database import get_db
    from ..schemas.intake import (
        CallbackCreateRequest,
        IntakeEventRequest,
        IntakeProgressSessionCreate,
        IntakeProgressSessionUpdate,
        IntakeStartRequest,
        IntakeStartResponse,
        IntakeSubmissionCreate,
        IntakeSubmissionOut,
        SubmissionStatusUpdate,
    )
    from ..services.config_service import SUPPORTED_LANGS
    from ..services.intake_service import (
        create_callback_request,
        create_intake_event,
        create_intake_progress_session,
        create_intake_start,
        create_submission,
        get_intake_progress_session,
        get_my_case_status,
        get_my_referrals,
        get_my_sessions,
        get_submission,
        list_submissions,
        update_intake_progress_session,
        update_submission_status,
    )
except ImportError:
    from database import get_db  # type: ignore
    from schemas.intake import (  # type: ignore
        CallbackCreateRequest,
        IntakeEventRequest,
        IntakeProgressSessionCreate,
        IntakeProgressSessionUpdate,
        IntakeStartRequest,
        IntakeStartResponse,
        IntakeSubmissionCreate,
        IntakeSubmissionOut,
        SubmissionStatusUpdate,
    )
    from services.config_service import SUPPORTED_LANGS  # type: ignore
    from services.intake_service import (  # type: ignore
        create_callback_request,
        create_intake_event,
        create_intake_progress_session,
        create_intake_start,
        create_submission,
        get_intake_progress_session,
        get_my_case_status,
        get_my_referrals,
        get_my_sessions,
        get_submission,
        list_submissions,
        update_intake_progress_session,
        update_submission_status,
    )

router = APIRouter()


@router.post("/intake/start", response_model=IntakeStartResponse)
def intake_start(req: IntakeStartRequest, db: Session = Depends(get_db)):
    return create_intake_start(req=req, db=db, supported_langs=SUPPORTED_LANGS)


@router.post("/intake/event")
def intake_event(req: IntakeEventRequest):
    return create_intake_event(req)


@router.post("/intake/callback")
def intake_callback(req: CallbackCreateRequest):
    return create_callback_request(
        intake_id=req.intake_id,
        phone=req.phone,
        preferred_time=req.preferred_time,
    )


@router.post("/intake/submissions", response_model=IntakeSubmissionOut)
def create_intake_submission(payload: IntakeSubmissionCreate, db: Session = Depends(get_db)):
    return create_submission(payload=payload, db=db)


@router.get("/intake/submissions", response_model=List[IntakeSubmissionOut])
def list_intake_submissions(request: Request, limit: int = 20, db: Session = Depends(get_db)):
    return list_submissions(request=request, limit=limit, db=db)


@router.get("/intake/submissions/{submission_id}", response_model=IntakeSubmissionOut)
def get_intake_submission(submission_id: int, request: Request, db: Session = Depends(get_db)):
    return get_submission(submission_id=submission_id, request=request, db=db)


@router.get("/intake/my-sessions")
def my_sessions(x_intake_id: str = Header(None), db: Session = Depends(get_db)):
    intake_id = (x_intake_id or "").strip()
    if not intake_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return get_my_sessions(intake_id=intake_id, db=db)


@router.get("/intake/my-referrals")
def my_referrals(x_intake_id: str = Header(None), db: Session = Depends(get_db)):
    intake_id = (x_intake_id or "").strip()
    if not intake_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return get_my_referrals(intake_id=intake_id, db=db)


@router.get("/intake/my-case-status")
def my_case_status(x_intake_id: str = Header(None), db: Session = Depends(get_db)):
    intake_id = (x_intake_id or "").strip()
    if not intake_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return get_my_case_status(intake_id=intake_id, db=db)


@router.patch("/intake/submissions/{submission_id}/status", response_model=IntakeSubmissionOut)
def update_intake_submission_status(
    submission_id: int,
    body: SubmissionStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    return update_submission_status(submission_id=submission_id, status=body.status, request=request, db=db)


@router.post("/intake/session")
def create_intake_session_endpoint(req: IntakeProgressSessionCreate):
    return create_intake_progress_session(intake_id=req.intake_id)


@router.patch("/intake/session/{token}")
def update_intake_session_endpoint(token: str, req: IntakeProgressSessionUpdate):
    return update_intake_progress_session(token=token, current_step=req.current_step, answers=req.answers)


@router.get("/intake/session/{token}")
def get_intake_session_endpoint(token: str):
    return get_intake_progress_session(token=token)
