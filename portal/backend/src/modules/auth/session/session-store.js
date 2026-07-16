const sessions = new Map();

export function saveSession(sessionId, session) {
  sessions.set(sessionId, session);
}

export function findSession(req) {
  const cookie = req.headers.cookie || '';
  const sessionId = cookie.split(';').map(item => item.trim()).find(item => item.startsWith('__Host-ids_session='));
  if (!sessionId) return null;
  return sessions.get(decodeURIComponent(sessionId.split('=').slice(1).join('='))) || null;
}
