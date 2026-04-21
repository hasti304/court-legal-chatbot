![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-0ea5e9)
![Backend](https://img.shields.io/badge/Backend-FastAPI-22c55e)
![Database](https://img.shields.io/badge/Database-SQLAlchemy-f59e0b)
![Deployment](https://img.shields.io/badge/Deploy-Render-8b5cf6)

# CAL Legal Chatbot

AI-assisted legal intake and triage platform that helps users describe legal issues in plain language, detect urgency, and find relevant legal resources.

This project is built as a production-style full-stack system (`React + FastAPI + SQLAlchemy`) with an emphasis on access to justice, usability, and safety boundaries.

## Live Links

- App: [court-legal-chatbot-frontend.onrender.com](https://court-legal-chatbot-frontend.onrender.com)
- API: [court-legal-chatbot-1.onrender.com](https://court-legal-chatbot-1.onrender.com)
- Repository: [github.com/hasti304/court-legal-chatbot](https://github.com/hasti304/court-legal-chatbot)

Render free-tier services may take a few seconds to wake up on first request.

## Key Capabilities

- Guided legal triage flow across multiple issue categories
- AI-assisted issue classification from user free-text input
- Urgency-aware branching (`Yes / No / I don't know`) for safer routing
- Resource matching with contextual legal organization referrals
- Authentication flows (magic link + admin JWT patterns)
- Document and admin endpoints for operational workflows
- Responsive, accessibility-oriented user experience

## Architecture Overview

1. User submits legal concern through guided prompts or free text
2. Backend intake and triage services evaluate issue type and urgency
3. AI layer assists with intent understanding and category mapping
4. API returns tailored legal resources and recommended next steps
5. User can continue, restart, or follow referral actions

## Tech Stack

### Frontend

- React 18 + Vite
- Chakra UI + Emotion
- i18next (internationalization)
- jsPDF
- Leaflet / React-Leaflet

### Backend

- FastAPI + Uvicorn
- Pydantic
- SQLAlchemy
- PostgreSQL support (`psycopg2-binary`)
- JWT auth + bcrypt
- Multipart + HTTP integrations

### AI and Integrations

- Groq API for triage support and intent understanding
- Email pipeline for magic-link authentication flows

## Repository Structure

- `frontend/`: React application
- `backend/`: FastAPI application, services, routers, and data
- `docs/`: project documentation and notes
- `models/`: model/data artifacts
- `scripts/`: helper scripts

## Local Development

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm

### 1) Clone

```bash
git clone https://github.com/hasti304/court-legal-chatbot.git
cd court-legal-chatbot
```

### 2) Backend Setup

```bash
cd backend
python -m venv venv
```

Windows:

```bash
venv\Scripts\activate
```

macOS/Linux:

```bash
source venv/bin/activate
```

Install dependencies and run API:

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs at `http://127.0.0.1:8000` by default.

### 3) Frontend Setup

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173` by default.

## Environment Variables (Backend)

Set these in `backend/.env` (or your host environment):

- `DATABASE_URL`
- `GROQ_API_KEY`
- `GROQ_MODEL` (optional override)
- `ADMIN_EMAIL`
- `ADMIN_JWT_SECRET`
- `ADMIN_EXPORT_KEY` (legacy admin key flow)
- `FRONTEND_BASE_URL`
- `MAGIC_LINK_TTL_MINUTES`
- `MAGIC_LINK_DEV_RETURN_TOKEN` (local/dev only)
- `RESET_PASSWORD_DEV_RETURN_TOKEN` (local/dev only)
- `RESEND_API_KEY` and `RESEND_FROM` (recommended email path)
- or SMTP fallback: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`

If outbound email is not configured, magic-link URLs are printed in backend logs for local testing.

## Deployment

The project is configured for Render-hosted deployment with separate frontend and backend services.

- Frontend: static build and hosting
- Backend: FastAPI API service

## Safety and Legal Boundary

This software provides general legal information and triage support only. It is not legal advice and does not create an attorney-client relationship.

Users with urgent legal deadlines, emergencies, or case-specific risk should contact a qualified legal professional immediately.

## Author

**Hasti P Panchal**

Building practical software at the intersection of AI, accessibility, and public-interest technology.
