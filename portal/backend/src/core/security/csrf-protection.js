import { json } from '../http/response.js';
import { validateCsrfToken } from '../../modules/auth/csrf/csrf-service.js';

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function csrfProtection(req) {
  if (!unsafeMethods.has(req.method)) return null;
  if (validateCsrfToken(req)) return null;
  throw json(403, { error: 'csrf_token_required' });
}
