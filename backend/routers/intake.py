from typing import List

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

try:
    from ..database import get_db
    from ..schemas.intake import (
        IntakeEventRequest,
        IntakeStartRequest,
        IntakeStartResponse,
        IntakeSubmissionCreate,
        IntakeSubmissionOut,
    )
    from ..services.config_service import SUPPORTED_LANGS
    from ..services.intake_service import (
        create_intake_event,
        create_intake_start,
        create_submission,
        get_submission,
        list_submissions,
    )
except ImportError:
    from database import get_db  # type: ignore
    from schemas.intake import (  # type: ignore
        IntakeEventRequest,
        IntakeStartRequest,
        IntakeStartResponse,
        IntakeSubmissionCreate,
        IntakeSubmissionOut,
    )
    from services.config_service import SUPPORTED_LANGS  # type: ignore
    from services.intake_service import (  # type: ignore
        create_intake_event,
        create_intake_start,
        create_submission,
        get_submission,
        list_submissions,
    )

router = APIRouter()


@router.post("/intake/start", response_model=IntakeStartResponse)
def intake_start(req: IntakeStartRequest, db: Session = Depends(get_db)):
    return create_intake_start(req=req, db=db, supported_langs=SUPPORTED_LANGS)


@router.post("/intake/event")
def intake_event(req: IntakeEventRequest):
    return create_intake_event(req)


@router.post("/intake/submissions", response_model=IntakeSubmissionOut)
def create_intake_submission(payload: IntakeSubmissionCreate, db: Session = Depends(get_db)):
    return create_submission(payload=payload, db=db)


@router.get("/intake/submissions", response_model=List[IntakeSubmissionOut])
def list_intake_submissions(request: Request, limit: int = 20, db: Session = Depends(get_db)):
    return list_submissions(request=request, limit=limit, db=db)


@router.get("/intake/submissions/{submission_id}", response_model=IntakeSubmissionOut)
def get_intake_submission(submission_id: int, request: Request, db: Session = Depends(get_db)):
    return get_submission(submission_id=submission_id, request=request, db=db)
