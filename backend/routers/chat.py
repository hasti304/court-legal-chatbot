from fastapi import APIRouter

try:
    from ..schemas.chat import ChatRequest, ChatResponse
    from ..services.config_service import REFERRAL_MAP_PATH
    from ..services.triage_service import load_json_file, run_chat_flow
except ImportError:
    from schemas.chat import ChatRequest, ChatResponse  # type: ignore
    from services.config_service import REFERRAL_MAP_PATH  # type: ignore
    from services.triage_service import load_json_file, run_chat_flow  # type: ignore

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest):
    referral_map = load_json_file(REFERRAL_MAP_PATH)
    result = run_chat_flow(request=request, referral_map=referral_map)
    return ChatResponse(**result)
