# Product and Engineering TODO Roadmap

This roadmap is prioritized to satisfy both:
- Client experience (usability, trust, reliability)
- Manager expectations (security, stability, production readiness)

## P0 - Must Do First (This Week)

- [ ] Fix critical auth/reset reliability
  - Ensure reset config is consistent between `backend/services/auth_password_service.py` and `backend/services/config_service.py`.
- [ ] Rotate all secrets and enforce config hygiene
  - Rotate API keys, DB credentials, JWT secret, SMTP/app password.
  - Keep secrets only in environment variables or a secret manager.
- [ ] Implement production-safe error handling
  - Stop returning raw DB/internal error text to API clients.
  - Keep detailed errors only in server logs.
- [ ] Stabilize health endpoint
  - Fix `/health` runtime issue in `backend/routers/core.py`.
- [ ] Add auth abuse protection
  - Rate-limit login, forgot-password, magic-link request, and admin login endpoints.

## P1 - High Impact for Client Satisfaction (Next 1-2 Weeks)

- [ ] Complete i18n coverage
  - Move remaining hardcoded UI strings to `frontend/src/i18n.js`.
- [ ] Improve accessibility
  - Add explicit form labels, better error announcements, modal focus trap, and keyboard-first flow.
- [ ] Improve referral follow-through UX
  - Add statuses like: contacted organization, no response, need alternate referral.
- [ ] Add county/court-aware guidance
  - Tailor recommendations, forms, and next steps by county/courthouse context.
- [ ] Add client trust status card
  - Show intake progress: submitted, under review, approved/rejected, next expected response date.

## P1 - High Impact for Manager Confidence (Next 1-2 Weeks)

- [ ] Set up CI/CD checks
  - Add GitHub Actions for backend lint/tests, frontend build/lint, and security checks.
- [ ] Add automated tests for core flows
  - Cover intake flow, auth flows, admin auth, and key API endpoints.
- [ ] Add structured logging and monitoring
  - Replace print logs with structured logs (request id, endpoint, latency, status).
  - Add error monitoring (for example, Sentry).
- [ ] Adopt formal DB migrations
  - Move from startup ad-hoc schema updates to migration tooling (for example, Alembic).

## P2 - Product Polish and Scale Readiness (2-4 Weeks)

- [ ] Move email sending to background jobs
  - Add retry behavior and failure tracking.
- [ ] Improve frontend performance
  - Split heavy frontend paths and lazy-load map-heavy modules.
- [ ] Improve offline/network resilience
  - Better retry and user feedback for intake/chat network failures.
- [ ] Create backup/restore runbook
  - Define backup schedule, restore validation, and incident checklist.
- [ ] Formalize release process
  - Add deploy checklist, rollback steps, and environment promotion rules.

## Definition of Done

### Client-ready
- [ ] Forgot/reset/login flows are reliable.
- [ ] Bilingual UI coverage is complete.
- [ ] Errors are clear and non-technical.
- [ ] Referrals are actionable and easy to follow.

### Manager-ready
- [ ] No exposed secrets.
- [ ] CI blocks bad merges.
- [ ] Critical paths have automated tests.
- [ ] Logging/monitoring is in place.
- [ ] Schema changes use controlled migrations.
