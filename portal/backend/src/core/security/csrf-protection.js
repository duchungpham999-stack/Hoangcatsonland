import { json } from '../http/response.js';

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function csrfProtection(req) {
  if (!unsafeMethods.has(req.method)) return null;
  if (req.headers['x-csrf-token']) return null;
  throw json(403, { error: 'csrf_token_required' });
}
