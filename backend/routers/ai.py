from fastapi import APIRouter, HTTPException

try:
    from ..schemas.ai import AIChatRequest, AIChatResponse
    from ..services.ai_service import run_ai_chat
    from ..services.intake_service import log_intake_event
except ImportError:
    from schemas.ai import AIChatRequest, AIChatResponse  # type: ignore
    from services.ai_service import run_ai_chat  # type: ignore
    from services.intake_service import log_intake_event  # type: ignore

router = APIRouter()


@router.post("/ai-chat", response_model=AIChatResponse)
def ai_chat(req: AIChatRequest):
    log_intake_event(req.intake_id, "ai_assistant_opened", req.topic or "general")
    try:
        result = run_ai_chat(req)
        return AIChatResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI chat error: {str(e)}")
