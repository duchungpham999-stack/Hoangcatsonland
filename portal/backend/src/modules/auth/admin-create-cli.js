import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { loadEnv } from '../../config/env.js';
import { closeDatabasePool } from '../../database/connection.js';
import { writeAuditEvent } from '../audit/audit-service.js';
import { hashPassword } from './password/password-service.js';
import { createUserWithRole } from '../users/service.js';

async function main() {
  const env = loadEnv();
  if (!env.database.enabled) throw new Error('DATABASE_URL is required to create an admin user.');

  const answers = await getAdminInput(env.adminBootstrap);
  const passwordHash = await hashPassword(answers.password);
  const result = await createUserWithRole(env, {
    email: answers.email,
    username: answers.username,
    passwordHash,
    status: 'active'
  }, {
    code: 'system_admin',
    name: 'System Administrator'
  });

  if (!result.created) {
    console.log(`User already exists: ${result.user.email}`);
    return;
  }

  await writeAuditEvent(env, {
    actorUserId: result.user.id,
    action: 'admin_create',
    resourceType: 'user',
    resourceId: result.user.id,
    result: 'success',
    metadata: { role: 'system_admin' }
  });

  console.log(`Admin user created: ${result.user.email}`);
}

async function getAdminInput(fromEnv) {
  if (fromEnv.email && fromEnv.username && fromEnv.password) return fromEnv;

  const rl = createInterface({ input, output });
  try {
    return {
      email: fromEnv.email || await rl.question('Admin email: '),
      username: fromEnv.username || await rl.question('Admin username: '),
      password: fromEnv.password || await rl.question('Admin password: ')
    };
  } finally {
    rl.close();
  }
}

main()
  .catch(async error => {
    console.error(error.message);
    await closeDatabasePool();
    process.exit(1);
  })
  .finally(async () => {
    await closeDatabasePool();
  });
