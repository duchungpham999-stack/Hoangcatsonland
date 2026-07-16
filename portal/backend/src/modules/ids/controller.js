import { json } from '../../core/http/response.js';
import { getIdsOverview } from './service.js';

export async function overview() {
  return json(200, { data: await getIdsOverview() });
}
