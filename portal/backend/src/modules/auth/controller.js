import { json } from '../../core/http/response.js';
import { readJson } from '../../core/http/request.js';
import { authenticateUser } from './service.js';
import { loginSchema } from './schema.js';
import { validate } from '../../core/validation/validate.js';
import { requireAuthentication } from '../../core/security/authentication-middleware.js';

export async function login(req) {
  const body = validate(loginSchema, await readJson(req));
  const result = await authenticateUser(body, req);
  return json(200, result.payload, result.headers);
}

export async function profile(req) {
  const denied = await requireAuthentication(req);
  if (denied) return denied;
  return json(200, { user: req.user });
}
