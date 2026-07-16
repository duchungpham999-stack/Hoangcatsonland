import { serializeSecureCookie } from '../../../core/security/secure-cookies.js';
import { saveSession } from './session-store.js';

export async function createServerSession(user) {
  const sessionId = crypto.randomUUID();
  saveSession(sessionId, { id: sessionId, user, createdAt: new Date().toISOString() });

  return {
    id: sessionId,
    headers: {
      'set-cookie': serializeSecureCookie('__Host-ids_session', sessionId, { secure: false, maxAge: 3600 })
    }
  };
}
