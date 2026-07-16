import { json } from '../http/response.js';
import { findSession } from '../../modules/auth/session/session-store.js';

export async function requireAuthentication(req) {
  const session = findSession(req);
  if (!session) return json(401, { error: 'unauthenticated' });

  req.session = session;
  req.user = session.user;
  return null;
}
