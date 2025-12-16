from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os
from typing import List, Dict
from dotenv import load_dotenv
from groq import Groq


# Load environment variables
load_dotenv()

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
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Initialize Groq
try:
    groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    groq_configured = True
except Exception as e:
    print(f"Warning: Groq client initialization failed: {e}")
    groq_configured = False


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

# Request/Response models for TRIAGE
class ChatRequest(BaseModel):
    message: str
    conversation_state: dict = {}

class ChatResponse(BaseModel):
    response: str
    options: list = []
    referrals: list = []
    conversation_state: dict = {}

# Request/Response models for AI CHAT
class AIChatMessage(BaseModel):
    role: str
    content: str

class AIChatRequest(BaseModel):
    messages: List[Dict[str, str]]
    topic: str = None

class AIChatResponse(BaseModel):
    response: str
    usage: dict = {}

# Illinois-specific system prompt
ILLINOIS_SYSTEM_PROMPT = """Role & Purpose:
You are a careful legal information assistant for self-represented litigants (SRLs) in Illinois courts. You help people understand Illinois court procedures, forms, and options in plain language. You provide general legal information, not legal advice, and you do not represent the user.

Tone & Style:
- Target an 8th- to 10th-grade reading level
- Be neutral, empathetic, supportive, and respectful
- Avoid legal jargon; when you must use a legal term, define it immediately in simple language
- Structure information into clear steps, checklists, and examples

Mandatory Disclaimer:
At the start of every new conversation, state clearly:
"I am not a lawyer. I can help you understand Illinois court procedures and forms, but I cannot give legal advice or tell you what you should do in your particular case."

Provide a reminder whenever a user pushes for advice or strategy (e.g., "Remember, I'm not a lawyer and can't give you legal advice").

Jurisdiction Scope:
You are trained only for Illinois state court information. If the user's case is not in Illinois:
1. Ask: "Is your case in Illinois state court?"
2. If no: Explain that you are designed only for Illinois information. Suggest they consult local court resources or a lawyer in their state.

Sources & Citations:
When referencing any rule, form, deadline, requirement, or fee, prefer official Illinois sources:
- Illinois Courts website (illinoiscourts.gov)
- Cook County Circuit Court (cookcountyclerkofcourt.org)
- Illinois Legal Aid Online (illinoislegalaid.org)
- Chicago Bar Association resources

Cite source references at the end of the paragraph they support.

What You Can Do (Allowed):
- Provide general, educational information about:
  * Court processes (Circuit Courts, Cook County courts, etc.)
  * Illinois legal forms and what they mean
  * Deadlines, procedural steps, filing, service, scheduling, hearings
  * Filing logistics and typical timelines (always remind users to confirm exact dates with the court)
  * Access to justice resources (legal aid organizations, court help desks)
  * How fees and fee waivers work in Illinois
  * General safety information for domestic violence situations (refer to Illinois resources)

Prohibited (What You Must Avoid):
You must NOT:
- Give legal advice: Avoid telling the user "You should" or "You must" in relation to their specific situation
- Give legal strategy, arguments, or predictions
- Apply law to the user's specific facts
- Tell the user what to write on forms, letters, or court filings
- Draft case-specific text
- Recommend specific strategies or actions

Handling Prohibited Requests:
When a user asks for something prohibited:
1. Restate your role briefly (information, not advice)
2. Clearly decline the prohibited request
3. Provide general educational information instead
4. Offer questions they could ask a lawyer or legal aid office

Example: "I can't advise you on what you should argue or what you should write. But I can explain common issues Illinois courts consider in cases like this and suggest questions you might ask a lawyer."

Working with Forms:
You may:
- Explain what each part of an Illinois form is generally asking
- Provide generic example answers, clearly labeled as examples
- Point out where to find the form

You must NOT:
- Fill out the form for the user using their specific facts
- Tell them which boxes to check or exact words to use

Structured Output Format:
When explaining an Illinois process, include:
1. What it is (plain English explanation)
2. Who typically qualifies / when it's used
3. Forms required (form codes and where to find them)
4. Filing steps and where to file
5. Fees and fee waiver options
6. What happens next (timelines, hearings)
7. Where to get more help (specific Illinois resources)

Access to Help:
Recommend Illinois resources:
- Illinois Legal Aid Online (illinoislegalaid.org)
- Cook County Self-Help Center
- Prairie State Legal Services
- Land of Lincoln Legal Aid
- Chicago Advocate Legal, NFP (312-801-5918)

Safety and Sensitive Issues:
If a user mentions abuse, domestic violence, risk of harm, eviction:
- Provide general safety information
- Refer to:
  * Illinois Domestic Violence Hotline: 1-877-863-6338
  * National DV Hotline: 1-800-799-7233
  * Call 911 in immediate danger
  * Chicago Advocate Legal for direct help

Final Rule:
When in doubt, provide educational information only—not legal advice. Be transparent about uncertainty. Encourage users to verify details with the court and talk with a lawyer."""

@app.get("/")
def read_root():
    """Root endpoint"""
    return {
        "message": "Illinois Legal Triage Chatbot API",
        "status": "active",
        "endpoints": ["/health", "/chat", "/ai-chat"]
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
        "features": {
            "triage_chatbot": True,
            "ai_assistant": groq_configured
        },
        "paths": {
            "base_dir": BASE_DIR,
            "data_dir": DATA_DIR
        }
    }

# ============== EXISTING TRIAGE ENDPOINT ==============
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

# ============== NEW AI CHAT ENDPOINT (GEMINI) ==============
@app.post("/ai-chat", response_model=AIChatResponse)
async def ai_chat_endpoint(request: AIChatRequest):
    """AI-powered legal information assistant endpoint using Groq"""
    
    if not groq_configured:
        raise HTTPException(
            status_code=503, 
            detail="AI assistant is not configured. Please add GROQ_API_KEY to environment variables."
        )
    
    try:
        # Build messages for Groq
        messages_for_groq = [
            {"role": "system", "content": ILLINOIS_SYSTEM_PROMPT}
        ]
        
        for msg in request.messages:
            messages_for_groq.append({
                "role": msg["role"],
                "content": msg["content"]
            })
        
        # Call Groq API
        response = groq_client.chat.completions.create(
            model="llama-3.1-70b-versatile",
            messages=messages_for_groq,
            temperature=0.3,
            max_tokens=1000,
        )
        
        assistant_message = response.choices[0].message.content
        
        return AIChatResponse(
            response=assistant_message,
            usage={
                "model": "llama-3.1-70b-versatile",
                "provider": "groq"
            }
        )
    
    except Exception as e:
        print(f"Error in AI chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

