# Project Profile: Gossip

## 1) Project Name
Gossip

## 2) Domain
Social Networking / Community Platform

## 3) Tech Stack
- Frontend: React 19, Vite, React Router, Axios, Socket.IO Client
- Backend: Node.js, Express, PostgreSQL (pg), Redis (ioredis), Socket.IO
- Infra/DevOps: Docker, Docker Compose, Nginx
- Integrations: Cloudinary (media), Nodemailer (email OTP), Sentry (monitoring)
- Security & Reliability: JWT auth, CSRF, CORS allowlist, Helmet, rate limiting, Prometheus metrics

## 4) Deployed Link
- Frontend: Add your live URL here
- Backend API: Add your live API base URL here

## 5) Evidence (Screenshots to Attach)
Use 8 to 12 screenshots total for a strong submission.

### Core Product Evidence
1. Login/Register screen (with app branding visible)
2. Feed page loaded with multiple posts
3. Community page (example: r/uni or r/badminton) showing posts
4. Create post flow (before submit and after submit)
5. Post detail page with comments section open
6. Like/Comment/Share actions visible on a post

### Feature/Engineering Evidence
7. Forgot password flow - Step 1: email input + send OTP
8. Forgot password flow - Step 2: OTP verification
9. Forgot password flow - Step 3: reset password success
10. Profile page and settings page navigation working
11. Inbox/request flow (request sent/accepted)
12. Optional: API docs or health endpoint screenshot for backend maturity

### Deployment/Proof Evidence
13. Live site open in browser with URL visible in address bar
14. Backend health endpoint response (/health or /ready)
15. GitHub repository page showing commits and project structure

## 6) GitHub Repository Link
- https://github.com/nikunj-kohli/Gossip

## 7) Suggested Captions Under Screenshots
- Figure 1: User authentication screen of Gossip.
- Figure 2: Personalized feed with hybrid ranking mode.
- Figure 3: Community-specific post listing and interactions.
- Figure 4: Successful post creation and feed update.
- Figure 5: Post detail view with threaded comments.
- Figure 6: OTP-based forgot password workflow.
- Figure 7: Profile and settings navigation without route errors.
- Figure 8: Live deployment and backend health verification.

## 8) One-Paragraph Project Summary (Paste-ready)
Gossip is a production-oriented full-stack social platform focused on community-driven conversations. It supports feed ranking modes, community posting, request-based messaging, media uploads, and OTP-based password recovery. The system is built with React and Vite on the frontend, Node.js and Express on the backend, and PostgreSQL with Redis for data and performance support. The platform is containerized with Docker and includes operational features such as health/readiness probes, API documentation, logging, metrics, and monitoring integration.

## 9) If You Need to Submit as PDF
- Open this file in VS Code markdown preview.
- Export to PDF (or print to PDF from browser preview).
- Attach screenshots in the same order as the Evidence section.
