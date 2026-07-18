import { hashPassword } from '../auth/password/password-service.js';
import { writeAuditEvent } from '../audit/audit-service.js';
import * as dbRepository from './repository.js';

const validStatuses = new Set(['active', 'disabled', 'locked', 'pending']);
const validEmploymentStatuses = new Set(['active', 'probation', 'suspended', 'terminated', 'retired']);
const protectedAdminPermissions = new Set(['users.manage', 'roles.manage', 'departments.manage']);
const departmentCodePattern = /^[A-Z0-9_]{2,10}$/;

export async function listAdminUsers(req, filters) {
  return repository(req).listUsers(req.app.env, filters);
}

export async function getAdminUser(req, id) {
  const user = await repository(req).findUserById(req.app.env, id);
  if (!user) throw safeError(404, 'not_found');
  return { user, departmentHistory: await repository(req).getDepartmentHistory(req.app.env, id) };
}

export async function createAdminUser(req, input) {
  validateUserInput(input, true);
  await validateAccountInput(req, input);
  await assertUniqueUser(req, input.email, input.username);
  const passwordHash = await hashPassword(input.password);
  const user = await repository(req).createUser(req.app.env, {
    accountType: input.accountType || 'technical',
    email: input.email,
    username: input.username,
    displayName: input.displayName || input.username,
    passwordHash,
    status: input.status || 'active',
    createdByUserId: req.user.id,
    departmentId: input.departmentId,
    employmentStatus: input.employmentStatus || 'active',
    employmentStartedOn: input.employmentStartedAt,
    employmentEndedOn: input.employmentEndedAt,
    auditEvents: buildUserCreateAuditEvents(req, input)
  });
  if (input.roles?.length) await repository(req).setUserRoles(req.app.env, user.id, uniqueStrings(input.roles));
  const created = await repository(req).findUserById(req.app.env, user.id);
  return { user: created || user };
}

export async function updateAdminUser(req, id, input) {
  if (input.email || input.username) await assertUniqueUser(req, input.email, input.username, id);
  const existing = await repository(req).findUserById(req.app.env, id);
  if (!existing) throw safeError(404, 'not_found');
  if (input.employeeCode && existing.employeeCode && input.employeeCode !== existing.employeeCode) {
    await audit(req, 'employee_code_change_rejected', 'user', id, 'failure', { employeeCode: existing.employeeCode });
    throw safeError(409, 'employee_code_immutable');
  }
  if (input.employeeCode) throw safeError(422, 'client_employee_code_not_allowed');
  await validateEmployeeInput(req, input, false);
  validateEmploymentDateRange({
    employmentStartedAt: input.employmentStartedAt || existing.employmentStartedAt,
    employmentEndedAt: input.employmentEndedAt || existing.employmentEndedAt
  });
  input.updatedByUserId = req.user.id;
  const user = await repository(req).updateUser(req.app.env, id, input);
  if (!user) throw safeError(404, 'not_found');
  await audit(req, 'user_update', 'user', id, 'success');
  if (input.employmentStatus && input.employmentStatus !== existing.employmentStatus) {
    let revokedSessions = 0;
    let closedHistory = 0;
    if (['terminated', 'retired'].includes(input.employmentStatus)) {
      revokedSessions = await repository(req).revokeSessionsByUserId(req.app.env, id);
      closedHistory = await repository(req).closeActiveDepartmentHistory(req.app.env, id, input.employmentEndedAt || currentDateString());
    }
    await audit(req, 'employment_status_change', 'user', id, 'success', {
      employmentStatus: input.employmentStatus,
      revokedSessions,
      closedHistory
    });
  }
  return { user };
}

export async function changeAdminUserStatus(req, id, status) {
  if (!validStatuses.has(status)) throw safeError(400, 'invalid_status');
  const user = await repository(req).findUserById(req.app.env, id);
  if (!user) throw safeError(404, 'not_found');
  if (id === req.user.id && ['disabled', 'locked'].includes(status)) throw safeError(400, 'cannot_lock_self');
  if (user.roles.includes('system_admin') && user.status === 'active' && status !== 'active') {
    await assertNotLastActiveSystemAdmin(req);
  }

  const updated = await repository(req).updateUserStatus(req.app.env, id, status);
  let revokedSessions = 0;
  if (['disabled', 'locked'].includes(status)) {
    revokedSessions = await repository(req).revokeSessionsByUserId(req.app.env, id);
  }
  await audit(req, 'user_status_change', 'user', id, 'success', { status, revokedSessions });
  return { user: updated, revokedSessions };
}

