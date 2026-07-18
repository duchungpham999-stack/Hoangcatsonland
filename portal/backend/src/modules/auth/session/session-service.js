import { serializeExpiredCookie, serializeSecureCookie } from '../../../core/security/secure-cookies.js';
import { getUserRolesAndPermissions, toPublicUser } from '../../users/repository.js';
import {
  createSessionRecord,
  findSessionByTokenHash,
  revokeSessionByTokenHash,
  revokeSessionsByUserId
} from './session-repository.js';
import { createSessionToken, getCookieValue, hashSessionToken } from './token-service.js';

const idleSessionMs = 30 * 60 * 1000;
const absoluteSessionMs = 12 * 60 * 60 * 1000;

export async function createServerSession(env, user, req, repository) {
  const token = createSessionToken();
  const sessionTokenHash = hashSessionToken(token);
  const now = Date.now();
  const session = await (repository?.createSessionRecord || createSessionRecord)(env, {
    userId: user.id,
    deviceId: null,
    sessionTokenHash,
    idleExpiresAt: new Date(now + idleSessionMs),
    absoluteExpiresAt: new Date(now + absoluteSessionMs)
  });

  return {
    id: session.id,
    token,
    tokenHash: sessionTokenHash,
    headers: {
      'set-cookie': serializeSecureCookie(env.session.sessionCookieName, token, {
        secure: env.session.cookieSecure,
        maxAge: Math.floor(absoluteSessionMs / 1000)
      })
    }
  };
}

export async function getCurrentSession(env, req, repository) {
  const token = getCookieValue(req, env.session.sessionCookieName);
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const session = await (repository?.findSessionByTokenHash || findSessionByTokenHash)(env, tokenHash);
  if (!isSessionValid(session)) return null;

  const access = await (repository?.getUserRolesAndPermissions || getUserRolesAndPermissions)(env, session.user_id);
  return {
    id: session.id,
    tokenHash,
    user: toPublicUser({
      id: session.user_id,
      email: session.email,
      username: session.username,
      display_name: session.display_name,
      status: session.status,
      must_change_password: session.must_change_password
    }, access)
  };
}

export async function revokeCurrentSession(env, req, repository) {
  const token = getCookieValue(req, env.session.sessionCookieName);
  if (!token) return { revoked: false, headers: clearSessionCookie(env) };

  const tokenHash = hashSessionToken(token);
  const revoked = await (repository?.revokeSessionByTokenHash || revokeSessionByTokenHash)(env, tokenHash);
  return { revoked, tokenHash, headers: clearSessionCookie(env) };
}

export async function revokeOtherUserSessions(env, userId, currentSessionId, repository) {
  return (repository?.revokeSessionsByUserId || revokeSessionsByUserId)(env, userId, currentSessionId);
}

export async function revokeAllUserSessions(env, userId, repository) {
  return (repository?.revokeSessionsByUserId || revokeSessionsByUserId)(env, userId, null);
}

export function clearSessionCookie(env) {
  return {
    'set-cookie': serializeExpiredCookie(env.session.sessionCookieName, {
      secure: env.session.cookieSecure
    })
  };
}

function isSessionValid(session) {
  if (!session || session.revoked_at) return false;
  const now = Date.now();
  return new Date(session.idle_expires_at).getTime() > now &&
    new Date(session.absolute_expires_at).getTime() > now &&
    session.status === 'active';
}
