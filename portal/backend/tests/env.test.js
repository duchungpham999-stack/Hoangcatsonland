import test from 'node:test';
import assert from 'node:assert/strict';
import { loadEnv } from '../src/config/env.js';

const validProductionEnv = {
  NODE_ENV: 'production',
  HOST: '127.0.0.1',
  PORT: '4173',
  APP_ORIGIN: 'https://portal.example.test',
  DATABASE_URL: 'postgres://portal_user:strong-pass@db.example.test:5432/portal',
  SESSION_SECRET: 'a-strong-session-value-with-32-plus-chars'
};

test('development config is valid', () => {
  const env = loadEnv({
    NODE_ENV: 'development',
    PORT: '4173'
  });

  assert.equal(env.nodeEnv, 'development');
  assert.equal(env.port, 4173);
  assert.equal(env.configurationValid, true);
});

test('invalid NODE_ENV is rejected', () => {
  assert.throws(() => loadEnv({ NODE_ENV: 'local', PORT: '4173' }), /Invalid NODE_ENV/);
});

test('invalid PORT is rejected', () => {
  assert.throws(() => loadEnv({ NODE_ENV: 'development', PORT: '70000' }), /Invalid PORT/);
});

test('production requires DATABASE_URL', () => {
  const { DATABASE_URL, ...env } = validProductionEnv;

  assert.throws(() => loadEnv(env), /DATABASE_URL is required/);
});

test('production requires SESSION_SECRET', () => {
  const { SESSION_SECRET, ...env } = validProductionEnv;

  assert.throws(() => loadEnv(env), /SESSION_SECRET is required/);
});

test('production requires HTTPS APP_ORIGIN', () => {
  assert.throws(() => loadEnv({
    ...validProductionEnv,
    APP_ORIGIN: 'http://portal.example.test'
  }), /APP_ORIGIN must use HTTPS/);
});

test('placeholder session secret is rejected', () => {
  assert.throws(() => loadEnv({
    ...validProductionEnv,
    SESSION_SECRET: 'changeme-secret-example-password-value'
  }), /SESSION_SECRET is required/);
});
