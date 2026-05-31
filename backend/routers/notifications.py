from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

try:
    from ..database import get_db
    from ..models.intake import Intake
    from ..services.intake_service import ensure_tables
except ImportError:
    from database import get_db  # type: ignore
    from models.intake import Intake  # type: ignore
    from services.intake_service import ensure_tables  # type: ignore

router = APIRouter()


def _require_intake(x_intake_id: str, db: Session) -> str:
    intake_id = (x_intake_id or "").strip()
    if not intake_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    intake = db.query(Intake).filter(Intake.id == intake_id).first()
    if not intake:
        raise HTTPException(status_code=401, detail="Invalid session")
    return intake_id


@router.get("/notifications")
def get_notifications(x_intake_id: str = Header(None), db: Session = Depends(get_db)):
    intake_id = _require_intake(x_intake_id, db)
    ensure_tables()
    rows = db.execute(
        text(
            """
            SELECT id, intake_id, message, is_read, created_at
            FROM notifications
            WHERE intake_id = :intake_id
            ORDER BY created_at DESC
            LIMIT 50
            """
        ),
        {"intake_id": intake_id},
    ).mappings().all()
    return [
        {
            "id": r["id"],
            "intake_id": r["intake_id"],
            "message": r["message"],
            "is_read": bool(r["is_read"]),
            "created_at": r["created_at"],
        }
        for r in rows
    ]


@router.patch("/notifications/read-all")
def mark_all_notifications_read(x_intake_id: str = Header(None), db: Session = Depends(get_db)):
    intake_id = _require_intake(x_intake_id, db)
    db.execute(
        text("UPDATE notifications SET is_read = TRUE WHERE intake_id = :intake_id"),
        {"intake_id": intake_id},
    )
    db.commit()
    return {"ok": True}


@router.patch("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    x_intake_id: str = Header(None),
    db: Session = Depends(get_db),
):
    intake_id = _require_intake(x_intake_id, db)
    nid = (notification_id or "").strip()
    if not nid:
        raise HTTPException(status_code=400, detail="Invalid notification id")
    db.execute(
        text(
            "UPDATE notifications SET is_read = TRUE "
            "WHERE id = :nid AND intake_id = :intake_id"
        ),
        {"nid": nid, "intake_id": intake_id},
    )
    db.commit()
    return {"ok": True}
