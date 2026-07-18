export async function findUsers() {
  return [];
}

export async function findUserByEmailOrUsername(env, identifier) {
  const { getDatabasePool } = await import('../../database/connection.js');
  const pool = await getDatabasePool(env.database);
  const normalized = normalizeIdentifier(identifier);
  const result = await pool.query(`
    select id, email, normalized_email, username, display_name, password_hash, status, must_change_password
    from users
    where normalized_email = $1 or lower(username) = $1
    limit 1
  `, [normalized]);
  return result.rows[0] || null;
}

export async function findPublicUserById(env, userId) {
  const { getDatabasePool } = await import('../../database/connection.js');
  const pool = await getDatabasePool(env.database);
  const result = await pool.query(`
    select id, email, normalized_email, username, display_name, status, must_change_password
    from users
    where id = $1
    limit 1
  `, [userId]);
  return result.rows[0] || null;
}

export async function createUser(env, user) {
  const { getDatabasePool } = await import('../../database/connection.js');
  const pool = await getDatabasePool(env.database);
  const result = await pool.query(`
    insert into users (email, username, display_name, password_hash, status)
    values ($1, $2, $3, $4, $5)
    returning id, email, normalized_email, username, display_name, status, created_at, updated_at
  `, [user.email, user.username, user.displayName || user.username, user.passwordHash, user.status || 'active']);
  return result.rows[0];
}

export async function updateLastLoginAt(env, userId) {
  const { getDatabasePool } = await import('../../database/connection.js');
  const pool = await getDatabasePool(env.database);
  await pool.query('update users set last_login_at = now(), updated_at = now() where id = $1', [userId]);
}

export async function updateUserPassword(env, userId, passwordHash, mustChangePassword) {
  const { getDatabasePool } = await import('../../database/connection.js');
  const pool = await getDatabasePool(env.database);
  const result = await pool.query(`
    update users
    set password_hash = $2,
        must_change_password = $3,
        password_changed_at = case when $3 then password_changed_at else now() end,
        updated_at = now()
    where id = $1
    returning id, email, normalized_email, username, display_name, status, must_change_password
  `, [userId, passwordHash, mustChangePassword]);
  return result.rows[0] || null;
}

export async function getUserRolesAndPermissions(env, userId) {
  const { getDatabasePool } = await import('../../database/connection.js');
  const pool = await getDatabasePool(env.database);
  const result = await pool.query(`
    select
      coalesce(array_agg(distinct r.code) filter (where r.code is not null), '{}') as roles,
      coalesce(array_agg(distinct p.code) filter (where p.code is not null), '{}') as permissions
    from users u
    left join user_roles ur on ur.user_id = u.id and ur.revoked_at is null
    left join roles r on r.id = ur.role_id and r.revoked_at is null
    left join role_permissions rp on rp.role_id = r.id and rp.revoked_at is null
    left join permissions p on p.id = rp.permission_id and p.revoked_at is null
    where u.id = $1
    group by u.id
  `, [userId]);
  return result.rows[0] || { roles: [], permissions: [] };
}

export async function ensureRole(env, code, name) {
  const { getDatabasePool } = await import('../../database/connection.js');
  const pool = await getDatabasePool(env.database);
  const existing = await pool.query('select id, code from roles where lower(code) = lower($1) limit 1', [code]);
  if (existing.rows[0]) return existing.rows[0];

  const result = await pool.query(`
    insert into roles (code, name)
    values ($1, $2)
    returning id, code
  `, [code, name]);
  return result.rows[0];
}

export async function assignRole(env, userId, roleId) {
  const { getDatabasePool } = await import('../../database/connection.js');
  const pool = await getDatabasePool(env.database);
  await pool.query(`
    insert into user_roles (user_id, role_id)
    values ($1, $2)
    on conflict (user_id, role_id) do update set revoked_at = null
  `, [userId, roleId]);
}

export function toPublicUser(user, access = {}) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.display_name,
    status: user.status,
    mustChangePassword: Boolean(user.must_change_password),
    roles: access.roles || user.roles || [],
    permissions: access.permissions || user.permissions || []
  };
}

function normalizeIdentifier(identifier) {
  return String(identifier || '').trim().toLowerCase();
}
