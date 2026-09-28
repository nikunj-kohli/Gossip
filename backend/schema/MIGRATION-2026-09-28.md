# DB Migration — 2026-09-28 (Security lockdown + drift cleanup)

Applied to Supabase project `ahgcbxvsftukcsmgujyx` (PostgreSQL 17.6) after the
full database audit. Executed via `node scripts/db-migrate-2026-09-28.js`.

## Changes applied to the live database

### 1. Security lockdown (critical)
- **Before:** every public table granted `SELECT/INSERT/UPDATE/DELETE/TRUNCATE`
  to `anon` + `authenticated` (406 grant rows) with RLS disabled on 26/28
  tables → anyone with a valid anon key could read `users.password_hash` or
  truncate tables through the Supabase REST API.
- **After:** 0 API grants on all app tables; RLS enabled (deny-by-default, no
  policies) on 24/24 tables. The backend connects as the `postgres` role,
  which bypasses RLS — app behavior unchanged.
- Only remaining exception: `database_stats` (Supabase-internal view,
  aggregates only, managed by Supabase).
- **Verified live:** `GET /api/groups` → 200, `GET /api/posts` → 200 after
  lockdown; Supabase REST with an anon key now returns
  `permission denied for table users` (401).

### 2. `users.role` column added
- `ALTER TABLE users ADD COLUMN role varchar(20) NOT NULL DEFAULT 'user'`
- Fixes `isAdmin` middleware, which checked `req.user.role !== 'admin'` for a
  column that never existed — every admin endpoint 403'd forever.
- `users.id = 1` (`nikunj-kohli`) promoted to `admin`.

### 3. Dead, zero-row tables dropped (CASCADE)
- `search_index` — never referenced by any query
- `points` — orphan of the gamification feature (code expected `user_points`)
- `reputation` — orphan of the gamification feature (code expected `user_reputation`)
- `conversation_members` — code uses `conversations.user1_id/user2_id` instead

Schema after migration: **24 tables** (was 28).

## Code changes in the same commit

- Deleted dead backend stacks whose tables never existed in this DB:
  duplicate chat system (`ChatRoom`, `ChatMessage`, chat routes/controller),
  gamification (`Points`, `Achievement`, `Reputation` models + controller/
  routes/service, award-points hooks in `server.js`/`postController.js`),
  and orphan services (`notificationQueueService`, `batchProcessingService`,
  `enhancedRateLimiter`, `postViewTracker`/`PostView`,
  `NotificationSettings`).
- Removed the unused frontend Supabase layer (`supabaseClient.js`,
  `@supabase/supabase-js` dep, `VITE_SUPABASE_*` build args in the Dockerfile
  and docker-compose) — the app talks to Supabase exclusively through the
  backend's `DATABASE_URL`.

## Still open (not in this migration)

- [ ] Rotate the DB password (it was shared in chat): Supabase → Settings →
      Database → Reset password → update `DATABASE_URL` in Render.
- [ ] `post_media` join table has 0 rows while `media` has 20 — post
      attachments are never linked; fix in `mediaController`/`Post.js`.
- [ ] Notifications table is empty and nothing writes to it — the bell UI is
      permanently blank. Implement notification creation on
      like/comment/connection events.
- [ ] Reports/moderation endpoints have no frontend surface (or drop them).
- [ ] `csurf` is archived/unmaintained; 23 npm audit findings in backend.
- [ ] Re-run `node scripts/db-dump-schema.js schema/schema.sql` after any
      future schema change and commit the result.

## Tooling added

- `backend/scripts/db-audit.js` — read-only audit (schema, counts, RLS,
  grants, indexes, integrity, hygiene).
- `backend/scripts/db-dump-schema.js` — structural schema snapshot writer.
- `backend/scripts/db-migrate-2026-09-28.js` — this migration (idempotent).
- `backend/scripts/supabase-lockdown.sql` — SQL Editor equivalent of the
  lockdown step.
