# Illinois Court Legal Chatbot

**Live Demo:**  
[https://hasti304.github.io/court-legal-chatbot/](https://hasti304.github.io/court-legal-chatbot/)  
**Backend API:**  
[https://court-legal-chatbot.onrender.com/](https://court-legal-chatbot.onrender.com/)

## Overview
A public-facing legal triage chatbot for Illinois residents. The bot:
- Guides users by asking legal triage questions about their issue (housing, child support, education, etc.)
- Routes users to self-help, legal aid, or Cook County-specific resources
- Explains referral levels (Level 1/2/3)
- Logs anonymous feedback for ongoing improvement

**NOT legal advice. Information only.** See disclaimer below.

## Features
- **Accessible, mobile-friendly React UI**
- **FastAPI backend on Render**
- **GitHub Pages hosting**
- **Restartable triage flow**
- **Clear compliance and privacy boundaries**
- **Feedback form for user input**

## Quick Start

### Local Development
Clone repo and run each service:

1. **Backend**
    ```
    cd backend
    python -m venv venv
    venv\Scripts\activate      # On Windows
    pip install -r requirements.txt
    uvicorn main:app --reload
    ```
2. **Frontend**
    ```
    cd frontend
    npm install
    npm run dev
    ```
3. Visit `http://localhost:5173`

### Production URLs
- Frontend: [https://hasti304.github.io/court-legal-chatbot/](https://hasti304.github.io/court-legal-chatbot/)
- Backend: [https://court-legal-chatbot.onrender.com/](https://court-legal-chatbot.onrender.com/)

## Demo QR Code

Scan to view the live chatbot on mobile:

![QR Demo](frontend/public/chatbot-qr.png)

(Generate QR at: https://www.qr-code-generator.com/ – use your GitHub Pages URL.)

## Legal Disclaimer

This chatbot provides **general legal information for Illinois**. It does **NOT** give specific legal advice and cannot replace an attorney. If you have a court deadline, emergency, or need advice—contact a licensed lawyer or legal aid organization.

## Feedback & Contributions

Feedback is logged for compliance/audit purposes (no personal data). Pull requests or improvements are welcome!
