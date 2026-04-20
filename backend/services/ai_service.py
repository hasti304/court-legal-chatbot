import os

from fastapi import HTTPException

try:
    from .config_service import groq_client, groq_configured
except ImportError:
    from services.config_service import groq_client, groq_configured  # type: ignore


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


def run_ai_chat(req):
    if not groq_configured or not groq_client:
        raise HTTPException(status_code=503, detail="AI assistant is not configured")
    if not req.messages:
        raise HTTPException(status_code=400, detail="messages are required")

    system_parts = [ILLINOIS_SYSTEM_PROMPT, language_instruction(req.language)]
    if req.topic:
        system_parts.append(f"Topic focus: {req.topic}")

    response = groq_client.chat.completions.create(
        model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
        messages=[{"role": "system", "content": "\n\n".join(system_parts)}, *req.messages],
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

    return {"response": content or "I'm sorry, I couldn't generate a response right now.", "usage": usage}
