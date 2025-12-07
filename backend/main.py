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

# Enhanced CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://hasti304.github.io",
        "https://hasti304.github.io/court-legal-chatbot",
        "http://localhost:3000",
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
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
    if not state or message in ["start", "restart", "begin", "start over"]:
        return ChatResponse(
            response="Hello! I'm here to help connect you with Illinois legal resources. This chatbot provides legal information only and is not legal advice. What legal issue do you need help with?",
            options=["Child Support", "Education", "Housing", "Divorce", "Custody"],
            conversation_state={"step": "topic_selection"}
        )
    
    # Step 1: Topic selection
    if state.get("step") == "topic_selection":
        topics = {
            "child support": "child_support",
            "education": "education",
            "housing": "housing",
            "divorce": "divorce",
            "custody": "custody"
        }
        selected_topic = topics.get(message)
        
        if selected_topic:
            state["topic"] = selected_topic
            state["step"] = "emergency_check"
            return ChatResponse(
                response=f"You selected {message.title()}. Is this an emergency?",
                options=["Yes", "No", "I don't know"],
                conversation_state=state
            )
        else:
            return ChatResponse(
                response="Please select a valid legal issue.",
                options=["Child Support", "Education", "Housing", "Divorce", "Custody"],
                conversation_state=state
            )
    
    # Step 2: Emergency check
    if state.get("step") == "emergency_check":
        if message == "yes":
            state["emergency"] = "yes"
            state["step"] = "court_status"
        elif message == "no":
            state["emergency"] = "no"
            state["step"] = "court_status"
        elif message == "i don't know":
            state["emergency"] = "unknown"
            state["step"] = "court_status"
        else:
            return ChatResponse(
                response="Please select an option.",
                options=["Yes", "No", "I don't know"],
                conversation_state=state
            )
        
        return ChatResponse(
            response="Do you currently have an open court case related to this issue?",
            options=["Yes", "No"],
            conversation_state=state
        )
    
    # Step 3: Court status
    if state.get("step") == "court_status":
        if message == "yes":
            state["in_court"] = True
            state["step"] = "income_check"
        elif message == "no":
            state["in_court"] = False
            state["step"] = "income_check"
        else:
            return ChatResponse(
                response="Please answer Yes or No.",
                options=["Yes", "No"],
                conversation_state=state
            )
        
        return ChatResponse(
            response="Are you low-income or receiving public benefits (like SNAP, Medicaid, SSI)?",
            options=["Yes", "No", "Not Sure"],
            conversation_state=state
        )
    
    # Step 4: Income eligibility
    if state.get("step") == "income_check":
        if message in ["yes", "not sure"]:
            state["income_eligible"] = True
        elif message == "no":
            state["income_eligible"] = False
        else:
            return ChatResponse(
                response="Please select an option.",
                options=["Yes", "No", "Not Sure"],
                conversation_state=state
            )
        
        state["step"] = "get_zip"
        return ChatResponse(
            response="Please provide your Illinois ZIP code to find resources near you.",
            options=[],
            conversation_state=state
        )
    
    # Step 5: ZIP code and provide referrals
    if state.get("step") == "get_zip":
        if message.isdigit() and len(message) == 5:
            state["zip_code"] = message
            
            topic = state.get("topic", "general")
            emergency = state.get("emergency", "no")
            in_court = state.get("in_court", False)
            income_eligible = state.get("income_eligible", False)
            
            # Determine referral level
            if emergency == "yes" or in_court:
                level = 3  # Direct attorney referral
                level_name = "direct legal assistance"
            elif not in_court and income_eligible:
                level = 2  # Self-help resources
                level_name = "self-help legal information"
            else:
                level = 1  # General information
                level_name = "general legal information"
            
            state["level"] = level
            
            referrals = referral_map.get(topic, {}).get(f"level_{level}", [])
            
            cook_county_zips = ["60601", "60602", "60603", "60604", "60605", "60606", "60607", "60608", "60609", "60610", 
                               "60611", "60612", "60613", "60614", "60615", "60616", "60617", "60618", "60619", "60620",
                               "60621", "60622", "60623", "60624", "60625", "60626", "60628", "60629", "60630", "60631",
                               "60632", "60633", "60634", "60636", "60637", "60638", "60639", "60640", "60641", "60642",
                               "60643", "60644", "60645", "60646", "60647", "60649", "60651", "60652", "60653", "60654",
                               "60655", "60656", "60657", "60659", "60660", "60661", "60706", "60707", "60803", "60804",
                               "60805", "60827"]
            
            response_text = f"Based on your situation, here are {level_name} resources for {topic.replace('_', ' ').title()} in Illinois:"
            
            if level == 3 and message in cook_county_zips:
                response_text += "\n\nSince you're in Cook County, I'm including Chicago-specific legal aid organizations."
            
            return ChatResponse(
                response=response_text,
                referrals=referrals,
                options=["Continue", "Restart", "Connect with a Resource"],
                conversation_state={"step": "complete", "topic": topic, "level": level, "zip_code": message}
            )
        else:
            return ChatResponse(
                response="Please provide a valid 5-digit Illinois ZIP code.",
                options=[],
                conversation_state=state
            )
    
    # Handle post-referral actions
    if state.get("step") == "complete":
        if message == "continue":
            return ChatResponse(
                response="Would you like help with another legal issue?",
                options=["Yes", "No"],
                conversation_state={"step": "continue_check"}
            )
        elif message == "connect with a resource":
            # Get the top recommended resource based on their previous answers
            topic = state.get("topic", "general")
            level = state.get("level", 1)
            zip_code = state.get("zip_code", "")
            
            referrals = referral_map.get(topic, {}).get(f"level_{level}", [])
            
            # Prioritize Chicago Advocate Legal, NFP for Cook County
            cook_county_zips = ["60601", "60602", "60603", "60604", "60605", "60606", "60607", "60608", "60609", "60610", 
                               "60611", "60612", "60613", "60614", "60615", "60616", "60617", "60618", "60619", "60620",
                               "60621", "60622", "60623", "60624", "60625", "60626", "60628", "60629", "60630", "60631",
                               "60632", "60633", "60634", "60636", "60637", "60638", "60639", "60640", "60641", "60642",
                               "60643", "60644", "60645", "60646", "60647", "60649", "60651", "60652", "60653", "60654",
                               "60655", "60656", "60657", "60659", "60660", "60661", "60706", "60707", "60803", "60804",
                               "60805", "60827"]
            
            # Find Chicago Advocate Legal, NFP if in Cook County
            top_resource = None
            if zip_code in cook_county_zips:
                for ref in referrals:
                    if "Chicago Advocate Legal, NFP" in ref.get("name", ""):
                        top_resource = ref
                        break
            
            # Otherwise, use the first resource in the list
            if not top_resource and referrals:
                top_resource = referrals[0]
            
            if top_resource:
                return ChatResponse(
                    response="🎯 Here's your recommended contact for immediate assistance:",
                    referrals=[top_resource],
                    options=["Restart"],
                    conversation_state={"step": "resource_selected", "topic": topic, "level": level, "zip_code": zip_code}
                )
            else:
                return ChatResponse(
                    response="Please contact one of the organizations listed above for assistance with your legal issue.",
                    options=["Restart"],
                    conversation_state={"step": "complete"}
                )
        elif message == "restart":
            return ChatResponse(
                response="Hello! I'm here to help connect you with Illinois legal resources. This chatbot provides legal information only and is not legal advice. What legal issue do you need help with?",
                options=["Child Support", "Education", "Housing", "Divorce", "Custody"],
                conversation_state={"step": "topic_selection"}
            )
    
    # Handle "continue_check" step
    if state.get("step") == "continue_check":
        if message == "yes":
            return ChatResponse(
                response="What legal issue would you like help with?",
                options=["Child Support", "Education", "Housing", "Divorce", "Custody"],
                conversation_state={"step": "topic_selection"}
            )
        elif message == "no":
            return ChatResponse(
                response="Thank you for using Illinois Legal Triage. If you need help in the future, feel free to return. Take care!",
                options=["Restart"],
                conversation_state={"step": "complete"}
            )
    
    # Default fallback for unrecognized input
    return ChatResponse(
        response="I'm not sure I understood that. Here are some options to help you:\n\n• Click one of the buttons above\n• Use the Restart button to begin again\n• Type your ZIP code if I asked for it\n\nHow can I assist you?",
        options=["Restart"],
        conversation_state=state
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
