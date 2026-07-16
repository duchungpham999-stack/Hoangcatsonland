const attempts = [];

export async function recordLoginAttempt(attempt) {
  attempts.push({ ...attempt, at: new Date().toISOString() });
}

export async function listRecentLoginAttempts() {
  return attempts.slice(-50);
}
