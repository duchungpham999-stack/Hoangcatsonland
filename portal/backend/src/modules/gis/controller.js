import { json } from '../../core/http/response.js';
import { getGisOverview } from './service.js';

export async function overview() {
  return json(200, { data: await getGisOverview() });
}
