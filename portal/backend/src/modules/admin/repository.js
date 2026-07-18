import { getDatabasePool } from '../../database/connection.js';

export async function listUsers(env, filters = {}) {
  const pool = await getDatabasePool(env.database);
  const values = [];
  const where = [];
  const limit = clampNumber(filters.limit, 1, 100, 20);
  const offset = Math.max(Number(filters.offset || 0), 0);

  if (filters.search) {
    values.push(`%${String(filters.search).trim().toLowerCase()}%`);
    where.push(`(
      u.normalized_email like $${values.length}
      or lower(u.username) like $${values.length}
      or lower(coalesce(u.display_name, '')) like $${values.length}
    )`);
  }

  if (filters.status) {
    values.push(filters.status);
    where.push(`u.status = $${values.length}`);
  }

  if (filters.role) {
    values.push(filters.role);
    where.push(`exists (
      select 1
      from user_roles fur
      join roles fr on fr.id = fur.role_id
      where fur.user_id = u.id
        and fur.revoked_at is null
        and fr.revoked_at is null
        and fr.code = $${values.length}
    )`);
  }

  const whereSql = where.length ? `where ${where.join(' and ')}` : '';

  values.push(limit, offset);

  const result = await pool.query(`
    select
      u.id,
      u.email,
      u.normalized_email,
      u.username,
      u.display_name,
      u.status,
      u.employee_code,
      u.department_id,
      u.department_code,
      d.name as department_name,
      u.employment_status,
      u.employment_started_on,
      u.employment_ended_on,
      u.must_change_password,
      u.created_at,
      u.updated_at,
      u.last_login_at,
      coalesce(
        array_agg(distinct r.code)
          filter (where r.code is not null),
        '{}'
      ) as roles
    from users u
    left join user_roles ur
      on ur.user_id = u.id
      and ur.revoked_at is null
    left join roles r
      on r.id = ur.role_id
      and r.revoked_at is null
    left join departments d
      on d.id = u.department_id
    ${whereSql}
    group by
      u.id,
      d.id,
      d.name
    order by u.created_at desc
    limit $${values.length - 1}
    offset $${values.length}
  `, values);

  const countValues = values.slice(0, -2);

  const countResult = await pool.query(
    `select count(*)::int as total
    from users u
    ${whereSql}`,
    countValues
  );

  return {
    users: result.rows.map(toAdminUser),
    total: countResult.rows[0]?.total || 0,
    limit,
    offset
  };
}

export async function findUserById(env, id) {
  const pool = await getDatabasePool(env.database);
  const result = await pool.query(`
    select
      u.id, u.email, u.normalized_email, u.username, u.display_name, u.status,
      u.employee_code, u.department_id, u.department_code, d.name as department_name,
      u.employment_status, u.employment_started_on, u.employment_ended_on,
      u.must_change_password, u.created_at, u.updated_at, u.last_login_at,
      coalesce(array_agg(distinct r.code) filter (where r.code is not null), '{}') as roles
    from users u
    left join user_roles ur on ur.user_id = u.id and ur.revoked_at is null
    left join roles r on r.id = ur.role_id and r.revoked_at is null
    left join departments d on d.id = u.department_id
    where u.id = $1
    group by u.id, d.id, d.name
  `, [id]);
  return result.rows[0] ? toAdminUser(result.rows[0]) : null;
}

export async function findUserByEmailOrUsername(env, email, username) {
  const pool = await getDatabasePool(env.database);
  const result = await pool.query(`
    select id, email, username
    from users
    where normalized_email = lower($1) or lower(username) = lower($2)
    limit 1
  `, [email, username]);
  return result.rows[0] || null;
}

export async function findUserByEmployeeCode(env, employeeCode) {
  if (!employeeCode) return null;
  const pool = await getDatabasePool(env.database);
  const result = await pool.query('select id, employee_code from users where employee_code = $1 limit 1', [employeeCode]);
  return result.rows[0] || null;
}

