import { getDatabasePool } from '../../../database/connection.js';

export async function createSessionRecord(env, session) {
  const pool = await getDatabasePool(env.database);
  const result = await pool.query(`
    insert into sessions (
      user_id, device_id, session_token_hash, idle_expires_at, absolute_expires_at, last_seen_at
    ) values ($1, $2, $3, $4, $5, now())
    returning id, user_id, device_id, idle_expires_at, absolute_expires_at, revoked_at
  `, [
    session.userId,
    session.deviceId || null,
    session.sessionTokenHash,
    session.idleExpiresAt,
    session.absoluteExpiresAt
  ]);
  return result.rows[0];
}

export async function findSessionByTokenHash(env, sessionTokenHash) {
  const pool = await getDatabasePool(env.database);
  const result = await pool.query(`
    select
      s.id,
      s.user_id,
      s.device_id,
      s.idle_expires_at,
      s.absolute_expires_at,
      s.revoked_at,
      u.email,
      u.normalized_email,
      u.username,
      u.display_name,
      u.status
    from sessions s
    join users u on u.id = s.user_id
    where s.session_token_hash = $1
    limit 1
  `, [sessionTokenHash]);
  return result.rows[0] || null;
}

export async function revokeSessionByTokenHash(env, sessionTokenHash) {
  const pool = await getDatabasePool(env.database);
  const result = await pool.query(`
    update sessions
    set revoked_at = now(), updated_at = now()
    where session_token_hash = $1 and revoked_at is null
    returning id
  `, [sessionTokenHash]);
  return result.rowCount > 0;
}
