from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from fastapi.responses import JSONResponse
import os
import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For dev only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Hello from your legal chatbot backend!"}

@app.get("/triage/questions")
def get_triage_questions():
    # Use absolute path to ensure it works no matter where uvicorn is run from
    dir_path = os.path.dirname(os.path.realpath(__file__))
    config_path = os.path.join(dir_path, '..', 'data', 'triage_config.json')
    with open(config_path, "r") as f:
        triage = json.load(f)
    return triage

@app.post("/triage/result")
async def triage_result(request: Request):
    data = await request.json()
    user_answers = data.get("answers", {})
    zipcode = user_answers.get("zipcode", "")

    # Cook County ZIP code logic
    is_cook = False
    # Cook County: ranges 60007–60827, majorly 606xx and 607xx as well
    if zipcode.startswith("60") and (
        zipcode.startswith("606") or zipcode.startswith("607") or
        (60007 <= int(zipcode) <= 60827)
    ):
        is_cook = True

    # Load resource mapping
    dir_path = os.path.dirname(os.path.realpath(__file__))
    map_path = os.path.join(dir_path, '..', 'data', 'referral_map.json')
    with open(map_path, "r") as f:
        referral_map = json.load(f)

    # Cook County override: Emergency or Housing sends to specific resource
    if is_cook and (
        user_answers.get("topic") == "Housing" or
        user_answers.get("urgency", "").startswith("Emergency")
    ):
        return {
            "referral": {
                "level": 3,
                "resource": "Chicago Advocate Legal, NFP (Cook County) - https://chicagoadvocatelegal.org"
            }
        }

    # Regular mapping
    for item in referral_map:
        if (
            item["topic"] == user_answers.get("topic") and
            item["urgency"] == user_answers.get("urgency") and
            item["court_status"] == user_answers.get("court_status")
        ):
            return {"referral": item["referral"]}

    # Default fallback
    return {"referral": {"level": 1, "resource": "Illinois Legal Aid Online - https://www.illinoislegalaid.org"}}

@app.post("/feedback")
async def save_feedback(request: Request):
    data = await request.json()
    # Save minimal, privacy-preserving log to a file
    dir_path = os.path.dirname(os.path.realpath(__file__))
    log_path = os.path.join(dir_path, "..", "data", "feedback_log.jsonl")
    # Append single JSON line
    with open(log_path, "a") as f:
        json.dump(data, f)
        f.write("\n")
    return {"ok": True}

