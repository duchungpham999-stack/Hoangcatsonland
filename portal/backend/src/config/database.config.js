export function createDatabaseConfig(rawEnv, appConfig) {
  const databaseUrl = rawEnv.DATABASE_URL || '';
  const poolMax = Number(rawEnv.DATABASE_POOL_MAX || 10);
  const connectionTimeoutMs = Number(rawEnv.DATABASE_CONNECTION_TIMEOUT_MS || 5000);
  const idleTimeoutMs = Number(rawEnv.DATABASE_IDLE_TIMEOUT_MS || 30000);

  if (appConfig.nodeEnv === 'production' && !databaseUrl) {
    throw new Error('DATABASE_URL is required in production.');
  }

  if (!Number.isInteger(poolMax) || poolMax < 1 || poolMax > 50) {
    throw new Error('DATABASE_POOL_MAX must be an integer from 1 to 50.');
  }

  if (!Number.isInteger(connectionTimeoutMs) || connectionTimeoutMs < 1000 || connectionTimeoutMs > 30000) {
    throw new Error('DATABASE_CONNECTION_TIMEOUT_MS must be an integer from 1000 to 30000.');
  }

  if (!Number.isInteger(idleTimeoutMs) || idleTimeoutMs < 1000 || idleTimeoutMs > 120000) {
    throw new Error('DATABASE_IDLE_TIMEOUT_MS must be an integer from 1000 to 120000.');
  }

  return {
    databaseUrl,
    enabled: Boolean(databaseUrl),
    poolMax,
    connectionTimeoutMs,
    idleTimeoutMs
  };
}
