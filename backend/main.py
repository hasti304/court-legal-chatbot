from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
