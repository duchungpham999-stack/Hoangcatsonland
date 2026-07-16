import { createServer } from 'node:http';
import { createRouter } from './core/http/router.js';
import { json } from './core/http/response.js';
import { exceptionHandler } from './core/security/exception-handler.js';
import { requestAuditLogger } from './core/security/audit-logger.js';
import { rateLimit } from './core/security/rate-limiter.js';
import { csrfProtection } from './core/security/csrf-protection.js';
import { devicePolicy } from './core/security/device-policy.js';
import { getReadiness } from './core/readiness/readiness.js';
import { registerModuleRoutes } from './modules/index.js';

export function createApp(env) {
  const router = createRouter();

  router.get('/api/health', async () => json(200, { status: 'ok', service: 'ids-hrm-gis-portal' }));
  router.get('/api/ready', async () => getReadiness(env));
  registerModuleRoutes(router);

  return createServer(exceptionHandler(async (req, res) => {
    await requestAuditLogger(req);
    await rateLimit(req, env);
    await devicePolicy(req, env);
    await csrfProtection(req);
    await router.handle(req, res);
  }, env));
}
