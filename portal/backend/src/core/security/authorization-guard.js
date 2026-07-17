import { json } from '../http/response.js';
import { requireAuth } from './authentication-middleware.js';

export function requireRole(role) {
  return async req => {
    const denied = await requireAuth(req);
    if (denied) return denied;

    const roles = req.user?.roles || [];
    if (!roles.includes(role)) return json(403, { error: 'forbidden', role });
    return null;
  };
}

export function requirePermission(permission) {
  return async req => {
    const denied = await requireAuth(req);
    if (denied) return denied;

    const permissions = req.user?.permissions || [];
    if (!permissions.includes(permission)) return json(403, { error: 'forbidden', permission });
    return null;
  };
}