export async function changeAdminUserRoles(req, id, roles) {
  const user = await repository(req).findUserById(req.app.env, id);
  if (!user) throw safeError(404, 'not_found');
  const nextRoles = uniqueStrings(roles || []);
  const existingRoles = await repository(req).listRolesByCodes(req.app.env, nextRoles);
  if (existingRoles.length !== nextRoles.length) throw safeError(400, 'invalid_role');
  if (user.roles.includes('system_admin') && !nextRoles.includes('system_admin')) {
    await assertNotLastActiveSystemAdmin(req);
  }

  const updated = await repository(req).setUserRoles(req.app.env, id, nextRoles);
  await audit(req, 'user_roles_change', 'user', id, 'success', { roles: nextRoles });
  return { user: updated };
}

export async function resetAdminUserPassword(req, id, password) {
  if (!password || String(password).length < 12) throw safeError(400, 'invalid_password');
  const user = await repository(req).findUserById(req.app.env, id);
  if (!user) throw safeError(404, 'not_found');
  const passwordHash = await hashPassword(password);
  const updated = await repository(req).updateUserPassword(req.app.env, id, passwordHash, true);
  const revokedSessions = await repository(req).revokeSessionsByUserId(req.app.env, id);
  await audit(req, 'password_reset_by_admin', 'user', id, 'success', { revokedSessions });
  return { user: updated, revokedSessions };
}

export async function revokeAdminUserSessions(req, id) {
  const user = await repository(req).findUserById(req.app.env, id);
  if (!user) throw safeError(404, 'not_found');
  const revokedSessions = await repository(req).revokeSessionsByUserId(req.app.env, id);
  await audit(req, 'sessions_revoked', 'user', id, 'success', { revokedSessions });
  return { revokedSessions };
}

export async function listAdminDepartments(req) {
  return { departments: await repository(req).listDepartments(req.app.env) };
}

export async function getAdminDepartment(req, id) {
  const department = await repository(req).findDepartmentById(req.app.env, id);
  if (!department) throw safeError(404, 'not_found');
  return { department };
}

export async function createAdminDepartment(req, input) {
  validateDepartmentInput(input, true);
  const existing = await repository(req).findDepartmentByCode(req.app.env, input.code);
  if (existing) throw safeError(409, 'department_already_exists');
  const department = await repository(req).createDepartment(req.app.env, { ...input, actorUserId: req.user.id });
  await audit(req, 'department_create', 'department', department.id, 'success', { code: department.code });
  return { department };
}

export async function updateAdminDepartment(req, id, input) {
  const department = await repository(req).findDepartmentById(req.app.env, id);
  if (!department) throw safeError(404, 'not_found');
  if (input.code && input.code !== department.code && department.activeEmployeeCount > 0) {
    throw safeError(409, 'department_code_in_use');
  }
  if (input.status === 'inactive' && department.activeEmployeeCount > 0) {
    throw safeError(409, 'department_has_active_employees');
  }
  validateDepartmentInput({ ...department, ...input }, false);
  const updated = await repository(req).updateDepartment(req.app.env, id, { ...input, actorUserId: req.user.id });
  await audit(req, input.status && input.status !== department.status ? 'department_status_change' : 'department_update', 'department', id, 'success', {
    code: department.code,
    status: input.status
  });
  return { department: updated };
}

export async function transferAdminUserDepartment(req, id, input) {
  const user = await repository(req).findUserById(req.app.env, id);
  if (!user) throw safeError(404, 'not_found');
  const department = await repository(req).findDepartmentById(req.app.env, input.toDepartmentId);
  if (!department) throw safeError(404, 'department_not_found');
  if (department.status !== 'active') throw safeError(409, 'inactive_department');
  if (user.departmentId === department.id) throw safeError(409, 'same_department');
  if (!input.effectiveFrom) throw safeError(400, 'effective_from_required');
  input.effectiveFrom = parseDateOnly(input.effectiveFrom, 'invalid_effective_from');
  if (user.employmentStartedAt && new Date(input.effectiveFrom) < new Date(user.employmentStartedAt)) {
    throw safeError(422, 'invalid_effective_from');
  }
  try {
    const result = await repository(req).transferUserDepartment(req.app.env, id, {
      toDepartmentId: input.toDepartmentId,
      effectiveFrom: input.effectiveFrom,
      reason: input.reason,
      decisionNumber: input.decisionNumber,
      notes: input.notes,
      changedByUserId: req.user.id
    });
    await audit(req, 'employee_department_transfer', 'user', id, 'success', {
      userId: id,
      employeeCode: result.employeeCode,
      fromDepartmentCode: result.fromDepartmentCode,
      toDepartmentCode: result.toDepartmentCode,
      effectiveFrom: input.effectiveFrom,
      decisionNumber: input.decisionNumber
    });
    return result;
  } catch (error) {
    if (['department_not_found', 'inactive_department', 'same_department', 'invalid_effective_from', 'user_not_found'].includes(error.message)) {
      throw safeError(error.message === 'invalid_effective_from' ? 422 : 409, error.message);
    }
    throw error;
  }
}

