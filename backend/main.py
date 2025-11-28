from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os

# Get the directory where main.py is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# data/ folder is now inside backend/, so no need for ".."
DATA_DIR = os.path.join(BASE_DIR, "data")

# File paths
TRIAGE_QUESTIONS_PATH = os.path.join(DATA_DIR, "triage_questions.json")
REFERRAL_MAP_PATH = os.path.join(DATA_DIR, "referral_map.json")

app = FastAPI()

# CORS configuration for GitHub Pages frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://hasti304.github.io",
        "http://localhost:3000",
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load JSON data files
def load_json_file(file_path: str):
    """Load and return JSON data from file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        raise HTTPException(
            status_code=500, 
            detail=f"Data file not found: {file_path}"
        )
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500, 
            detail=f"Invalid JSON in file: {file_path}"
        )

# Request/Response models
class ChatRequest(BaseModel):
    message: str
    conversation_state: dict = {}

class ChatResponse(BaseModel):
    response: str
    options: list = []
    referrals: list = []
    conversation_state: dict = {}

@app.get("/")
def read_root():
    """Root endpoint"""
    return {
        "message": "Illinois Legal Triage Chatbot API",
        "status": "active",
        "endpoints": ["/health", "/chat"]
    }

@app.get("/health")
def health_check():
    """Health check endpoint"""
    # Verify data files exist
    triage_exists = os.path.exists(TRIAGE_QUESTIONS_PATH)
    referral_exists = os.path.exists(REFERRAL_MAP_PATH)
    
    return {
        "status": "healthy",
        "data_files": {
            "triage_questions": triage_exists,
            "referral_map": referral_exists
        },
        "paths": {
            "base_dir": BASE_DIR,
            "data_dir": DATA_DIR
        }
    }

@app.post("/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest):
    """Main chat endpoint for triage conversation"""
    
    # Load data files
    triage_questions = load_json_file(TRIAGE_QUESTIONS_PATH)
    referral_map = load_json_file(REFERRAL_MAP_PATH)
    
    message = request.message.lower().strip()
    state = request.conversation_state
    
    # Initialize conversation
    if not state or message in ["start", "restart", "begin"]:
        return ChatResponse(
            response="Hello! I'm here to help connect you with Illinois legal resources. This chatbot provides information only and is not legal advice. What legal topic do you need help with?",
            options=["Child Support", "Education", "Housing"],
            conversation_state={"step": "topic_selection"}
        )
    
    # Handle topic selection
    if state.get("step") == "topic_selection":
        topics = {"child support": "child_support", "education": "education", "housing": "housing"}
        selected_topic = topics.get(message)
        
        if selected_topic:
            state["topic"] = selected_topic
            state["step"] = "urgency_check"
            return ChatResponse(
                response=f"You selected {message.title()}. Is this an emergency situation requiring immediate attention?",
                options=["Yes", "No"],
                conversation_state=state
            )
        else:
            return ChatResponse(
                response="Please select a valid topic.",
                options=["Child Support", "Education", "Housing"],
                conversation_state=state
            )
    
    # Handle urgency check
    if state.get("step") == "urgency_check":
        if message == "yes":
            state["urgency"] = "high"
            state["level"] = 3
            state["step"] = "get_zip"
        elif message == "no":
            state["urgency"] = "low"
            state["step"] = "court_status"
        else:
            return ChatResponse(
                response="Please answer Yes or No.",
                options=["Yes", "No"],
                conversation_state=state
            )
        
        if state.get("step") == "get_zip":
            return ChatResponse(
                response="Please provide your Illinois ZIP code to find nearby legal assistance.",
                options=[],
                conversation_state=state
            )
        else:
            return ChatResponse(
                response="Do you currently have an open court case related to this issue?",
                options=["Yes", "No"],
                conversation_state=state
            )
    
    # Handle court status
    if state.get("step") == "court_status":
        if message == "yes":
            state["court_case"] = True
            state["level"] = 3
        elif message == "no":
            state["court_case"] = False
            state["level"] = 2
        else:
            return ChatResponse(
                response="Please answer Yes or No.",
                options=["Yes", "No"],
                conversation_state=state
            )
        
        state["step"] = "get_zip"
        return ChatResponse(
            response="Please provide your Illinois ZIP code to find resources near you.",
            options=[],
            conversation_state=state
        )
    
    # Handle ZIP code and provide referrals
    if state.get("step") == "get_zip":
        if message.isdigit() and len(message) == 5:
            state["zip_code"] = message
            
            # Get referrals based on topic and level
            topic = state.get("topic", "general")
            level = state.get("level", 1)
            
            referrals = referral_map.get(topic, {}).get(f"level_{level}", [])
            
            level_descriptions = {
                1: "general information and resources",
                2: "self-help legal information",
                3: "direct legal assistance"
            }
            
            return ChatResponse(
                response=f"Based on your situation, here are {level_descriptions[level]} for {topic.replace('_', ' ').title()} in Illinois:",
                referrals=referrals,
                options=["Start Over"],
                conversation_state={"step": "complete"}
            )
        else:
            return ChatResponse(
                response="Please provide a valid 5-digit ZIP code.",
                options=[],
                conversation_state=state
            )
    
    # Default fallback
    return ChatResponse(
        response="I didn't understand that. Would you like to start over?",
        options=["Start Over"],
        conversation_state=state
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
