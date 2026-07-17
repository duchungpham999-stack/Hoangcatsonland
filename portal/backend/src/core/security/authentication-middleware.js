import { json } from '../http/response.js';
import { getCurrentSession } from '../../modules/auth/session/session-service.js';

export async function requireAuth(req) {
  const session = await getCurrentSession(req.app.env, req, req.app.dependencies?.sessionRepository);
  if (!session) return json(401, { error: 'unauthenticated' });

  req.session = session;
  req.user = session.user;
  return null;
}

export const requireAuthentication = requireAuth;