export async function getAdminUserDepartmentHistory(req, id) {
  const user = await repository(req).findUserById(req.app.env, id);
  if (!user) throw safeError(404, 'not_found');
  return { history: await repository(req).getDepartmentHistory(req.app.env, id) };
}

export async function listAdminRoles(req) {
  return { roles: await repository(req).listRoles(req.app.env) };
}

export async function listAdminPermissions(req) {
  return { permissions: await repository(req).listPermissions(req.app.env) };
}

export async function createAdminRole(req, input) {
  validateRoleCode(input.code);
  const existing = await repository(req).listRoles(req.app.env);
  if (existing.some(role => role.code === input.code)) throw safeError(409, 'role_already_exists');
  const role = await repository(req).createRole(req.app.env, input);
  await audit(req, 'role_create', 'role', role.id, 'success', { code: role.code });
  return { role };
}

export async function updateAdminRole(req, id, input) {
  const role = await repository(req).findRoleById(req.app.env, id);
  if (!role) throw safeError(404, 'not_found');
  if (role.code === 'system_admin' && input.code && input.code !== 'system_admin') throw safeError(400, 'protected_role');
  const updated = await repository(req).updateRole(req.app.env, id, input);
  await audit(req, 'role_update', 'role', id, 'success');
  return { role: updated };
}

export async function changeAdminRolePermissions(req, id, permissions) {
  const role = await repository(req).findRoleById(req.app.env, id);
  if (!role) throw safeError(404, 'not_found');
  const nextPermissions = uniqueStrings(permissions || []);
  const existingPermissions = await repository(req).listPermissionsByCodes(req.app.env, nextPermissions);
  if (existingPermissions.length !== nextPermissions.length) throw safeError(400, 'invalid_permission');
  if (role.code === 'system_admin') {
    for (const permission of protectedAdminPermissions) {
      if (!nextPermissions.includes(permission)) throw safeError(400, 'protected_role_permissions');
    }
  }
  const updated = await repository(req).setRolePermissions(req.app.env, id, nextPermissions);
  await audit(req, 'role_permissions_change', 'role', id, 'success', { permissions: nextPermissions });
  return { role: updated };
}

async function assertUniqueUser(req, email, username, allowedUserId) {
  const existing = await repository(req).findUserByEmailOrUsername(req.app.env, email || '', username || '');
  if (existing && existing.id !== allowedUserId) throw safeError(409, 'user_already_exists');
}

async function assertNotLastActiveSystemAdmin(req) {
  const total = await repository(req).countActiveSystemAdmins(req.app.env);
  if (total <= 1) throw safeError(400, 'last_active_system_admin');
}

function validateUserInput(input, requirePassword) {
  if (!input.email || !input.username || !input.displayName) throw safeError(400, 'validation_failed');
  if (requirePassword && (!input.password || input.password.length < 12)) throw safeError(400, 'invalid_password');
  if (input.status && !validStatuses.has(input.status)) throw safeError(400, 'invalid_status');
  if (input.employmentStatus && !validEmploymentStatuses.has(input.employmentStatus)) throw safeError(400, 'invalid_employment_status');
}

function validateRoleCode(code) {
  if (!/^[a-z][a-z0-9._]{1,62}$/.test(String(code || ''))) throw safeError(400, 'invalid_role_code');
}

function uniqueStrings(values) {
  return [...new Set((values || []).map(value => String(value).trim()).filter(Boolean))];
}

