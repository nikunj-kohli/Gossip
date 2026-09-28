#!/usr/bin/env node
/**
 * Read-only database audit for Gossip (Supabase Postgres).
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node scripts/db-audit.js
 *
 * Performs NO writes — schema introspection and aggregate counts only.
 * Safe to run against production.
 */
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL (Supabase pooler connection string) before running.');
  process.exit(1);
}

const pool = new Pool({
  // pg >= 8.16 treats sslmode=require as verify-full, which rejects Supabase's
  // cert chain. Strip it from the URL and configure TLS explicitly instead.
  connectionString: (() => {
    const url = new URL(process.env.DATABASE_URL);
    url.searchParams.delete('sslmode');
    return url.toString();
  })(),
  ssl: { rejectUnauthorized: false },
  max: 2
});

const section = (t) => console.log(`\n${'='.repeat(72)}\n${t}\n${'='.repeat(72)}`);

async function run(label, sql) {
  try {
    const res = await pool.query(sql);
    console.log(`\n--- ${label} ---`);
    if (res.rows.length === 0) console.log('(no rows)');
    else console.table(res.rows);
    return res.rows;
  } catch (e) {
    console.log(`\n--- ${label} ---\nERROR: ${e.message}`);
    return [];
  }
}

async function countEach(label, tableNames) {
  console.log(`\n--- ${label} ---`);
  for (const t of tableNames) {
    try {
      const r = await pool.query(`SELECT count(*)::int AS rows FROM "${t}"`);
      console.log(`${t.padEnd(28)} ${r.rows[0].rows}`);
    } catch (e) {
      console.log(`${t.padEnd(28)} ERROR: ${e.message.split('\n')[0]}`);
    }
  }
}

(async () => {
  section('SERVER');
  await run('identity', 'SELECT current_database() AS db, current_user, current_setting(\'server_version\') AS pg_version');
  await run('extensions', 'SELECT extname, extversion FROM pg_extension ORDER BY 1');

  section('TABLE INVENTORY');
  const tables = await run('tables (est. rows, size, RLS)', `
    SELECT c.relname AS table_name,
           COALESCE(s.n_live_tup, 0) AS est_rows,
           pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
           c.relrowsecurity AS rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY COALESCE(s.n_live_tup, 0) DESC`);

  const allTables = tables.map((t) => t.table_name);
  await countEach('EXACT row counts', allTables);

  section('CODE-VS-DB DRIFT');
  const codeTables = [
    'users', 'posts', 'comments', 'comment_likes', 'likes', 'groups', 'group_members',
    'friendships', 'conversations', 'messages', 'notifications', 'notification_preferences',
    'user_notification_settings', 'post_media', 'media', 'post_shares',
    'user_feed_preferences', 'user_post_feedback', 'user_joined_groups', 'interest_groups',
    'user_points', 'point_transactions', 'achievements', 'user_achievements', 'user_reputation',
    'post_views', 'user_activity_logs', 'reports', 'moderation_actions',
    'chat_rooms', 'chat_room_members', 'chat_messages', 'query_performance_logs', 'words'
  ];
  if (allTables.length) {
    const existing = new Set(allTables);
    const missing = codeTables.filter((t) => !existing.has(t));
    console.log(missing.length
      ? `MISSING IN DB (code references them): ${missing.join(', ')}`
      : 'All code-referenced tables exist in DB.');
    const extra = allTables.filter((t) => !codeTables.includes(t));
    if (extra.length) console.log(`IN DB BUT NOT IN CODE LIST: ${extra.join(', ')}`);
  }

  section('SECURITY / EXPOSURE');
  await run('RLS + policy count per table', `
    SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
      (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policy_count
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY 1`);
  await run('grants to anon/authenticated (Data API exposure)', `
    SELECT grantee, table_name, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privileges
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
    GROUP BY 1, 2 ORDER BY 2, 1 LIMIT 100`);

  section('USERS TABLE');
  await run('users columns', `
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
    ORDER BY ordinal_position`);
  await run('users sanity (aggregates only)', `
    SELECT count(*)::int AS total_users,
           count(DISTINCT email)::int AS distinct_emails,
           count(*) FILTER (WHERE password_hash IS NOT NULL)::int AS with_password_hash
    FROM users`);

  section('INDEXES ON HOT TABLES');
  for (const t of ['posts', 'messages', 'conversations', 'friendships', 'group_members', 'notifications', 'comments', 'likes', 'groups']) {
    await run(`indexes: ${t}`, `
      SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = '${t}' ORDER BY 1`);
  }

  section('FOREIGN KEYS / INTEGRITY');
  await run('FK count per table', `
    SELECT c.relname AS table_name, count(con.oid)::int AS fk_count
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_constraint con ON con.conrelid = c.oid AND con.contype = 'f'
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    GROUP BY 1 ORDER BY 2 DESC, 1`);
  await run('messages without a conversation', 'SELECT count(*)::int AS orphans FROM messages m LEFT JOIN conversations c ON c.id = m.conversation_id WHERE c.id IS NULL');
  await run('posts without an author', 'SELECT count(*)::int AS orphans FROM posts p LEFT JOIN users u ON u.id = p.user_id WHERE u.id IS NULL');
  await run('group_members orphans', 'SELECT count(*)::int AS orphans FROM group_members gm LEFT JOIN groups g ON g.id = gm.group_id LEFT JOIN users u ON u.id = gm.user_id WHERE g.id IS NULL OR u.id IS NULL');
  await run('duplicate friendship pairs', 'SELECT count(*)::int AS dupes FROM (SELECT requester_id, addressee_id FROM friendships GROUP BY 1, 2 HAVING count(*) > 1) d');

  section('DATA AGE / HYGIENE');
  await countEach('rows older than 6 months (hot tables)', []);
  for (const [t] of [['posts'], ['comments'], ['messages'], ['notifications'], ['likes']]) {
    try {
      const r = await pool.query(`SELECT count(*)::int AS stale FROM "${t}" WHERE created_at < now() - interval '6 months'`);
      console.log(`${t.padEnd(28)} ${r.rows[0].stale}`);
    } catch (e) {
      console.log(`${t.padEnd(28)} ERROR: ${e.message.split('\n')[0]}`);
    }
  }

  section('DEAD / DORMANT FEATURE ROWS');
  await countEach('exact counts', [
    'user_points', 'point_transactions', 'achievements', 'user_achievements', 'user_reputation',
    'post_views', 'user_activity_logs', 'user_notification_settings',
    'chat_rooms', 'chat_room_members', 'chat_messages',
    'reports', 'moderation_actions', 'query_performance_logs',
    'user_feed_preferences', 'user_post_feedback', 'post_shares', 'words'
  ]);

  await pool.end();
  console.log('\nAudit complete (read-only, nothing was written).');
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
