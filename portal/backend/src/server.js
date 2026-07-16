import { createApp } from './app.js';
import { loadEnv } from './core/config/env.js';

const env = loadEnv();
const app = createApp(env);

app.listen(env.port, () => {
  console.log(`IDS-HRM-GIS portal backend listening on http://localhost:${env.port}`);
});
