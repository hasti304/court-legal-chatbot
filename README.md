![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-0ea5e9)
![Backend](https://img.shields.io/badge/Backend-FastAPI-22c55e)
![Database](https://img.shields.io/badge/Database-SQLAlchemy-f59e0b)
![Deployment](https://img.shields.io/badge/Deploy-Render-8b5cf6)

# CAL Legal Chatbot
### AI-Powered Legal Triage Platform

An end-to-end legal intake and guidance platform that helps users describe legal problems in plain language, triages urgency, and routes them to relevant legal resources.

Built with a production-style architecture (`React + FastAPI + SQLAlchemy`) and focused on practical access-to-justice outcomes.

---

## Live Demo (Recruiter Quick Check)

- **Try the app:** [court-legal-chatbot-frontend.onrender.com](https://court-legal-chatbot-frontend.onrender.com)
- **API endpoint:** [court-legal-chatbot-1.onrender.com](https://court-legal-chatbot-1.onrender.com)
- **Source code:** [github.com/hasti304/court-legal-chatbot](https://github.com/hasti304/court-legal-chatbot)

> Note: Render free instances may take a few seconds to wake up on first request.

---

## Why This Project Stands Out

- Solves a real public-impact problem: legal support is often hard to access and navigate
- Uses AI for meaningful triage, not just generic chat responses
- Balances usability with safety through legal disclaimers and emergency-aware flow
- Demonstrates full-stack delivery: UI, API design, persistence, auth, and deployment
- Includes admin and document workflows, showing product depth beyond an MVP chatbot

---

## Core Features

- **Guided Legal Triage:** Structured intake flow across multiple legal categories
- **AI Issue Detection:** Free-text input is classified into actionable legal issue types
- **Urgency Handling:** Emergency-aware branching (`Yes / No / I don't know`)
- **Resource Matching:** Curated legal organizations with contact details and context
- **Secure Access Patterns:** Authentication and magic-link email support
- **Admin Capabilities:** Admin-facing workflows for operational visibility
- **Document Support:** Endpoints and schema design for document-related user flows
- **Accessibility-First UX:** Responsive interface with read-aloud support

---

## Tech Stack

### Frontend
- React 18 + Vite
- Chakra UI + Emotion
- i18next (internationalization)
- jsPDF (document generation)
- Leaflet / React-Leaflet (location/map-based UI capabilities)

### Backend
- FastAPI + Uvicorn
- Pydantic
- SQLAlchemy
- PostgreSQL support (`psycopg2-binary`)
- JWT authentication + bcrypt
- Multipart handling + HTTP integrations

### AI / Integrations
- Groq API integration for intent understanding and triage assistance
- Transactional email pipeline for magic-link authentication flows

### Deployment
- Render-hosted services
- Frontend static build + hosted API

---

## System Design Snapshot

1. User enters legal concern via guided prompts or plain text
2. Backend triage service evaluates issue type and urgency
3. AI layer assists with intent detection and category mapping
4. API returns tailored legal resource recommendations
5. User can continue, restart flow, or move to next steps safely

---

## Local Development

### 1) Clone Repository
```bash
git clone https://github.com/hasti304/court-legal-chatbot.git
cd court-legal-chatbot
```

### 2) Run Backend (FastAPI)
```bash
cd backend
python -m venv venv
```

Windows:
```bash
venv\Scripts\activate
```

Mac/Linux:
```bash
source venv/bin/activate
```

Install dependencies and start server:
```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend default: `http://127.0.0.1:8000`

### 3) Run Frontend (React)
```bash
cd frontend
npm install
npm run dev
```

Frontend default: `http://localhost:5173`

---

## Product & Safety Principles

- Privacy-first interaction design
- Clear legal-information-only boundaries
- No claim of attorney-client relationship
- Built to reduce friction for users unfamiliar with legal terminology

---

## Legal Disclaimer

This project provides general legal information only and is **not** legal advice.  
It does not replace a licensed attorney.

If someone is facing an emergency, legal deadline, or case-specific legal risk, they should contact a qualified legal professional immediately.

---

## Roadmap

- Stronger case-type classification and confidence scoring
- Expanded legal resource coverage beyond current regions
- Improved analytics for triage outcomes and product quality
- Enhanced accessibility and multilingual support

---

## Author

**Hasti P Panchal**  
Focused on building practical, high-impact software at the intersection of AI, accessibility, and public-interest technology.
