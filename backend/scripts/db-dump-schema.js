#!/usr/bin/env node
/**
 * Dump the public schema of the Gossip Supabase database to SQL.
 * Read-only introspection; output is a faithful structural snapshot
 * (tables, columns, defaults, PK/FK/unique constraints, indexes).
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node scripts/db-dump-schema.js [outfile]
 */
const { Pool } = require('pg');
const fs = require('fs');

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

const q = (sql) => pool.query(sql);

const fmtDefault = (d) => {
  if (d === null) return '';
  // Strip pg's implicit casts on simple defaults for readability
  return d.replace(/::[a-z_ ]+(?=\))/g, '').replace(/^'(.*)'(?:::[a-zA-Z_ ]+)?$/, '$1');
};

(async () => {
  const out = [];
  const push = (s = '') => out.push(s);

  const { rows: ident } = await q("SELECT current_database() AS db, current_setting('server_version') AS ver");
  push('-- ============================================================================');
  push('-- GOSSIP SCHEMA DUMP');
  push(`-- Generated: ${new Date().toISOString()}`);
  push(`-- Database: ${ident[0].db}  |  PostgreSQL ${ident[0].ver}`);
  push('-- Structural snapshot only (no data). Re-dump after schema changes.');
  push('-- ============================================================================');
  push();
  push('BEGIN;');
  push();

  // Tables + columns
  const { rows: cols } = await q(`
    SELECT c.relname AS table_name, c.relrowsecurity AS rls,
           a.attname AS column_name, format_type(a.atttypid, a.atttypmod) AS data_type,
           a.attnotnull AS not_null, pg_get_expr(ad.adbin, ad.adrelid) AS default_expr,
           a.attnum AS ordinal
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    LEFT JOIN pg_attrdef ad ON ad.adrelid = c.oid AND ad.adnum = a.attnum
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname, a.attnum`);

  const tables = [...new Set(cols.map((r) => r.table_name))];
  for (const t of tables) {
    const tc = cols.filter((r) => r.table_name === t);
    push(`-- Table: ${t} (RLS ${tc[0].rls ? 'ENABLED' : 'disabled'})`);
    push(`CREATE TABLE IF NOT EXISTS public.${t} (`); // IF NOT EXISTS: dump is also reusable as bootstrap
    tc.forEach((r, i) => {
      const bits = [`  ${r.column_name} ${r.data_type}`];
      if (r.default_expr) bits.push(`DEFAULT ${fmtDefault(r.default_expr)}`);
      if (r.not_null && !r.default_expr?.includes('nextval')) bits.push('NOT NULL');
      push(bits.join(' ') + (i < tc.length - 1 ? ',' : ''));
    });
    push(');');
    if (tc[0].rls) push(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`);
    push();
  }

  // Constraints
  const { rows: cons } = await q(`
    SELECT con.conname, con.contype, c.relname AS table_name,
           pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname, con.contype, con.conname`);

  push('-- Constraints');
  for (const con of cons) {
    if (con.contype === 'p') push(`ALTER TABLE public.${con.table_name} ADD CONSTRAINT ${con.conname} ${con.def};`);
  }
  push();
  for (const con of cons) {
    if (con.contype === 'u') push(`ALTER TABLE public.${con.table_name} ADD CONSTRAINT ${con.conname} ${con.def};`);
  }
  push();
  for (const con of cons) {
    if (con.contype === 'f') push(`ALTER TABLE public.${con.table_name} ADD CONSTRAINT ${con.conname} ${con.def};`);
  }
  push();

  // Indexes
  const { rows: idx } = await q(`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname`);
  push('-- Indexes');
  for (const i of idx) {
    if (i.indexname.endsWith('_pkey')) continue; // already created via PK constraints
    if (/_key$/.test(i.indexname)) continue;      // already created via unique constraints
    push(i.indexdef + ';');
  }
  push();
  push('COMMIT;');
  push();

  const outfile = process.argv[2] || 'schema.sql';
  fs.writeFileSync(outfile, out.join('\n'));
  console.log(`Dumped ${tables.length} tables, ${cons.length} constraints, ${idx.length} indexes -> ${outfile}`);
  await pool.end();
})().catch((e) => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
