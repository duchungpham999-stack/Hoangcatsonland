import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { loadEnv } from '../src/core/config/env.js';

async function withTestServer(run, envOverrides = {}) {
  const server = createApp({ ...loadEnv(), ...envOverrides, port: 0 });
  await new Promise(resolve => server.listen(0, resolve));

  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('health endpoint responds with ok', async () => {
  await withTestServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.status, 'ok');
    assert.match(response.headers.get('x-request-id'), /^[a-zA-Z0-9._:-]{8,128}$/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.has('access-control-allow-origin'), false);
  });
});

test('valid incoming request id is preserved', async () => {
  await withTestServer(async baseUrl => {
    const requestId = 'client-request-123';
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: { 'X-Request-ID': requestId }
    });

    assert.equal(response.headers.get('x-request-id'), requestId);
  });
});

test('missing request id is generated', async () => {
  await withTestServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/health`);

    assert.match(response.headers.get('x-request-id'), /^[0-9a-f-]{36}$/);
  });
});

test('ready endpoint reports current dependencies', async () => {
  await withTestServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/ready`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.equal(body.status, 'ready');
    assert.equal(body.service, 'ids-hrm-gis-portal');
    assert.equal(body.checks.configuration, 'ok');
    assert.equal(body.checks.moduleRegistry, 'ok');
    assert.equal(Object.hasOwn(body.checks, 'database'), false);
  });
});

test('module endpoint is registered', async () => {
  await withTestServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/ids/overview`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.alerts, 0);
  });
});

test('unknown route still responds with not_found', async () => {
  await withTestServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/not-a-route`);
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, 'not_found');
    assert.equal(body.requestId, response.headers.get('x-request-id'));
  });
});

test('exception response is sanitized in production', async () => {
  await withTestServer(async baseUrl => {
    const requestId = 'prod-error-123';
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'test',
        'x-request-id': requestId
      },
      body: '{'
    });
    const body = await response.json();
    const serializedBody = JSON.stringify(body);

    assert.equal(response.status, 500);
    assert.equal(body.error, 'internal_error');
    assert.equal(body.requestId, requestId);
    assert.equal(serializedBody.includes('SyntaxError'), false);
    assert.equal(serializedBody.includes('portal'), false);
    assert.equal(serializedBody.includes('backend'), false);
  }, { nodeEnv: 'production' });
});
