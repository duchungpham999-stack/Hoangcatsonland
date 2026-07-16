import { json } from '../http/response.js';

export function requirePermission(permission) {
  return async req => {
    const permissions = req.user?.permissions || [];
    if (!permissions.includes(permission)) return json(403, { error: 'forbidden', permission });
    return null;
  };
}
