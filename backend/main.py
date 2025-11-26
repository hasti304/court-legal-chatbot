from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Determine the correct path to data files
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "..", "data")

# Load triage questions
with open(os.path.join(DATA_DIR, "triage_questions.json"), "r") as f:
    triage_questions = json.load(f)

# Load referral map
with open(os.path.join(DATA_DIR, "referral_map.json"), "r") as f:
    referral_map = json.load(f)

# Cook County ZIP code prefixes
COOK_COUNTY_ZIPS = ["606", "607", "60007", "60018", "60068", "60076", "60193"]

class TriageAnswers(BaseModel):
    answers: dict

@app.get("/")
def read_root():
    return {"message": "Hello from your legal chatbot backend!"}

@app.get("/triage/questions")
def get_questions():
    return {"questions": triage_questions}

@app.post("/triage/result")
def get_result(data: TriageAnswers):
    answers = data.answers
    
    # Extract key triage values
    topic = answers.get("topic", "")
    urgency = answers.get("urgency", "")
    court_status = answers.get("court_status", "")
    zipcode = answers.get("zipcode", "")
    
    # Determine if user is in Cook County
    cook_county = any(zipcode.startswith(prefix) for prefix in COOK_COUNTY_ZIPS)
    
    # Find matching referral from map
    result = {"level": 1, "resource": "Illinois Legal Aid Online - https://www.illinoislegalaid.org/"}
    
    for entry in referral_map:
        if (entry["topic"] == topic and 
            entry["urgency"] == urgency and 
            entry["court_status"] == court_status):
            result = entry["referral"]
            break
    
    # Cook County override for Level 3
    if result["level"] == 3 and cook_county:
        if topic == "Housing" or urgency == "Emergency (court date within 30 days)":
            result["resource"] = "Chicago Advocate Legal, NFP - https://www.chicagoadvocatelegal.com/"
    
    return {"referral": result}

@app.post("/feedback")
def submit_feedback(data: dict):
    # In production, save feedback to database
    # For now, just acknowledge receipt
    print("Feedback received:", data)
    return {"status": "success", "message": "Thank you for your feedback!"}
