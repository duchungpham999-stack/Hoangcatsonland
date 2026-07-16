import { json } from '../../core/http/response.js';
import { readJson } from '../../core/http/request.js';
import { authenticateUser, getAuthenticatedUser, logoutUser } from './service.js';
import { loginSchema } from './schema.js';
import { validate } from '../../core/validation/validate.js';

export async function login(req) {
  const body = validate(loginSchema, await readJson(req));
  const result = await authenticateUser(body, req);
  return json(200, result.payload, result.headers);
}

export async function logout(req) {
  const result = await logoutUser(req);
  return json(200, result.payload, result.headers);
}

export async function me(req) {
  const user = await getAuthenticatedUser(req);
  return json(200, { user });
}
