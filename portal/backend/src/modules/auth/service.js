import { hashPassword, verifyPassword } from './password/password-service.js';
import { verifyDeviceAccess } from './device-access/device-access-service.js';
import { createServerSession, getCurrentSession, revokeCurrentSession, revokeOtherUserSessions } from './session/session-service.js';
import { assertUserCanLogin, getUserForLogin } from '../users/service.js';
import { updateLastLoginAt, updateUserPassword } from '../users/repository.js';
import { recordLoginAttempt, shouldTemporarilyLockLogin } from './login-attempts/login-attempt-service.js';
import { countRecentFailures as countRecentDbFailures, recordLoginAttempt as recordDbLoginAttempt } from './login-attempts/login-attempt-repository.js';
import { writeAuditEvent } from '../audit/audit-service.js';

export async function authenticateUser(credentials, req) {
  const env = req.app.env;
  const dependencies = req.app.dependencies || {};
  const loginAttemptRepository = dependencies.loginAttemptRepository || createLoginAttemptRepository(env);
  const identifier = credentials.email || credentials.username;
  await verifyDeviceAccess(null, req);

  if (await shouldTemporarilyLockLogin(identifier, loginAttemptRepository)) {
    await auditAuth(env, dependencies, req, null, 'login_failure', 'failure', { reason: 'temporarily_locked' });
    throw invalidCredentials();
  }

  const user = await getUserForLogin(env, identifier, dependencies.userRepository);
  const passwordOk = user ? await verifyPassword(credentials.password, user.password_hash || user.passwordHash) : false;

  await recordLoginAttempt({
    identifier,
    userId: user?.id,
    success: passwordOk,
    ip: req.socket.remoteAddress,
    requestId: req.requestId
  }, loginAttemptRepository);

  if (!passwordOk) {
    await auditAuth(env, dependencies, req, user, 'login_failure', 'failure', { reason: 'invalid_credentials' });
    throw invalidCredentials();
  }

  try {
    assertUserCanLogin(user);
  } catch (error) {
    await auditAuth(env, dependencies, req, user, 'login_failure', 'failure', { reason: 'user_not_active' });
    throw error;
  }

  const session = await createServerSession(env, user, req, dependencies.sessionRepository);
  await (dependencies.userRepository?.updateLastLoginAt || updateLastLoginAt)(env, user.id);
  await auditAuth(env, dependencies, req, user, 'login_success', 'success');

  return {
    payload: { user: safeLoginUser(user) },
    headers: session.headers
  };
}

function createLoginAttemptRepository(env) {
  if (!env.database?.enabled) return null;
  return {
    recordLoginAttempt: attempt => recordDbLoginAttempt(env, attempt),
    countRecentFailures: (identifier, windowMs) => countRecentDbFailures(env, identifier, windowMs)
  };
}

export async function getAuthenticatedUser(req) {
  const session = await getCurrentSession(req.app.env, req, req.app.dependencies?.sessionRepository);
  if (!session) {
    throw { statusCode: 401, headers: { 'content-type': 'application/json' }, body: '{"error":"unauthenticated"}' };
  }
  return session.user;
}

export async function logoutUser(req) {
  const env = req.app.env;
  const dependencies = req.app.dependencies || {};
  const session = await getCurrentSession(env, req, dependencies.sessionRepository);
  const result = await revokeCurrentSession(env, req, dependencies.sessionRepository);

  await auditAuth(env, dependencies, req, session?.user, 'logout', 'success');
  return { payload: { status: 'logged_out' }, headers: result.headers };
}

export async function changeUserPassword(input, req) {
  const env = req.app.env;
  const dependencies = req.app.dependencies || {};
  const session = await getCurrentSession(env, req, dependencies.sessionRepository);
  if (!session) {
    throw { statusCode: 401, headers: { 'content-type': 'application/json' }, body: '{"error":"unauthenticated"}' };
  }

  if (String(input.newPassword || '').length < 12 || input.newPassword !== input.confirmPassword) {
    throw { statusCode: 400, headers: { 'content-type': 'application/json' }, body: '{"error":"invalid_password_change"}' };
  }

  const user = await getUserForLogin(env, session.user.username || session.user.email, dependencies.userRepository);
  const currentOk = user ? await verifyPassword(input.currentPassword, user.password_hash || user.passwordHash) : false;
  if (!currentOk || await verifyPassword(input.newPassword, user.password_hash || user.passwordHash)) {
    await auditAuth(env, dependencies, req, session.user, 'password_changed', 'failure', { reason: 'invalid_password_change' });
    throw { statusCode: 401, headers: { 'content-type': 'application/json' }, body: '{"error":"invalid_password_change"}' };
  }

  const passwordHash = await hashPassword(input.newPassword);
  await (dependencies.userRepository?.updateUserPassword || updateUserPassword)(env, session.user.id, passwordHash, false);
  await revokeOtherUserSessions(env, session.user.id, session.id, dependencies.sessionRepository);
  await auditAuth(env, dependencies, req, session.user, 'password_changed', 'success');
  return { payload: { status: 'password_changed' } };
}

function invalidCredentials() {
  return { statusCode: 401, headers: { 'content-type': 'application/json' }, body: '{"error":"invalid_credentials"}' };
}

function safeLoginUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    status: user.status
  };
}

async function auditAuth(env, dependencies, req, user, action, result, metadata = {}) {
  await writeAuditEvent(env, {
    actorUserId: user?.id,
    action,
    resourceType: 'auth',
    resourceId: user?.id,
    result,
    requestId: req.requestId,
    ip: req.socket.remoteAddress,
    metadata
  }, dependencies.auditRepository);
}
