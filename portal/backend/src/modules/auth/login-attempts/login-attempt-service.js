const attempts = [];
const failureWindowMs = 15 * 60 * 1000;
const maxFailures = 5;

export async function recordLoginAttempt(attempt, repository) {
  const event = { ...attempt, at: new Date().toISOString() };
  attempts.push(event);
  if (repository?.recordLoginAttempt) await repository.recordLoginAttempt(event);
}

export async function listRecentLoginAttempts() {
  return attempts.slice(-50);
}

export async function shouldTemporarilyLockLogin(identifier, repository) {
  if (repository?.countRecentFailures) {
    return await repository.countRecentFailures(identifier, failureWindowMs) >= maxFailures;
  }

  const normalized = normalizeIdentifier(identifier);
  const cutoff = Date.now() - failureWindowMs;
  const recentFailures = attempts.filter(item =>
    normalizeIdentifier(item.identifier) === normalized &&
    item.success === false &&
    new Date(item.at).getTime() >= cutoff
  );

  return recentFailures.length >= maxFailures;
}

function normalizeIdentifier(identifier) {
  return String(identifier || '').trim().toLowerCase();
}
