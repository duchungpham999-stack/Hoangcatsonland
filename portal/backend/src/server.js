import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { closeDatabasePool } from './database/connection.js';

const env = loadEnv();
const app = createApp(env);

app.listen(env.port, env.host, () => {
  console.log(`IDS-HRM-GIS portal backend listening on ${env.host}:${env.port}`);
});

async function shutdown() {
  await closeDatabasePool();
  app.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
