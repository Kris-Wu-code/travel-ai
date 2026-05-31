#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function parseArgs() {
  const args = {};
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([a-zA-Z0-9_-]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const sqlFile = args.file || args.f || 'scripts/data/bupt_shahe.upsert.sql';
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable not set.');
    console.error('Set it to your Postgres connection string (Supabase service_role or psql URL).');
    process.exit(2);
  }

  const abs = path.resolve(process.cwd(), sqlFile);
  if (!fs.existsSync(abs)) {
    console.error('SQL file not found:', abs);
    process.exit(2);
  }

  const sql = fs.readFileSync(abs, 'utf-8');
  const client = new Client({ connectionString: databaseUrl });
  try {
    console.log('Connecting to DB...');
    await client.connect();
    console.log('Beginning transaction and executing SQL file:', abs);
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('SQL applied successfully.');
  } catch (err) {
    console.error('Error applying SQL:', err.message || err);
    try { await client.query('ROLLBACK'); } catch (_) {}
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
