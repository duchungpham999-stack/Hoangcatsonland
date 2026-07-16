import { json } from '../../core/http/response.js';
import { listPermissions } from './service.js';

export async function list() {
  return json(200, { data: await listPermissions() });
}
