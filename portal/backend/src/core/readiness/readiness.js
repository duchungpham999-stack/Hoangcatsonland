import { json } from '../http/response.js';
import { checkDatabase } from '../../database/health.js';
import { isModuleRegistryReady } from '../../modules/index.js';

export async function getReadiness(env, dependencies = {}) {
  const database = await getDatabaseReadiness(env, dependencies);
  const checks = {
    configuration: env?.configurationValid === true ? 'ok' : 'failed',
    moduleRegistry: isModuleRegistryReady() ? 'ok' : 'failed',
    ...(database ? { database } : {})
  };
  const ready = Object.values(checks).every(status => status === 'ok');

  return json(ready ? 200 : 503, {
    status: ready ? 'ready' : 'not_ready',
    service: 'ids-hrm-gis-portal',
    checks
  });
}

async function getDatabaseReadiness(env, dependencies) {
  if (!env?.database?.enabled) return null;

  try {
    const result = await (dependencies.checkDatabase || checkDatabase)(env.database, dependencies);
    return result.status === 'ok' ? 'ok' : 'failed';
  } catch {
    return 'failed';
  }
}
