from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

try:
    from ..database import get_db
    from ..schemas.auth import (
        MagicLinkRequestBody,
        MagicLinkRequestResponse,
        MagicLinkVerifyBody,
        MagicLinkVerifyResponse,
        PasswordForgotBody,
        PasswordForgotResponse,
        PasswordLoginBody,
        PasswordLoginResponse,
        PasswordResetBody,
        PasswordResetResponse,
    )
    from ..services.magic_link_service import request_magic_link, verify_magic_link
    from ..services.auth_password_service import (
        login_with_password,
        request_password_reset,
        reset_password,
    )
except ImportError:
    from database import get_db  # type: ignore
    from schemas.auth import (  # type: ignore
        MagicLinkRequestBody,
        MagicLinkRequestResponse,
        MagicLinkVerifyBody,
        MagicLinkVerifyResponse,
        PasswordForgotBody,
        PasswordForgotResponse,
        PasswordLoginBody,
        PasswordLoginResponse,
        PasswordResetBody,
        PasswordResetResponse,
    )
    from services.magic_link_service import request_magic_link, verify_magic_link  # type: ignore
    from services.auth_password_service import (  # type: ignore
        login_with_password,
        request_password_reset,
        reset_password,
    )

router = APIRouter()


@router.post("/auth/magic-link/request", response_model=MagicLinkRequestResponse)
def magic_link_request(payload: MagicLinkRequestBody, db: Session = Depends(get_db)):
    return request_magic_link(payload=payload, db=db)


@router.post("/auth/magic-link/verify", response_model=MagicLinkVerifyResponse)
def magic_link_verify(payload: MagicLinkVerifyBody, db: Session = Depends(get_db)):
    return verify_magic_link(payload=payload, db=db)


@router.post("/auth/password/login", response_model=PasswordLoginResponse)
def password_login(payload: PasswordLoginBody, db: Session = Depends(get_db)):
    return login_with_password(payload=payload, db=db)


@router.post("/auth/password/forgot", response_model=PasswordForgotResponse)
def password_forgot(payload: PasswordForgotBody, db: Session = Depends(get_db)):
    return request_password_reset(payload=payload, db=db)


@router.post("/auth/password/reset", response_model=PasswordResetResponse)
def password_reset(payload: PasswordResetBody, db: Session = Depends(get_db)):
    return reset_password(payload=payload, db=db)
