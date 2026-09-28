#!/usr/bin/env node
/**
 * One-shot migration for the Gossip Supabase database (2026-09-28 review).
 *
 *  1. SECURITY: revoke all Data API grants from anon/authenticated and enable
 *     RLS deny-by-default on every public table (backend uses the postgres
 *     role, which bypasses RLS - unaffected).
 *  2. Add users.role (varchar default 'user') - fixes isAdmin, which checked
 *     a column that never existed; sets the first user (id=1) as admin.
 *  3. Drop 4 dead, zero-row tables the code never references:
 *     search_index, points, reputation, conversation_members.
 *
 * Idempotent. Usage:
 *   DATABASE_URL="postgresql://..." node scripts/db-migrate-2026-09-28.js
 */
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL before running.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: (() => {
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.delete('sslmode');
    return url.toString();
  })(),
  ssl: { rejectUnauthorized: false },
  max: 2
});

const q = (sql, params) => pool.query(sql, params);
const step = async (label, fn) => {
  try {
    const r = await fn();
    console.log(`OK    ${label}${r ? ` -> ${r}` : ''}`);
  } catch (e) {
    console.log(`FAIL  ${label} -> ${e.message.split('\n')[0]}`);
  }
};

(async () => {
  console.log('=== PRE-STATE ===');
  const { rows: before } = await q(`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE relrowsecurity)::int AS with_rls
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r'`);
  const { rows: grantsBefore } = await q(`
    SELECT count(*)::int AS grant_rows
    FROM information_schema.role_table_grants
    WHERE table_schema='public' AND grantee IN ('anon','authenticated')`);
  console.log(`tables=${before[0].total} rls=${before[0].with_rls} apiGrantRows=${grantsBefore[0].grant_rows}`);

  console.log('\n=== 1. LOCKDOWN (revoke + RLS) ===');
  await step('revoke all grants from anon/authenticated', async () => {
    const { rows } = await q(`
      SELECT DISTINCT c.relname AS t
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' AND c.relname <> 'database_stats'`);
    for (const { t } of rows) {
      await q(`REVOKE ALL ON TABLE public."${t}" FROM anon`);
      await q(`REVOKE ALL ON TABLE public."${t}" FROM authenticated`);
    }
    return `${rows.length} tables`;
  });
  await step('enable RLS deny-by-default', async () => {
    const { rows } = await q(`
      SELECT c.relname AS t FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity`);
    for (const { t } of rows) {
      await q(`ALTER TABLE public."${t}" ENABLE ROW LEVEL SECURITY`);
    }
    return `${rows.length} tables`;
  });

  console.log('\n=== 2. users.role COLUMN ===');
  await step('add users.role if missing', async () => {
    const { rows } = await q(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='users' AND column_name='role'`);
    if (rows.length === 0) {
      await q(`ALTER TABLE public.users ADD COLUMN role varchar(20) NOT NULL DEFAULT 'user'`);
      return 'column added';
    }
    return 'already exists';
  });
  await step('promote user id=1 to admin', async () => {
    const r = await q(`UPDATE public.users SET role='admin' WHERE id=1 AND role <> 'admin'`);
    return `${r.rowCount} row(s) updated`;
  });

  console.log('\n=== 3. DROP DEAD TABLES ===');
  const deadTables = ['search_index', 'points', 'reputation', 'conversation_members'];
  await step('safety check: all targets exist and are empty', async () => {
    for (const t of deadTables) {
      const r = await q(`SELECT count(*)::int AS n FROM public."${t}"`);
      if (r.rows[0].n !== 0) throw new Error(`${t} has ${r.rows[0].n} rows - refusing to drop`);
    }
    return `${deadTables.length} tables empty, safe`;
  });
  for (const t of deadTables) {
    await step(`drop ${t}`, async () => {
      await q(`DROP TABLE IF EXISTS public."${t}" CASCADE`);
      return 'dropped';
    });
  }

  console.log('\n=== POST-STATE ===');
  const { rows: after } = await q(`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE relrowsecurity)::int AS with_rls
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r'`);
  const { rows: grantsAfter } = await q(`
    SELECT count(*)::int AS grant_rows
    FROM information_schema.role_table_grants
    WHERE table_schema='public' AND grantee IN ('anon','authenticated')`);
  const { rows: roles } = await q(`SELECT id, username, role FROM public.users ORDER BY id LIMIT 3`);
  console.log(`tables=${after[0].total} rls=${after[0].with_rls} apiGrantRows=${grantsAfter[0].grant_rows}`);
  console.table(roles);
  console.log(grantsAfter[0].grant_rows === 0 && after[0].with_rls === after[0].total
    ? 'LOCKDOWN VERIFIED: zero API grants, RLS everywhere.'
    : 'WARNING: lockdown incomplete, inspect above.');

  await pool.end();
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
