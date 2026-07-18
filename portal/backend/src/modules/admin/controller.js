import { json } from '../../core/http/response.js';
import { readJson } from '../../core/http/request.js';
import { requirePermission } from '../../core/security/authorization-guard.js';
import {
  changeAdminRolePermissions,
  changeAdminUserRoles,
  changeAdminUserStatus,
  createAdminDepartment,
  createAdminRole,
  createAdminUser,
  getAdminDepartment,
  getAdminUser,
  getAdminUserDepartmentHistory,
  listAdminDepartments,
  listAdminPermissions,
  listAdminRoles,
  listAdminUsers,
  resetAdminUserPassword,
  revokeAdminUserSessions,
  transferAdminUserDepartment,
  updateAdminDepartment,
  updateAdminRole,
  updateAdminUser
} from './service.js';

export async function usersIndex(req, context) {
  const denied = await requirePermission('users.manage')(req);
  if (denied) return denied;
  const query = Object.fromEntries(context.url.searchParams.entries());
  return json(200, await listAdminUsers(req, query));
}

export async function usersShow(req) {
  const denied = await requirePermission('users.manage')(req);
  if (denied) return denied;
  return json(200, await getAdminUser(req, req.params.id));
}

export async function usersCreate(req) {
  const denied = await requirePermission('users.manage')(req);
  if (denied) return denied;
  return json(201, await createAdminUser(req, await readJson(req)));
}

export async function usersUpdate(req) {
  const denied = await requirePermission('users.manage')(req);
  if (denied) return denied;
  return json(200, await updateAdminUser(req, req.params.id, await readJson(req)));
}

export async function usersStatus(req) {
  const denied = await requirePermission('users.manage')(req);
  if (denied) return denied;
  const body = await readJson(req);
  return json(200, await changeAdminUserStatus(req, req.params.id, body.status));
}

export async function usersRoles(req) {
  const denied = await requirePermission('users.manage')(req);
  if (denied) return denied;
  const body = await readJson(req);
  return json(200, await changeAdminUserRoles(req, req.params.id, body.roles));
}

export async function usersResetPassword(req) {
  const denied = await requirePermission('users.manage')(req);
  if (denied) return denied;
  const body = await readJson(req);
  return json(200, await resetAdminUserPassword(req, req.params.id, body.password));
}

export async function usersRevokeSessions(req) {
  const denied = await requirePermission('users.manage')(req);
  if (denied) return denied;
  return json(200, await revokeAdminUserSessions(req, req.params.id));
}

export async function usersTransferDepartment(req) {
  const denied = await requirePermission('departments.manage')(req);
  if (denied) return denied;
  return json(200, await transferAdminUserDepartment(req, req.params.id, await readJson(req)));
}

export async function usersDepartmentHistory(req) {
  const denied = await requirePermission('departments.manage')(req);
  if (denied) return denied;
  return json(200, await getAdminUserDepartmentHistory(req, req.params.id));
}

export async function departmentsIndex(req) {
  const denied = await requirePermission('departments.manage')(req);
  if (denied) return denied;
  return json(200, await listAdminDepartments(req));
}

export async function departmentsShow(req) {
  const denied = await requirePermission('departments.manage')(req);
  if (denied) return denied;
  return json(200, await getAdminDepartment(req, req.params.id));
}

export async function departmentsCreate(req) {
  const denied = await requirePermission('departments.manage')(req);
  if (denied) return denied;
  return json(201, await createAdminDepartment(req, await readJson(req)));
}

export async function departmentsUpdate(req) {
  const denied = await requirePermission('departments.manage')(req);
  if (denied) return denied;
  return json(200, await updateAdminDepartment(req, req.params.id, await readJson(req)));
}

export async function rolesIndex(req) {
  const denied = await requirePermission('roles.manage')(req);
  if (denied) return denied;
  return json(200, await listAdminRoles(req));
}

export async function permissionsIndex(req) {
  const denied = await requirePermission('roles.manage')(req);
  if (denied) return denied;
  return json(200, await listAdminPermissions(req));
}

export async function rolesCreate(req) {
  const denied = await requirePermission('roles.manage')(req);
  if (denied) return denied;
  return json(201, await createAdminRole(req, await readJson(req)));
}

export async function rolesUpdate(req) {
  const denied = await requirePermission('roles.manage')(req);
  if (denied) return denied;
  return json(200, await updateAdminRole(req, req.params.id, await readJson(req)));
}

export async function rolesPermissions(req) {
  const denied = await requirePermission('roles.manage')(req);
  if (denied) return denied;
  const body = await readJson(req);
  return json(200, await changeAdminRolePermissions(req, req.params.id, body.permissions));
}
