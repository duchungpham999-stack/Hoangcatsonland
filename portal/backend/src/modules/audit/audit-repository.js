import { getDatabasePool } from '../../database/connection.js';

export async function insertAuditLog(env, event) {
  const pool = await getDatabasePool(env.database);
  await pool.query(`
    insert into audit_logs (
      actor_user_id, action, resource_type, resource_id, result, request_id, ip, metadata
    ) values ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [
    event.actorUserId || null,
    event.action,
    event.resourceType || null,
    event.resourceId || null,
    event.result,
    event.requestId || null,
    event.ip || null,
    JSON.stringify(event.metadata || {})
  ]);
}
