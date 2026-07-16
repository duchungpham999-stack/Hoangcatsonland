import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../../app.js';
import { loadEnv } from '../../../config/env.js';
import { hashPassword, verifyPassword } from '../password/password-service.js';

test('password verifier rejects empty input', async () => {
  assert.equal(await verifyPassword('', 'configured-hash'), false);
});

test('password hashing verifies valid password and rejects invalid password', async () => {
  const hash = await hashPassword('correct horse battery');

  assert.equal(hash.includes('correct horse battery'), false);
  assert.equal(await verifyPassword('correct horse battery', hash), true);
  assert.equal(await verifyPassword('wrong horse battery', hash), false);
});

test('login, me, and logout session flow works without exposing secrets', async () => {
  const passwordHash = await hashPassword('correct horse battery');
  const fixture = createAuthFixture({
    user: {
      id: 'user_1',
      email: 'admin@example.test',
      username: 'admin',
      display_name: 'admin',
      status: 'active',
      password_hash: passwordHash
    }
  });

  await withAuthServer(fixture.dependencies, async baseUrl => {
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'test'
      },
      body: JSON.stringify({ email: 'admin@example.test', password: 'correct horse battery' })
    });
    const loginBody = await loginResponse.json();
    const cookie = loginResponse.headers.get('set-cookie');

    assert.equal(loginResponse.status, 200);
    assert.match(cookie, /ids_session_dev=/);
    assert.equal(JSON.stringify(loginBody).includes('password_hash'), false);
    assert.equal(JSON.stringify(loginBody).includes('session'), false);
    assert.equal(fixture.sessions.size, 1);

    const meResponse = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { cookie }
    });
    const meBody = await meResponse.json();

    assert.equal(meResponse.status, 200);
    assert.deepEqual(meBody.user.roles, ['system_admin']);
    assert.equal(JSON.stringify(meBody).includes('password_hash'), false);

    const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'x-csrf-token': 'test',
        cookie
      }
    });
    const logoutBody = await logoutResponse.json();

    assert.equal(logoutResponse.status, 200);
    assert.equal(logoutBody.status, 'logged_out');
    assert.equal([...fixture.sessions.values()][0].revoked_at instanceof Date, true);
  });
});

test('login rejects wrong password with generic response', async () => {
  const passwordHash = await hashPassword('correct horse battery');
  const fixture = createAuthFixture({
    user: {
      id: 'user_1',
      email: 'admin@example.test',
      username: 'admin',
      display_name: 'admin',
      status: 'active',
      password_hash: passwordHash
    }
  });

  await withAuthServer(fixture.dependencies, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'test'
      },
      body: JSON.stringify({ email: 'admin@example.test', password: 'wrong horse battery' })
    });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.error, 'invalid_credentials');
    assert.equal(JSON.stringify(body).includes('admin@example.test'), false);
  });
});

test('login rejects disabled users with generic response', async () => {
  const passwordHash = await hashPassword('correct horse battery');
  const fixture = createAuthFixture({
    user: {
      id: 'user_1',
      email: 'admin@example.test',
      username: 'admin',
      display_name: 'admin',
      status: 'disabled',
      password_hash: passwordHash
    }
  });

  await withAuthServer(fixture.dependencies, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'test'
      },
      body: JSON.stringify({ email: 'admin@example.test', password: 'correct horse battery' })
    });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.error, 'invalid_credentials');
  });
});

test('mobile device policy blocks login in backend', async () => {
  const fixture = createAuthFixture();

  await withAuthServer(fixture.dependencies, async baseUrl => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'test',
        'user-agent': 'Mozilla/5.0 iPhone Mobile'
      },
      body: JSON.stringify({ email: 'admin@example.test', password: 'correct horse battery' })
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, 'device_not_allowed');
  });
});

function createAuthFixture(options = {}) {
  const sessions = new Map();
  const user = options.user || null;
  const userRepository = {
    async findUserByEmailOrUsername() {
      return user;
    },
    async getUserRolesAndPermissions() {
      return { roles: ['system_admin'], permissions: ['portal:read'] };
    }
  };
  const sessionRepository = {
    async createSessionRecord(env, session) {
      const record = {
        id: 'session_1',
        user_id: session.userId,
        device_id: null,
        session_token_hash: session.sessionTokenHash,
        idle_expires_at: session.idleExpiresAt,
        absolute_expires_at: session.absoluteExpiresAt,
        revoked_at: null
      };
      sessions.set(session.sessionTokenHash, record);
      return record;
    },
    async findSessionByTokenHash(env, tokenHash) {
      const session = sessions.get(tokenHash);
      if (!session || !user) return null;
      return {
        ...session,
        email: user.email,
        normalized_email: user.email,
        username: user.username,
        display_name: user.display_name,
        status: user.status
      };
    },
    async revokeSessionByTokenHash(env, tokenHash) {
      const session = sessions.get(tokenHash);
      if (!session) return false;
      session.revoked_at = new Date();
      return true;
    },
    async getUserRolesAndPermissions() {
      return { roles: ['system_admin'], permissions: ['portal:read'] };
    }
  };

  return {
    sessions,
    dependencies: {
      userRepository,
      sessionRepository,
      auditRepository: { async insertAuditLog() {} },
      loginAttemptRepository: {
        async recordLoginAttempt() {},
        async countRecentFailures() { return 0; }
      }
    }
  };
}

async function withAuthServer(dependencies, run) {
  const env = loadEnv({ NODE_ENV: 'development', PORT: '4173' });
  const server = createApp({ ...env, port: 0 }, dependencies);
  await new Promise(resolve => server.listen(0, resolve));

  try {
    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}
