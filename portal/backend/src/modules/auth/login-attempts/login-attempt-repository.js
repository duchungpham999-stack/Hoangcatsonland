import { getDatabasePool } from '../../../database/connection.js';

export async function recordLoginAttempt(env, attempt) {
  const pool = await getDatabasePool(env.database);
  await pool.query(`
    insert into login_attempts (
      user_id, normalized_email, result, ip, request_id, failure_reason
    ) values ($1, $2, $3, $4, $5, $6)
  `, [
    attempt.userId || null,
    String(attempt.identifier || '').trim().toLowerCase(),
    attempt.success ? 'success' : 'failure',
    attempt.ip || null,
    attempt.requestId || null,
    attempt.failureReason || null
  ]);
}

export async function countRecentFailures(env, identifier, windowMs) {
  const pool = await getDatabasePool(env.database);
  const result = await pool.query(`
    select count(*)::int as count
    from login_attempts
    where normalized_email = $1
      and result = 'failure'
      and created_at >= now() - ($2 || ' milliseconds')::interval
  `, [String(identifier || '').trim().toLowerCase(), windowMs]);
  return result.rows[0]?.count || 0;
}