async function validateAccountInput(req, input) {
  const accountType = input.accountType || 'technical';
  if (!['employee', 'technical'].includes(accountType)) throw safeError(400, 'invalid_account_type');
  if (input.employeeCode) throw safeError(422, 'client_employee_code_not_allowed');
  if (accountType === 'technical') {
    if (input.departmentId || input.departmentCode) throw safeError(422, 'technical_account_department_not_allowed');
    input.employeeCode = undefined;
    input.departmentId = undefined;
    input.departmentCode = undefined;
    input.employmentStartedAt = undefined;
    input.employmentEndedAt = undefined;
    return;
  }
  if (!input.departmentId) throw safeError(400, 'department_required');
  if (input.employmentStartedAt) input.employmentStartedAt = parseDateOnly(input.employmentStartedAt, 'invalid_employment_started_at');
  if (input.employmentEndedAt) input.employmentEndedAt = parseDateOnly(input.employmentEndedAt, 'invalid_employment_ended_at');
  validateEmploymentDateRange(input);
  input.employmentStartedOn = input.employmentStartedAt;
  input.employmentEndedOn = input.employmentEndedAt;
  const department = await repository(req).findDepartmentById(req.app.env, input.departmentId);
  if (!department || department.status !== 'active') throw safeError(422, 'invalid_department');
  input.departmentCode = department.code;
}

async function validateEmployeeInput(req, input, requireCompleteEmployee) {
  const touchesEmployee = Boolean(input.employeeCode || input.departmentId || input.departmentCode || input.employmentStartedAt || input.employmentStatus || input.employmentEndedAt);
  if (!touchesEmployee && !requireCompleteEmployee) return;
  if (requireCompleteEmployee && touchesEmployee && (!input.employeeCode || !input.departmentId || !input.employmentStartedAt)) {
    throw safeError(400, 'employee_fields_required');
  }
  if (input.employeeCode) throw safeError(422, 'client_employee_code_not_allowed');
  if (input.employmentStartedAt) input.employmentStartedAt = parseDateOnly(input.employmentStartedAt, 'invalid_employment_started_at');
  if (input.employmentEndedAt) input.employmentEndedAt = parseDateOnly(input.employmentEndedAt, 'invalid_employment_ended_at');
  validateEmploymentDateRange(input);
  input.employmentStartedOn = input.employmentStartedAt;
  input.employmentEndedOn = input.employmentEndedAt;
  if (input.departmentCode && !departmentCodePattern.test(input.departmentCode)) throw safeError(422, 'invalid_department_code');
  if (input.departmentId) {
    const department = await repository(req).findDepartmentById(req.app.env, input.departmentId);
    if (!department || department.status !== 'active') throw safeError(422, 'invalid_department');
    input.departmentCode = department.code;
  }
}

function validateDepartmentInput(input, requireCode) {
  if (requireCode && !input.code) throw safeError(400, 'department_code_required');
  if (input.code && !departmentCodePattern.test(input.code)) throw safeError(422, 'invalid_department_code');
  if (!input.name) throw safeError(400, 'department_name_required');
  if (input.status && !['active', 'inactive'].includes(input.status)) throw safeError(400, 'invalid_department_status');
}

function parseDateOnly(value, error) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) throw safeError(422, error);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw safeError(422, error);
  return value;
}

function validateEmploymentDateRange(input) {
  if (input.employmentStartedAt && input.employmentEndedAt && input.employmentEndedAt < input.employmentStartedAt) {
    throw safeError(422, 'invalid_employment_date_range');
  }
}

function currentDateString() {
  return new Date().toISOString().slice(0, 10);
}

function buildUserCreateAuditEvents(req, input) {
  const base = {
    actorUserId: req.user?.id,
    resourceType: 'user',
    result: 'success',
    requestId: req.requestId,
    ip: req.socket.remoteAddress
  };
  const events = [{
    ...base,
    action: 'user_create',
    metadata: { roles: input.roles || [], accountType: input.accountType || 'technical' }
  }];
  if ((input.accountType || 'technical') === 'employee') {
    events.push({
      ...base,
      action: 'employee_created',
      metadata: { employmentStartedAt: input.employmentStartedAt }
    });
  }
  return events;
}

function repository(req) {
  return req.app.dependencies?.adminRepository || dbRepository;
}

async function audit(req, action, resourceType, resourceId, result, metadata = {}) {
  await writeAuditEvent(req.app.env, {
    actorUserId: req.user?.id,
    action,
    resourceType,
    resourceId,
    result,
    requestId: req.requestId,
    ip: req.socket.remoteAddress,
    metadata
  }, req.app.dependencies?.auditRepository);
}

function safeError(statusCode, error) {
  return { statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error }) };
}
