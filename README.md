# Gossip

Production-oriented social platform with communities, feed ranking modes, request-based messaging, media uploads, realtime sockets, gamification hooks, and hardened API runtime.

## What This Project Is

Gossip is a full-stack system with:

- Node.js/Express API backend
- React + Vite frontend
- Dockerized runtime (backend + nginx frontend)
- PostgreSQL + Redis integration
- Cloudinary media pipeline
- Sentry error monitoring (backend + frontend)

This repository is currently set up to run locally with Docker and deploy as containerized services.

## Technical Highlights

- Layered backend design: routes -> controllers -> models/services
- Request-path hardening with Helmet, CSP, CORS allowlist, CSRF handling, and multi-level rate limiting
- Query-level observability and slow-query reporting endpoint for admins
- Resilience pattern support with circuit breakers and cache fallback paths
- Feed architecture supports hybrid content blending and community-aware ranking
- Request-gated inbox flow (request/accept/decline/cancel/remove) instead of open DMs
- Container-native health and readiness probes (`/health`, `/ready`)
- Reverse-proxy optimization in nginx (keepalive upstream, proxy buffering, static asset cache headers)

## Stack

Backend:

- Node.js + Express
- PostgreSQL (`pg`)
- Redis (`ioredis`)
- Socket.IO
- Swagger OpenAPI
- Winston logging
- Prometheus metrics (`prom-client`)
- Sentry Node SDK

Frontend:

- React 19 + Vite
- React Router
- Axios
- Socket.IO client
- Sentry React SDK

Infra:

- Docker Compose
- nginx for frontend serving + API proxying

## Architecture Snapshot

```text
Browser (React/Vite)
  -> nginx container (client)
    -> /api/* proxied to backend container
      -> controllers/models/services
        -> PostgreSQL
        -> Redis
        -> Cloudinary
        -> Sentry
```

## Repository Layout

```text
backend/
  config/
  controllers/
  middleware/
  models/
  routes/
  services/
  utils/
client/
  src/
docker-compose.yml
```

## API Surface (Current)

Main backend route groups:

- `/api/auth`
- `/api/posts`
- `/api/users`
- `/api/requests`
- `/api/groups`
- `/api/inbox`
- `/api/notifications`
- `/api/media`
- `/api/search`
- `/api/reports`
- `/api/moderation`
- `/api/chat`
- `/api/gamification`
- `/api/metrics`

Operational endpoints:

- `/health`
- `/ready`
- `/api-docs`
- `/api-docs.json`

Admin-only diagnostics:

- `/api/admin/circuit-breakers`
- `/api/admin/slow-queries`

## Run With Docker (Recommended)

### Prerequisites

- Docker + Docker Compose

### Start

```bash
docker compose up -d --build
```

### Check

```bash
docker compose ps
curl http://127.0.0.1:5000/health
curl http://127.0.0.1:5000/ready
curl -I http://127.0.0.1:3000
```

### Stop

```bash
docker compose down
```

### Optional local infra profile

If you explicitly want local Postgres + Redis containers:

```bash
docker compose --profile local-infra up -d
```

## Run Without Docker

Backend:

```bash
cd backend
npm install --legacy-peer-deps
npm run dev
```

Frontend:

```bash
cd client
npm install
npm run dev
```

Note:

- The frontend defaults `VITE_API_URL` to `/api`.
- For non-nginx local dev, set `VITE_API_URL` to your backend base (for example `http://localhost:5000/api`).

## Configuration

Runtime env is loaded from backend-focused env files.

High-impact variables:

- `NODE_ENV`
- `PORT`
- `DATABASE_URL`
- `DB_SSL`, `DB_MAX_CONNECTIONS`, `DB_IDLE_TIMEOUT`, `DB_CONNECTION_TIMEOUT`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `CORS_ORIGINS`
- `ENABLE_CACHING`, `ENABLE_RATE_LIMITING`, `ENABLE_MONITORING`
- `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`
- `VITE_API_URL`, `VITE_SENTRY_DSN`

## Security Model

- JWT auth
- CSRF middleware with selective route protection
- CORS origin allowlist strategy
- Helmet headers + CSP
- Rate limiting on global API, auth, and write-heavy paths
- Error response sanitization in production
- Admin route protection via auth + role checks

## Performance and Reliability

- DB pooling with max/timeout tuning and keepalive
- gzip compression for API responses
- Redis-backed throttling and cache integration
- Slow-query instrumentation and report endpoint
- nginx upstream keepalive to reduce backend connection churn
- Health + readiness probes for orchestrator-safe rollouts
- Graceful shutdown with DB pool close and timeout fallback

## Observability

- Prometheus metrics middleware and export endpoint
- Structured + request logging via Winston
- Sentry capture in backend and frontend
- Runtime health: `/health`
- Dependency readiness: `/ready`

## Sentry

Sentry is integrated in both tiers.

Set:

- Backend: `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`
- Frontend: `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT`, `VITE_SENTRY_TRACES_SAMPLE_RATE`

Rebuild containers after env changes:

```bash
docker compose up -d --build
```

## Deployment Notes

For no-card deployments, a practical path is:

- Backend container host (free tier)
- Static frontend host (free tier)
- Managed Postgres/Redis/Cloudinary already externalized

Before production rollout:

- Rotate all credentials/secrets
- Set strict `CORS_ORIGINS`
- Ensure `NODE_ENV=production`
- Restrict or disable public API docs if required
- Verify health/readiness probes on target platform

## Current Scripts

Backend:

- `npm run dev`
- `npm run start`

Frontend:

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`

## Project Status

This README intentionally documents only active, verifiable capabilities from the current codebase and runtime configuration.