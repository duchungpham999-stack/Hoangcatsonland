import { json } from '../http/response.js';
import { isModuleRegistryReady } from '../../modules/index.js';

export function getReadiness(env) {
  const checks = {
    configuration: Number.isInteger(env?.port) && env.port >= 0 ? 'ok' : 'failed',
    moduleRegistry: isModuleRegistryReady() ? 'ok' : 'failed'
  };
  const ready = Object.values(checks).every(status => status === 'ok');

  return json(ready ? 200 : 503, {
    status: ready ? 'ready' : 'not_ready',
    service: 'ids-hrm-gis-portal',
    checks
  });
}
