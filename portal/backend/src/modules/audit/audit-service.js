import { insertAuditLog } from './audit-repository.js';

export async function writeAuditEvent(env, event, repository) {
  if (repository?.insertAuditLog) {
    await repository.insertAuditLog(env, sanitizeEvent(event));
    return;
  }

  if (env.database?.enabled) {
    await insertAuditLog(env, sanitizeEvent(event));
  }
}

function sanitizeEvent(event) {
  const metadata = { ...(event.metadata || {}) };
  for (const key of ['password', 'token', 'cookie', 'otp', 'sessionToken']) {
    delete metadata[key];
  }
  return { ...event, metadata };
}
