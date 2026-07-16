import { json } from '../../core/http/response.js';
import { listDevices } from './service.js';

export async function list() {
  return json(200, { data: await listDevices() });
}
