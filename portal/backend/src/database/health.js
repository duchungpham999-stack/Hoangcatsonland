import { loadEnv } from '../config/env.js';
import { closeDatabasePool, getDatabasePool } from './connection.js';

export async function checkDatabase(databaseConfig, dependencies = {}) {
  if (!databaseConfig?.enabled) {
    return { status: 'not_configured' };
  }

  const getPool = dependencies.getPool || getDatabasePool;
  const pool = await getPool(databaseConfig);
  if (!pool) return { status: 'not_configured' };

  const result = await pool.query('select 1 as ready');
  return result?.rows?.[0]?.ready === 1 ? { status: 'ok' } : { status: 'failed' };
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  try {
    const env = loadEnv();
    const result = await checkDatabase(env.database);
    console.log(JSON.stringify({ database: result.status }));
    await closeDatabasePool();
    process.exit(result.status === 'ok' ? 0 : 1);
  } catch {
    console.error('Database check failed.');
    await closeDatabasePool();
    process.exit(1);
  }
}
