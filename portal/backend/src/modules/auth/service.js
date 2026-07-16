import { verifyPassword } from './password/password-service.js';
import { verifyMfaChallenge } from './mfa/mfa-service.js';
import { verifyDeviceAccess } from './device-access/device-access-service.js';
import { recordLoginAttempt } from './login-attempts/login-attempt-service.js';
import { createServerSession } from './session/session-service.js';
import { findUserByUsername } from './repository.js';
import { auditEvent } from '../../core/security/audit-logger.js';

export async function authenticateUser(credentials, req) {
  const user = await findUserByUsername(credentials.username);
  const passwordOk = user ? await verifyPassword(credentials.password, user.passwordHash) : false;

  await recordLoginAttempt({ username: credentials.username, success: passwordOk, ip: req.socket.remoteAddress });
  if (!passwordOk) throw { statusCode: 401, headers: { 'content-type': 'application/json' }, body: '{"error":"invalid_credentials"}' };

  await verifyMfaChallenge(user, credentials);
  await verifyDeviceAccess(user, req);

  const session = await createServerSession(user);
  await auditEvent({ action: 'auth.login', actorId: user.id });

  return {
    payload: { user: { id: user.id, username: user.username, permissions: user.permissions } },
    headers: session.headers
  };
}
