Architecture Notes (Initial Stack Decision)
Frontend:
React (industry standard for web UIs; accessible, maintainable, open source, and deployable on GitHub Pages for free).

Backend/API:
Python FastAPI (clean async API, type safety, strong docs, preferred for AI workflows and rapid iteration).
Alternatives considered: Flask (less type-safe) and Node.js/Express (prefer Python for compatibility with AI tooling).

Database:
None for MVP – logs and feedback as local files. Plan to add Postgres, Mongo, or SQLite free-tier in future if usage or compliance requires.

AI/NLP Layer:
HuggingFace Transformers for embeddings, retrieval, and optional LLM inference (Llama2, Mistral); OpenAI free-tier only as fallback.

Vector DB (Retrieval-Augmented Generation):
Chroma or FAISS (open source, Python-first, supports local and cloud, MIT/BSD licensed).

Hosting:

Frontend: GitHub Pages (static, free).

Backend: Render or Railway free tier (CI/CD from GitHub; no credit card required for open source dev).

Rationale:
All selections prioritize privacy, compliance, maintainability, free-tier access, and best practices for modern legal/civic tech.