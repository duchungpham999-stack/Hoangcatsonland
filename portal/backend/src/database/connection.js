let pool;

export async function createDatabasePool(databaseConfig) {
  if (!databaseConfig?.enabled) return null;

  const { Pool } = await import('pg');
  return new Pool({
    connectionString: databaseConfig.databaseUrl,
    max: databaseConfig.poolMax,
    connectionTimeoutMillis: databaseConfig.connectionTimeoutMs,
    idleTimeoutMillis: databaseConfig.idleTimeoutMs
  });
}

export async function getDatabasePool(databaseConfig) {
  if (!pool) pool = await createDatabasePool(databaseConfig);
  return pool;
}

export async function closeDatabasePool() {
  if (!pool) return;
  await pool.end();
  pool = null;
}

export function redactDatabaseUrl(databaseUrl) {
  if (!databaseUrl) return '';

  try {
    const url = new URL(databaseUrl);
    if (url.password) url.password = '***';
    if (url.username) url.username = '***';
    return url.toString();
  } catch {
    return '[invalid-database-url]';
  }
}