export async function createUser(env, user) {
  const pool = await getDatabasePool(env.database);
  const client = await pool.connect();
  try {
    await client.query('begin');
    let employeeCode = null;
    let department = null;
    let employmentStartedOn = user.employmentStartedOn || null;

    if (user.accountType === 'employee') {
      const departmentResult = await client.query(
        'select id, code, name, status from departments where id = $1 for update',
        [user.departmentId]
      );
      department = departmentResult.rows[0];
      if (!department) throw new Error('department_not_found');
      if (department.status !== 'active') throw new Error('inactive_department');

      const sequenceResult = await client.query(`
        insert into department_employee_sequences (department_id, last_sequence)
        values ($1, 1)
        on conflict (department_id)
        do update
          set last_sequence = department_employee_sequences.last_sequence + 1,
              updated_at = now()
        returning last_sequence
      `, [department.id]);
      const sequence = sequenceResult.rows[0].last_sequence;
      employeeCode = `HCS_${department.code}${String(sequence).padStart(3, '0')}`;
    }

    const result = await client.query(`
      insert into users (
        email, username, display_name, password_hash, status,
        must_change_password, created_by_user_id, employee_code,
        department_id, department_code, employment_status,
        employment_started_on, employment_ended_on, updated_by_user_id
      )
      values (
        $1, $2, $3, $4, $5, true, $6, $7, $8, $9, $10,
        case when $13 then coalesce($11::date, current_date) else null end,
        $12, $6
      )
      returning id, employment_started_on
    `, [
      user.email,
      user.username,
      user.displayName,
      user.passwordHash,
      user.status || 'active',
      user.createdByUserId || null,
      employeeCode,
      department?.id || null,
      department?.code || null,
      user.employmentStatus || 'active',
      employmentStartedOn,
      user.employmentEndedOn || null,
      user.accountType === 'employee'
    ]);
    if (department && result.rows[0].employment_started_on) {
      await client.query(`
        insert into employee_department_history (
          user_id, from_department_id, to_department_id, effective_from, changed_by_user_id, reason
        )
        values ($1, null, $2, $3::date::timestamptz, $4, 'initial assignment')
      `, [result.rows[0].id, department.id, result.rows[0].employment_started_on, user.createdByUserId]);
    }
    for (const event of user.auditEvents || []) {
      await client.query(`
        insert into audit_logs (
          actor_user_id, action, resource_type, resource_id, result, request_id, ip, metadata
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      `, [
        event.actorUserId || null,
        event.action,
        event.resourceType || 'user',
        event.resourceId || result.rows[0].id,
        event.result || 'success',
        event.requestId || null,
        event.ip || null,
        JSON.stringify({
          ...(event.metadata || {}),
          employeeCode,
          departmentCode: department?.code
        })
      ]);
    }
    await client.query('commit');
    return findUserById(env, result.rows[0].id);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateUser(env, id, user) {
  const pool = await getDatabasePool(env.database);
  await pool.query(`
    update users
    set email = coalesce($2, email),
        username = coalesce($3, username),
        display_name = coalesce($4, display_name),
        department_id = coalesce($5, department_id),
        department_code = coalesce($6, department_code),
        employment_status = coalesce($7, employment_status),
        employment_started_on = coalesce($8::date, employment_started_on),
        employment_ended_on = coalesce($9::date, employment_ended_on),
        updated_by_user_id = coalesce($10, updated_by_user_id),
        updated_at = now()
    where id = $1
  `, [
    id,
    user.email || null,
    user.username || null,
    user.displayName || null,
    user.departmentId || null,
    user.departmentCode || null,
    user.employmentStatus || null,
    user.employmentStartedOn || null,
    user.employmentEndedOn || null,
    user.updatedByUserId || null
  ]);
  return findUserById(env, id);
}

export async function updateUserStatus(env, id, status) {
  const pool = await getDatabasePool(env.database);
  await pool.query('update users set status = $2, updated_at = now() where id = $1', [id, status]);
  return findUserById(env, id);
}

export async function setUserRoles(env, userId, roleCodes) {
  const pool = await getDatabasePool(env.database);
  const roles = await listRolesByCodes(env, roleCodes);
  await pool.query('update user_roles set revoked_at = now(), updated_at = now() where user_id = $1 and revoked_at is null', [userId]);
  for (const role of roles) {
    await pool.query(`
      insert into user_roles (user_id, role_id)
      values ($1, $2)
      on conflict (user_id, role_id) do update set revoked_at = null, updated_at = now()
    `, [userId, role.id]);
  }
  return findUserById(env, userId);
}

export async function updateUserPassword(env, userId, passwordHash, mustChangePassword = true) {
  const pool = await getDatabasePool(env.database);
  await pool.query(`
    update users
    set password_hash = $2,
        must_change_password = $3,
        password_changed_at = case when $3 then password_changed_at else now() end,
        updated_at = now()
    where id = $1
  `, [userId, passwordHash, mustChangePassword]);
  return findUserById(env, userId);
}

export async function revokeSessionsByUserId(env, userId) {
  const pool = await getDatabasePool(env.database);
  const result = await pool.query(`
    update sessions set revoked_at = now(), updated_at = now()
    where user_id = $1 and revoked_at is null
    returning id
  `, [userId]);
  return result.rowCount;
}

export async function closeActiveDepartmentHistory(env, userId, effectiveTo) {
  const pool = await getDatabasePool(env.database);
  const result = await pool.query(`
    update employee_department_history
    set effective_to = $2
    where user_id = $1 and effective_to is null
    returning id
  `, [userId, effectiveTo || new Date()]);
  return result.rowCount;
}

export async function countActiveSystemAdmins(env) {
  const pool = await getDatabasePool(env.database);
  const result = await pool.query(`
    select count(distinct u.id)::int as total
    from users u
    join user_roles ur on ur.user_id = u.id and ur.revoked_at is null
    join roles r on r.id = ur.role_id and r.revoked_at is null
    where r.code = 'system_admin' and u.status = 'active'
  `);
  return result.rows[0]?.total || 0;
}

export async function listRoles(env) {
  const pool = await getDatabasePool(env.database);
  const result = await pool.query(`
    select
      r.id, r.code, r.name, r.description,
      count(distinct ur.user_id)::int as user_count,
      coalesce(array_agg(distinct p.code) filter (where p.code is not null), '{}') as permissions
    from roles r
    left join user_roles ur on ur.role_id = r.id and ur.revoked_at is null
    left join role_permissions rp on rp.role_id = r.id and rp.revoked_at is null
    left join permissions p on p.id = rp.permission_id and p.revoked_at is null
    where r.revoked_at is null
    group by r.id
    order by r.code asc
  `);
  return result.rows.map(toRole);
}

export async function listPermissions(env) {
  const pool = await getDatabasePool(env.database);

  const result = await pool.query(`
    select
      id,
      code,
      description,
      created_at as "createdAt",
      updated_at as "updatedAt"
    from permissions
    where revoked_at is null
    order by code asc
  `);

  return result.rows;
}

export async function createRole(env, role) {
  const pool = await getDatabasePool(env.database);
  const result = await pool.query(`
    insert into roles (code, name, description)
    values ($1, $2, $3)
    returning id
  `, [role.code, role.name, role.description || null]);
  return findRoleById(env, result.rows[0].id);
}

export async function updateRole(env, id, role) {
  const pool = await getDatabasePool(env.database);
  await pool.query(`
    update roles
    set name = coalesce($2, name),
        description = coalesce($3, description),
        updated_at = now()
    where id = $1
  `, [id, role.name || null, role.description ?? null]);
  return findRoleById(env, id);
}

export async function setRolePermissions(env, roleId, permissionCodes) {
  const pool = await getDatabasePool(env.database);
  const permissions = await listPermissionsByCodes(env, permissionCodes);
  await pool.query('update role_permissions set revoked_at = now(), updated_at = now() where role_id = $1 and revoked_at is null', [roleId]);
  for (const permission of permissions) {
    await pool.query(`
      insert into role_permissions (role_id, permission_id)
      values ($1, $2)
      on conflict (role_id, permission_id) do update set revoked_at = null, updated_at = now()
    `, [roleId, permission.id]);
  }
  return findRoleById(env, roleId);
}

export async function findRoleById(env, id) {
  const roles = await listRoles(env);
  return roles.find(role => role.id === id) || null;
}

export async function listRolesByCodes(env, codes) {
  if (!codes?.length) return [];
  const pool = await getDatabasePool(env.database);
  const result = await pool.query('select id, code from roles where code = any($1) and revoked_at is null', [codes]);
  return result.rows;
}

export async function listPermissionsByCodes(env, codes) {
  if (!codes?.length) return [];
  const pool = await getDatabasePool(env.database);
  const result = await pool.query('select id, code from permissions where code = any($1) and revoked_at is null', [codes]);
  return result.rows;
}

export async function listDepartments(env) {
  const pool = await getDatabasePool(env.database);
  const result = await pool.query(`
    select
      d.id, d.code, d.name, d.description, d.status, d.created_at, d.updated_at,
      count(u.id) filter (where u.status = 'active' and u.employment_status in ('active', 'probation'))::int as active_employee_count
    from departments d
    left join users u on u.department_id = d.id
    group by d.id
    order by d.code asc
  `);
  return result.rows.map(toDepartment);
}

export async function findDepartmentById(env, id) {
  const pool = await getDatabasePool(env.database);
  const result = await pool.query(`
    select
      d.id, d.code, d.name, d.description, d.status, d.created_at, d.updated_at,
      count(u.id) filter (where u.status = 'active' and u.employment_status in ('active', 'probation'))::int as active_employee_count
    from departments d
    left join users u on u.department_id = d.id
    where d.id = $1
    group by d.id
  `, [id]);
  return result.rows[0] ? toDepartment(result.rows[0]) : null;
}

export async function findDepartmentByCode(env, code) {
  const pool = await getDatabasePool(env.database);
  const result = await pool.query('select id, code, name, description, status from departments where code = $1 limit 1', [code]);
  return result.rows[0] ? toDepartment(result.rows[0]) : null;
}

export async function createDepartment(env, department) {
  const pool = await getDatabasePool(env.database);
  const result = await pool.query(`
    insert into departments (code, name, description, status, created_by_user_id, updated_by_user_id)
    values ($1, $2, $3, $4, $5, $5)
    returning id
  `, [
    department.code,
    department.name,
    department.description || null,
    department.status || 'active',
    department.actorUserId || null
  ]);
  return findDepartmentById(env, result.rows[0].id);
}

export async function updateDepartment(env, id, department) {
  const pool = await getDatabasePool(env.database);
  await pool.query(`
    update departments
    set name = coalesce($2, name),
        description = coalesce($3, description),
        status = coalesce($4, status),
        updated_by_user_id = coalesce($5, updated_by_user_id),
        updated_at = now()
    where id = $1
  `, [id, department.name || null, department.description ?? null, department.status || null, department.actorUserId || null]);
  return findDepartmentById(env, id);
}

export async function countActiveUsersInDepartment(env, departmentId) {
  const pool = await getDatabasePool(env.database);
  const result = await pool.query(`
    select count(*)::int as total
    from users
    where department_id = $1 and status = 'active' and employment_status in ('active', 'probation')
  `, [departmentId]);
  return result.rows[0]?.total || 0;
}

export async function getDepartmentHistory(env, userId) {
  const pool = await getDatabasePool(env.database);
  const result = await pool.query(`
    select
      h.id,
      h.effective_from,
      h.effective_to,
      h.reason,
      h.decision_number,
      h.notes,
      h.created_at,
      fd.code as from_department_code,
      fd.name as from_department_name,
      td.code as to_department_code,
      td.name as to_department_name,
      actor.email as changed_by_email,
      actor.username as changed_by_username
    from employee_department_history h
    left join departments fd on fd.id = h.from_department_id
    join departments td on td.id = h.to_department_id
    join users actor on actor.id = h.changed_by_user_id
    where h.user_id = $1
    order by h.effective_from desc, h.created_at desc
  `, [userId]);
  return result.rows.map(toDepartmentHistory);
}

export async function transferUserDepartment(env, userId, transfer) {
  const pool = await getDatabasePool(env.database);
  const client = await pool.connect();
  try {
    await client.query('begin');
    const userResult = await client.query(`
      select id, employee_code, department_id, department_code, employment_started_on
      from users
      where id = $1
      for update
    `, [userId]);
    const user = userResult.rows[0];
    if (!user) throw new Error('user_not_found');

    const departmentResult = await client.query('select id, code, name, status from departments where id = $1 for update', [transfer.toDepartmentId]);
    const department = departmentResult.rows[0];
    if (!department) throw new Error('department_not_found');
    if (department.status !== 'active') throw new Error('inactive_department');
    if (user.department_id === department.id) throw new Error('same_department');
    if (user.employment_started_on && new Date(transfer.effectiveFrom) < new Date(user.employment_started_on)) {
      throw new Error('invalid_effective_from');
    }

    const currentHistory = await client.query(`
      select id, to_department_id, effective_from
      from employee_department_history
      where user_id = $1 and effective_to is null
      for update
    `, [userId]);
    if (currentHistory.rows[0] && new Date(transfer.effectiveFrom) < new Date(currentHistory.rows[0].effective_from)) {
      throw new Error('invalid_effective_from');
    }
    if (currentHistory.rows[0]) {
      await client.query('update employee_department_history set effective_to = $2 where id = $1', [currentHistory.rows[0].id, transfer.effectiveFrom]);
    }
    await client.query(`
      insert into employee_department_history (
        user_id, from_department_id, to_department_id, effective_from,
        reason, decision_number, notes, changed_by_user_id
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      userId,
      user.department_id || null,
      department.id,
      transfer.effectiveFrom,
      transfer.reason || null,
      transfer.decisionNumber || null,
      transfer.notes || null,
      transfer.changedByUserId
    ]);
    await client.query(`
      update users
      set department_id = $2,
          department_code = $3,
          updated_by_user_id = $4,
          updated_at = now()
      where id = $1
    `, [userId, department.id, department.code, transfer.changedByUserId]);
    await client.query('commit');
    return {
      user: await findUserById(env, userId),
      fromDepartmentCode: user.department_code,
      toDepartmentCode: department.code,
      employeeCode: user.employee_code
    };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

function toAdminUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.display_name,
    status: user.status,
    employeeCode: user.employee_code,
    departmentId: user.department_id,
    departmentCode: user.department_code,
    departmentName: user.department_name,
    employmentStatus: user.employment_status,
    employmentStartedAt: toDateString(user.employment_started_on),
    employmentEndedAt: toDateString(user.employment_ended_on),
    mustChangePassword: Boolean(user.must_change_password),
    roles: user.roles || [],
    createdAt: toIsoString(user.created_at),
    updatedAt: toIsoString(user.updated_at),
    lastLoginAt: toIsoString(user.last_login_at)
  };
}

function toDepartment(department) {
  return {
    id: department.id,
    code: department.code,
    name: department.name,
    description: department.description,
    status: department.status,
    activeEmployeeCount: department.active_employee_count || 0,
    createdAt: toIsoString(department.created_at),
    updatedAt: toIsoString(department.updated_at)
  };
}

function toDepartmentHistory(history) {
  return {
    id: history.id,
    fromDepartmentCode: history.from_department_code,
    fromDepartmentName: history.from_department_name,
    toDepartmentCode: history.to_department_code,
    toDepartmentName: history.to_department_name,
    effectiveFrom: toIsoString(history.effective_from),
    effectiveTo: toIsoString(history.effective_to),
    reason: history.reason,
    decisionNumber: history.decision_number,
    notes: history.notes,
    changedBy: {
      email: history.changed_by_email,
      username: history.changed_by_username
    },
    createdAt: toIsoString(history.created_at)
  };
}

function toRole(role) {
  return {
    id: role.id,
    code: role.code,
    name: role.name,
    description: role.description,
    userCount: role.user_count || 0,
    permissions: role.permissions || []
  };
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function toIsoString(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function toDateString(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
}
