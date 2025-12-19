from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

REFERRALS_DB = {
    "child_support": {
        "low_income": {
            "not_emergency": {
                "no_court": [
                    {
                        "name": "Illinois Legal Aid Online",
                        "url": "https://www.illinoislegalaid.org",
                        "description": "Self-help legal information and forms for child support cases in Illinois.",
                        "phone": "",
                        "intake_form": "",
                        "intake_instructions": "",
                        "is_nfp": False
                    },
                    {
                        "name": "Chicago Advocate Legal (CAL)",
                        "url": "https://www.chicagoadvocatelegal.com",
                        "description": "Free legal support for low-income families in Chicago. Schedule an intake appointment with Cindy to discuss your child support case.",
                        "phone": "",
                        "intake_form": "",
                        "intake_instructions": "Click the button below to schedule an intake appointment with Cindy at CAL.",
                        "is_nfp": True
                    }
                ],
                "has_court": [
                    {
                        "name": "Illinois Legal Aid Online",
                        "url": "https://www.illinoislegalaid.org",
                        "description": "Self-help legal information and forms for child support cases in Illinois.",
                        "phone": "",
                        "intake_form": "",
                        "intake_instructions": "",
                        "is_nfp": False
                    },
                    {
                        "name": "Chicago Advocate Legal (CAL)",
                        "url": "https://www.chicagoadvocatelegal.com",
                        "description": "Free legal support for low-income families in Chicago with pending court cases.",
                        "phone": "",
                        "intake_form": "",
                        "intake_instructions": "Click the button below to schedule an intake appointment with Cindy at CAL.",
                        "is_nfp": True
                    },
                    {
                        "name": "Prairie State Legal Services",
                        "url": "https://www.pslegal.org",
                        "description": "Free civil legal aid for eligible low-income residents in Illinois.",
                        "phone": "800-942-4612",
                        "intake_form": "https://www.pslegal.org/apply-for-help",
                        "intake_instructions": "Call or complete the online application.",
                        "is_nfp": False
                    }
                ]
            },
            "emergency": [
                {
                    "name": "Illinois Domestic Violence Hotline",
                    "url": "https://www.iladvocates.org",
                    "description": "24/7 crisis support for domestic violence situations.",
                    "phone": "877-863-6338",
                    "intake_form": "",
                    "intake_instructions": "Call immediately for emergency assistance.",
                    "is_nfp": False
                },
                {
                    "name": "Chicago Advocate Legal (CAL)",
                    "url": "https://www.chicagoadvocatelegal.com",
                    "description": "Emergency legal support for families in crisis.",
                    "phone": "",
                    "intake_form": "",
                    "intake_instructions": "Click the button below to schedule an urgent intake appointment with Cindy at CAL.",
                    "is_nfp": True
                }
            ]
        },
        "not_low_income": [
            {
                "name": "Illinois State Bar Association Lawyer Finder",
                "url": "https://www.isba.org/public/illinoislawyerfinder",
                "description": "Find a private attorney specializing in child support law.",
                "phone": "",
                "intake_form": "",
                "intake_instructions": "",
                "is_nfp": False
            },
            {
                "name": "Chicago Bar Association Lawyer Referral Service",
                "url": "https://www.chicagobar.org/page/LRS",
                "description": "Lawyer referral service for Chicago residents.",
                "phone": "312-554-2001",
                "intake_form": "",
                "intake_instructions": "",
                "is_nfp": False
            }
        ]
    },
    "education": {
        "low_income": {
            "not_emergency": {
                "no_court": [
                    {
                        "name": "Equip for Equality",
                        "url": "https://www.equipforequality.org",
                        "description": "Free legal advocacy for students with disabilities and special education issues.",
                        "phone": "800-537-2632",
                        "intake_form": "https://www.equipforequality.org/intake/",
                        "intake_instructions": "",
                        "is_nfp": False
                    },
                    {
                        "name": "Chicago Advocate Legal (CAL)",
                        "url": "https://www.chicagoadvocatelegal.com",
                        "description": "Free legal support for education-related issues including IEPs and school rights.",
                        "phone": "",
                        "intake_form": "",
                        "intake_instructions": "Click the button below to schedule an intake appointment with Cindy at CAL.",
                        "is_nfp": True
                    }
                ],
                "has_court": [
                    {
                        "name": "Equip for Equality",
                        "url": "https://www.equipforequality.org",
                        "description": "Free legal advocacy for students with disabilities and special education issues.",
                        "phone": "800-537-2632",
                        "intake_form": "https://www.equipforequality.org/intake/",
                        "intake_instructions": "",
                        "is_nfp": False
                    },
                    {
                        "name": "Chicago Advocate Legal (CAL)",
                        "url": "https://www.chicagoadvocatelegal.com",
                        "description": "Free legal support for education-related court cases.",
                        "phone": "",
                        "intake_form": "",
                        "intake_instructions": "Click the button below to schedule an intake appointment with Cindy at CAL.",
                        "is_nfp": True
                    }
                ]
            },
            "emergency": [
                {
                    "name": "Equip for Equality - Crisis Line",
                    "url": "https://www.equipforequality.org",
                    "description": "Immediate assistance for urgent special education matters.",
                    "phone": "800-537-2632",
                    "intake_form": "",
                    "intake_instructions": "Call immediately for emergency support.",
                    "is_nfp": False
                }
            ]
        },
        "not_low_income": [
            {
                "name": "Illinois State Bar Association Lawyer Finder",
                "url": "https://www.isba.org/public/illinoislawyerfinder",
                "description": "Find a private attorney specializing in education law.",
                "phone": "",
                "intake_form": "",
                "intake_instructions": "",
                "is_nfp": False
            }
        ]
    },
    "housing": {
        "low_income": {
            "not_emergency": {
                "no_court": [
                    {
                        "name": "Chicago Advocate Legal (CAL)",
                        "url": "https://www.chicagoadvocatelegal.com",
                        "description": "Free legal support for housing issues including eviction defense and tenant rights.",
                        "phone": "",
                        "intake_form": "",
                        "intake_instructions": "Click the button below to schedule an intake appointment with Cindy at CAL.",
                        "is_nfp": True
                    },
                    {
                        "name": "Legal Aid Chicago",
                        "url": "https://www.legalaidchicago.org",
                        "description": "Free legal services for housing, eviction defense, and tenant rights.",
                        "phone": "312-341-1070",
                        "intake_form": "https://www.legalaidchicago.org/get-help/",
                        "intake_instructions": "",
                        "is_nfp": False
                    }
                ],
                "has_court": [
                    {
                        "name": "Chicago Advocate Legal (CAL)",
                        "url": "https://www.chicagoadvocatelegal.com",
                        "description": "Free legal representation for housing court cases.",
                        "phone": "",
                        "intake_form": "",
                        "intake_instructions": "Click the button below to schedule an intake appointment with Cindy at CAL.",
                        "is_nfp": True
                    },
                    {
                        "name": "Legal Aid Chicago - Eviction Defense",
                        "url": "https://www.legalaidchicago.org",
                        "description": "Free legal representation for eviction cases in Cook County.",
                        "phone": "312-341-1070",
                        "intake_form": "https://www.legalaidchicago.org/get-help/",
                        "intake_instructions": "",
                        "is_nfp": False
                    }
                ]
            },
            "emergency": [
                {
                    "name": "Chicago Advocate Legal (CAL) - Emergency Housing",
                    "url": "https://www.chicagoadvocatelegal.com",
                    "description": "Urgent legal support for immediate housing emergencies.",
                    "phone": "",
                    "intake_form": "",
                    "intake_instructions": "Click the button below to schedule an urgent intake appointment with Cindy at CAL.",
                    "is_nfp": True
                },
                {
                    "name": "Legal Aid Chicago - Emergency Eviction Defense",
                    "url": "https://www.legalaidchicago.org",
                    "description": "Emergency eviction defense services.",
                    "phone": "312-341-1070",
                    "intake_form": "",
                    "intake_instructions": "Call immediately if you have an eviction notice.",
                    "is_nfp": False
                }
            ]
        },
        "not_low_income": [
            {
                "name": "Illinois State Bar Association Lawyer Finder",
                "url": "https://www.isba.org/public/illinoislawyerfinder",
                "description": "Find a private attorney specializing in housing and landlord-tenant law.",
                "phone": "",
                "intake_form": "",
                "intake_instructions": "",
                "is_nfp": False
            },
            {
                "name": "Chicago Bar Association Lawyer Referral Service",
                "url": "https://www.chicagobar.org/page/LRS",
                "description": "Lawyer referral service for housing disputes.",
                "phone": "312-554-2001",
                "intake_form": "",
                "intake_instructions": "",
                "is_nfp": False
            }
        ]
    },
    "divorce": {
        "low_income": {
            "not_emergency": {
                "no_court": [
                    {
                        "name": "Chicago Advocate Legal (CAL)",
                        "url": "https://www.chicagoadvocatelegal.com",
                        "description": "Free legal support for divorce proceedings.",
                        "phone": "",
                        "intake_form": "",
                        "intake_instructions": "Click the button below to schedule an intake appointment with Cindy at CAL.",
                        "is_nfp": True
                    },
                    {
                        "name": "Illinois Legal Aid Online",
                        "url": "https://www.illinoislegalaid.org",
                        "description": "Self-help divorce forms and resources for Illinois residents.",
                        "phone": "",
                        "intake_form": "",
                        "intake_instructions": "",
                        "is_nfp": False
                    }
                ],
                "has_court": [
                    {
                        "name": "Chicago Advocate Legal (CAL)",
                        "url": "https://www.chicagoadvocatelegal.com",
                        "description": "Free legal representation for divorce court cases.",
                        "phone": "",
                        "intake_form": "",
                        "intake_instructions": "Click the button below to schedule an intake appointment with Cindy at CAL.",
                        "is_nfp": True
                    },
                    {
                        "name": "Prairie State Legal Services",
                        "url": "https://www.pslegal.org",
                        "description": "Free civil legal aid for divorce cases.",
                        "phone": "800-942-4612",
                        "intake_form": "https://www.pslegal.org/apply-for-help",
                        "intake_instructions": "",
                        "is_nfp": False
                    }
                ]
            },
            "emergency": [
                {
                    "name": "Illinois Domestic Violence Hotline",
                    "url": "https://www.iladvocates.org",
                    "description": "24/7 crisis support for domestic violence situations involving divorce.",
                    "phone": "877-863-6338",
                    "intake_form": "",
                    "intake_instructions": "Call immediately for emergency assistance.",
                    "is_nfp": False
                },
                {
                    "name": "Chicago Advocate Legal (CAL) - Emergency Divorce",
                    "url": "https://www.chicagoadvocatelegal.com",
                    "description": "Urgent legal support for divorce emergencies.",
                    "phone": "",
                    "intake_form": "",
                    "intake_instructions": "Click the button below to schedule an urgent intake appointment with Cindy at CAL.",
                    "is_nfp": True
                }
            ]
        },
        "not_low_income": [
            {
                "name": "Illinois State Bar Association Lawyer Finder",
                "url": "https://www.isba.org/public/illinoislawyerfinder",
                "description": "Find a private attorney specializing in divorce and family law.",
                "phone": "",
                "intake_form": "",
                "intake_instructions": "",
                "is_nfp": False
            },
            {
                "name": "Chicago Bar Association Lawyer Referral Service",
                "url": "https://www.chicagobar.org/page/LRS",
                "description": "Lawyer referral service for divorce cases.",
                "phone": "312-554-2001",
                "intake_form": "",
                "intake_instructions": "",
                "is_nfp": False
            }
        ]
    },
    "custody": {
        "low_income": {
            "not_emergency": {
                "no_court": [
                    {
                        "name": "Chicago Advocate Legal (CAL)",
                        "url": "https://www.chicagoadvocatelegal.com",
                        "description": "Free legal support for child custody matters.",
                        "phone": "",
                        "intake_form": "",
                        "intake_instructions": "Click the button below to schedule an intake appointment with Cindy at CAL.",
                        "is_nfp": True
                    },
                    {
                        "name": "Illinois Legal Aid Online",
                        "url": "https://www.illinoislegalaid.org",
                        "description": "Self-help custody forms and legal information.",
                        "phone": "",
                        "intake_form": "",
                        "intake_instructions": "",
                        "is_nfp": False
                    }
                ],
                "has_court": [
                    {
                        "name": "Chicago Advocate Legal (CAL)",
                        "url": "https://www.chicagoadvocatelegal.com",
                        "description": "Free legal representation for custody court cases.",
                        "phone": "",
                        "intake_form": "",
                        "intake_instructions": "Click the button below to schedule an intake appointment with Cindy at CAL.",
                        "is_nfp": True
                    },
                    {
                        "name": "Prairie State Legal Services",
                        "url": "https://www.pslegal.org",
                        "description": "Free civil legal aid for custody cases.",
                        "phone": "800-942-4612",
                        "intake_form": "https://www.pslegal.org/apply-for-help",
                        "intake_instructions": "",
                        "is_nfp": False
                    }
                ]
            },
            "emergency": [
                {
                    "name": "Illinois Domestic Violence Hotline",
                    "url": "https://www.iladvocates.org",
                    "description": "24/7 crisis support for custody emergencies involving safety concerns.",
                    "phone": "877-863-6338",
                    "intake_form": "",
                    "intake_instructions": "Call immediately for emergency assistance.",
                    "is_nfp": False
                },
                {
                    "name": "Chicago Advocate Legal (CAL) - Emergency Custody",
                    "url": "https://www.chicagoadvocatelegal.com",
                    "description": "Urgent legal support for emergency custody situations.",
                    "phone": "",
                    "intake_form": "",
                    "intake_instructions": "Click the button below to schedule an urgent intake appointment with Cindy at CAL.",
                    "is_nfp": True
                }
            ]
        },
        "not_low_income": [
            {
                "name": "Illinois State Bar Association Lawyer Finder",
                "url": "https://www.isba.org/public/illinoislawyerfinder",
                "description": "Find a private attorney specializing in child custody law.",
                "phone": "",
                "intake_form": "",
                "intake_instructions": "",
                "is_nfp": False
            },
            {
                "name": "Chicago Bar Association Lawyer Referral Service",
                "url": "https://www.chicagobar.org/page/LRS",
                "description": "Lawyer referral service for custody cases.",
                "phone": "312-554-2001",
                "intake_form": "",
                "intake_instructions": "",
                "is_nfp": False
            }
        ]
    }
}

