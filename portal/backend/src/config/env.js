import { createAppConfig } from './app.config.js';
import { createDatabaseConfig } from './database.config.js';
import { createSecurityConfig } from './security.config.js';
import { createSessionConfig } from './session.config.js';

export function loadEnv(rawEnv = process.env) {
  const app = createAppConfig(rawEnv);
  const database = createDatabaseConfig(rawEnv, app);
  const security = createSecurityConfig(rawEnv, app);
  const session = createSessionConfig(rawEnv, app);

  return {
    ...app,
    database,
    security,
    session,
    configurationValid: true
  };
}
