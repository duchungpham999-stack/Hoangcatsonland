import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from '../config/env.js';
import { closeDatabasePool, getDatabasePool } from './connection.js';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

export async function listMigrationFiles(directory = migrationsDir) {
  const files = await readdir(directory);
  return files
    .filter(file => /^\d+_[a-z0-9-]+\.sql$/.test(file))
    .sort((first, second) => first.localeCompare(second));
}

export async function ensureMigrationRegistry(pool) {
  await pool.query(`
    create table if not exists schema_migrations (
      id text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);
}

export async function getAppliedMigrations(pool) {
  await ensureMigrationRegistry(pool);
  const result = await pool.query('select id from schema_migrations order by id');
  return new Set(result.rows.map(row => row.id));
}

export async function getMigrationStatus(pool, directory = migrationsDir) {
  const files = await listMigrationFiles(directory);
  const applied = await getAppliedMigrations(pool);
  return files.map(file => ({
    id: file.replace(/\.sql$/, ''),
    file,
    applied: applied.has(file.replace(/\.sql$/, ''))
  }));
}

export async function runMigrations(pool, directory = migrationsDir) {
  const files = await listMigrationFiles(directory);
  const applied = await getAppliedMigrations(pool);
  const appliedNow = [];

  for (const file of files) {
    const id = file.replace(/\.sql$/, '');
    if (applied.has(id)) continue;

    const sql = await readFile(join(directory, file), 'utf8');
    const checksum = await sha256(sql);

    await pool.query('begin');
    try {
      await pool.query(sql);
      await pool.query(
        'insert into schema_migrations (id, checksum) values ($1, $2)',
        [id, checksum]
      );
      await pool.query('commit');
      appliedNow.push(id);
    } catch (error) {
      await pool.query('rollback');
      throw error;
    }
  }

  return appliedNow;
}

async function sha256(value) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const command = process.argv[2] || 'status';

  try {
    const env = loadEnv();
    const pool = await getDatabasePool(env.database);
    if (!pool) throw new Error('DATABASE_URL is not configured.');

    if (command === 'migrate') {
      const applied = await runMigrations(pool);
      console.log(JSON.stringify({ applied }));
    } else if (command === 'status') {
      const status = await getMigrationStatus(pool);
      console.log(JSON.stringify({ migrations: status }, null, 2));
    } else {
      throw new Error(`Unknown migration command: ${command}`);
    }

    await closeDatabasePool();
  } catch (error) {
    console.error(error.message);
    await closeDatabasePool();
    process.exit(1);
  }
}