CRISIS_KEYWORDS = [
    "emergency", "urgent", "crisis", "danger", "immediate", "threat",
    "violence", "abuse", "harm", "safety", "afraid", "scared", "help now"
]

def detect_crisis_keywords(message: str) -> bool:
    message_lower = message.lower()
    return any(keyword in message_lower for keyword in CRISIS_KEYWORDS)

def get_step_progress(step: str) -> dict:
    """Calculate progress based on current step"""
    steps_map = {
        "topic_selection": {"current": 1, "total": 5, "label": "Select Topic"},
        "emergency_check": {"current": 2, "total": 5, "label": "Emergency Check"},
        "court_status": {"current": 3, "total": 5, "label": "Court Status"},
        "income_check": {"current": 4, "total": 5, "label": "Income Level"},
        "get_zip": {"current": 5, "total": 5, "label": "Your Location"},
        "complete": {"current": 5, "total": 5, "label": "Resources Ready"}
    }
    return steps_map.get(step, {"current": 0, "total": 5, "label": "Starting"})

class ChatRequest(BaseModel):
    message: str
    conversation_state: dict = {}

class ChatResponse(BaseModel):
    response: str
    options: list = []
    referrals: list = []
    conversation_state: dict = {}
    progress: dict = {}

@app.get("/")
def read_root():
    return {"message": "Court Legal Chatbot API is running"}

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    message = request.message.lower().strip()
    state = request.conversation_state or {}
    
    current_step = state.get("step", "start")
    
    if message == "start" or current_step == "start":
        return ChatResponse(
            response="Welcome! I'm here to help you find legal resources. What legal topic do you need help with?",
            options=["Child Support", "Education", "Housing", "Divorce", "Custody"],
            conversation_state={"step": "topic_selection"},
            progress=get_step_progress("topic_selection")
        )
    
    if current_step == "topic_selection":
        topic_map = {
            "child support": "child_support",
            "education": "education",
            "housing": "housing",
            "divorce": "divorce",
            "custody": "custody"
        }
        
        topic = topic_map.get(message)
        if topic:
            return ChatResponse(
                response="Is this an emergency situation? (e.g., immediate danger, urgent deadline, safety concern)",
                options=["Yes - Emergency", "No - Not an emergency"],
                conversation_state={"step": "emergency_check", "topic": topic},
                progress=get_step_progress("emergency_check")
            )
        else:
            return ChatResponse(
                response="I didn't understand that topic. Please select one of the options below:",
                options=["Child Support", "Education", "Housing", "Divorce", "Custody"],
                conversation_state={"step": "topic_selection"},
                progress=get_step_progress("topic_selection")
            )
    
    if current_step == "emergency_check":
        topic = state.get("topic")
        is_emergency = "yes" in message or "emergency" in message or detect_crisis_keywords(message)
        
        if is_emergency:
            return ChatResponse(
                response="⚠️ If this is an emergency, call the police at 911. Follow up regarding help for your legal issues after you have contacted the police.\n\nFor non-police emergencies, we can connect you with crisis resources. Are you currently low-income or receiving public benefits?",
                options=["Yes", "No"],
                conversation_state={"step": "income_check", "topic": topic, "emergency": True},
                progress=get_step_progress("income_check")
            )
        else:
            return ChatResponse(
                response="Do you currently have a court case filed?",
                options=["Yes - I have a court case", "No - No court case yet"],
                conversation_state={"step": "court_status", "topic": topic, "emergency": False},
                progress=get_step_progress("court_status")
            )
    
    if current_step == "court_status":
        topic = state.get("topic")
        has_court = "yes" in message or "have" in message
        
        return ChatResponse(
            response="Are you currently low-income or receiving public benefits?",
            options=["Yes", "No"],
            conversation_state={"step": "income_check", "topic": topic, "emergency": False, "has_court": has_court},
            progress=get_step_progress("income_check")
        )
    
    if current_step == "income_check":
        topic = state.get("topic")
        is_emergency = state.get("emergency", False)
        has_court = state.get("has_court", False)
        is_low_income = "yes" in message
        
        return ChatResponse(
            response="Please provide your ZIP code so I can find resources in your area:",
            options=[],
            conversation_state={
                "step": "get_zip",
                "topic": topic,
                "emergency": is_emergency,
                "has_court": has_court,
                "low_income": is_low_income
            },
            progress=get_step_progress("get_zip")
        )
    
    if current_step == "get_zip":
        topic = state.get("topic")
        is_emergency = state.get("emergency", False)
        has_court = state.get("has_court", False)
        is_low_income = state.get("low_income", False)
        zip_code = message
        
        if not zip_code.isdigit() or len(zip_code) != 5:
            return ChatResponse(
                response="Please enter a valid 5-digit ZIP code:",
                options=[],
                conversation_state=state,
                progress=get_step_progress("get_zip")
            )
        
        referrals = []
        
        if topic in REFERRALS_DB:
            topic_data = REFERRALS_DB[topic]
            
            if is_low_income:
                low_income_data = topic_data.get("low_income", {})
                
                if is_emergency:
                    referrals = low_income_data.get("emergency", [])
                else:
                    not_emergency_data = low_income_data.get("not_emergency", {})
                    if has_court:
                        referrals = not_emergency_data.get("has_court", [])
                    else:
                        referrals = not_emergency_data.get("no_court", [])
            else:
                referrals = topic_data.get("not_low_income", [])
        
        return ChatResponse(
            response=f"Based on your situation (ZIP: {zip_code}), here are the recommended resources for you:",
            options=[],
            referrals=referrals,
            conversation_state={"step": "complete", "topic": topic, "zip_code": zip_code},
            progress=get_step_progress("complete")
        )
    
    return ChatResponse(
        response="I didn't understand that. Let's start over. What legal topic do you need help with?",
        options=["Child Support", "Education", "Housing", "Divorce", "Custody"],
        conversation_state={"step": "topic_selection"},
        progress=get_step_progress("topic_selection")
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
