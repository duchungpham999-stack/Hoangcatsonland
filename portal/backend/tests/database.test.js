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

test('permission foundation migration creates system admin permissions safely', async () => {
  const migration = await readFile(
    new URL('../src/database/migrations/005_permission-foundation.sql', import.meta.url),
    'utf8'
  );

  for (const permission of [
    'ids.access',
    'hrm.access',
    'gis.access',
    'users.manage',
    'roles.manage',
    'audit.read'
  ]) {
    assert.equal(migration.includes(permission), true);
  }

  assert.match(migration, /insert into permissions/i);
  assert.match(migration, /insert into roles/i);
  assert.match(migration, /system_admin/);
  assert.match(migration, /insert into role_permissions/i);
  assert.match(migration, /where not exists/i);
  assert.equal(/insert into users/i.test(migration), false);
});

test('user administration migration adds safe account administration fields', async () => {
  const migration = await readFile(
    new URL('../src/database/migrations/006_user-administration.sql', import.meta.url),
    'utf8'
  );

  assert.match(migration, /alter table users add column if not exists display_name text/i);
  assert.match(migration, /must_change_password boolean not null default true/i);
  assert.match(migration, /password_changed_at timestamptz/i);
  assert.match(migration, /last_login_at timestamptz/i);
  assert.match(migration, /created_by_user_id uuid/i);
  assert.match(migration, /foreign key \(created_by_user_id\) references users\(id\)/i);
  assert.match(migration, /on delete set null/i);
  assert.match(migration, /users_status_idx/i);
  assert.match(migration, /users_created_at_idx/i);
  assert.match(migration, /users_created_by_user_id_idx/i);
  assert.equal(/insert into users/i.test(migration), false);
});

test('employee identity migration creates departments and immutable employee code foundation', async () => {
  const migration = await readFile(
    new URL('../src/database/migrations/007_employee-identity-and-department-history.sql', import.meta.url),
    'utf8'
  );

  assert.match(migration, /create table if not exists departments/i);
  assert.match(migration, /employee_code varchar\(30\)/i);
  assert.match(migration, /\^HCS_\[A-Z\]\{2,10\}\[0-9\]\{3,5\}\$/);
  assert.match(migration, /users_employee_code_unique/i);
  assert.match(migration, /create table if not exists employee_department_history/i);
  assert.match(migration, /employee_department_history_one_active/i);
  assert.match(migration, /departments.manage/);
  assert.equal(/drop table/i.test(migration), false);
  assert.equal(/delete from users/i.test(migration), false);
});

test('employee code sequence migration creates non-negative department sequence table', async () => {
  const migration = await readFile(
    new URL('../src/database/migrations/008_employee-code-sequence.sql', import.meta.url),
    'utf8'
  );

  assert.match(migration, /create table if not exists department_employee_sequences/i);
  assert.match(migration, /department_id uuid primary key references departments\(id\) on delete restrict/i);
  assert.match(migration, /last_sequence integer not null default 0/i);
  assert.match(migration, /last_sequence >= 0/i);
  assert.equal(/max\s*\(/i.test(migration), false);
});

test('employment date migration adds date-only labor fields without touching system timestamps', async () => {
  const migration = await readFile(
    new URL('../src/database/migrations/009_employment-date-only.sql', import.meta.url),
    'utf8'
  );

  assert.match(migration, /employment_started_on date/i);
  assert.match(migration, /employment_ended_on date/i);
  assert.match(migration, /employment_started_at::date/i);
  assert.match(migration, /employment_ended_at::date/i);
  assert.match(migration, /employment_ended_on >= employment_started_on/i);
  assert.equal(/drop column/i.test(migration), false);
  assert.equal(/created_at/i.test(migration), false);
  assert.equal(/updated_at/i.test(migration), false);
  assert.equal(/last_login_at/i.test(migration), false);
  assert.equal(/password_changed_at/i.test(migration), false);
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
