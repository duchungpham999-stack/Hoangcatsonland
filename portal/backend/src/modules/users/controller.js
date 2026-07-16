import { json } from '../../core/http/response.js';
import { listUsers } from './service.js';

export async function list() {
  return json(200, { data: await listUsers() });
}
