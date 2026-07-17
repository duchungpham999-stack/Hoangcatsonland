import { createServer } from 'node:http';
import { createRouter } from './core/http/router.js';
import { json } from './core/http/response.js';
import { exceptionHandler } from './core/security/exception-handler.js';
import { requestAuditLogger } from './core/security/audit-logger.js';
import { rateLimit } from './core/security/rate-limiter.js';
import { csrfProtection } from './core/security/csrf-protection.js';
import { devicePolicy } from './core/security/device-policy.js';
import { getReadiness } from './core/readiness/readiness.js';
import { getFrontendAsset } from './core/http/static-files.js';
import { writeResponse } from './core/http/write-response.js';
import { registerModuleRoutes } from './modules/index.js';

export function createApp(env, dependencies = {}) {
  const router = createRouter();

  router.get('/api/health', async () => json(200, { status: 'ok', service: 'ids-hrm-gis-portal' }));
  router.get('/api/ready', async () => getReadiness(env, dependencies));
  registerModuleRoutes(router);

  return createServer(exceptionHandler(async (req, res) => {
    req.app = { env, dependencies };
    await requestAuditLogger(req);
    await rateLimit(req, env);
    await devicePolicy(req, env);
    await csrfProtection(req);

    if (req.method === 'GET' && !new URL(req.url, 'http://localhost').pathname.startsWith('/api/')) {
      const staticAsset = await getFrontendAsset(req);
      if (staticAsset) {
        writeResponse(req, res, staticAsset);
        return;
      }
    }

    await router.handle(req, res);
  }, env));
}
