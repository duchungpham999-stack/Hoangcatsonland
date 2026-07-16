import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { redactDatabaseUrl } from '../src/database/connection.js';
import { ensureMigrationRegistry, listMigrationFiles } from '../src/database/migration-runner.js';
import { loadEnv } from '../src/config/env.js';

test('migration files are ordered by filename', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'portal-migrations-'));
  try {
    await writeFile(join(directory, '010_later.sql'), 'select 1;');
    await writeFile(join(directory, '001_first.sql'), 'select 1;');
    await writeFile(join(directory, 'not-a-migration.sql'), 'select 1;');

    assert.deepEqual(await listMigrationFiles(directory), ['001_first.sql', '010_later.sql']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('migration registry table is created', async () => {
  const queries = [];
  const pool = {
    async query(sql) {
      queries.push(sql);
      return { rows: [] };
    }
  };

  await ensureMigrationRegistry(pool);

  assert.equal(queries.some(sql => sql.includes('create table if not exists schema_migrations')), true);
});

test('real migration registry includes authentication foundation migration', async () => {
  const files = await listMigrationFiles();

  assert.equal(files.includes('004_authentication-foundation.sql'), true);
  assert.deepEqual(files, [...files].sort((first, second) => first.localeCompare(second)));
});

test('authentication foundation migration safely backfills username', async () => {
  const migration = await readFile(
    new URL('../src/database/migrations/004_authentication-foundation.sql', import.meta.url),
    'utf8'
  );

  const addColumn = migration.indexOf('alter table users add column if not exists username text');
  const backfill = migration.indexOf('for user_record in');
  const setNotNull = migration.indexOf('alter table users alter column username set not null');
  const uniqueIndex = migration.indexOf('create unique index if not exists users_username_lower_unique');

  assert.ok(addColumn >= 0);
  assert.ok(backfill > addColumn);
  assert.ok(setNotNull > backfill);
  assert.ok(uniqueIndex > setNotNull);
  assert.match(migration, /split_part\(user_record\.normalized_email, '@', 1\)/);
  assert.match(migration, /candidate_username := base_username \|\| '-' \|\| suffix::text/);
  assert.match(migration, /lower\(username\)/);
});

test('database url redaction hides credentials', () => {
  const redacted = redactDatabaseUrl('postgres://portal_user:super-secret@localhost:5432/portal');

  assert.equal(redacted.includes('portal_user'), false);
  assert.equal(redacted.includes('super-secret'), false);
  assert.equal(redacted.includes('localhost'), true);
});

test('readiness returns 503 when configured database is unavailable', async () => {
  await withDatabaseReadyServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/ready`);
    const body = await response.json();

    assert.equal(response.status, 503);
    assert.equal(body.status, 'not_ready');
    assert.equal(body.checks.database, 'failed');
  }, async () => ({ status: 'failed' }));
});

test('readiness returns 200 when configured database is ready', async () => {
  await withDatabaseReadyServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/ready`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, 'ready');
    assert.equal(body.checks.database, 'ok');
  }, async () => ({ status: 'ok' }));
});

async function withDatabaseReadyServer(run, checkDatabase) {
  const env = loadEnv({
    NODE_ENV: 'development',
    PORT: '4173',
    DATABASE_URL: 'postgres://portal_user:portal_password@localhost:5432/portal'
  });
  const server = createApp({ ...env, port: 0 }, { checkDatabase });
  await new Promise(resolve => server.listen(0, resolve));

  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}
