import { findUsers } from './repository.js';
import {
  assignRole,
  createUser,
  ensureRole,
  findPublicUserById,
  findUserByEmailOrUsername,
  getUserRolesAndPermissions,
  toPublicUser
} from './repository.js';

export async function listUsers() {
  return findUsers();
}

export async function getUserForLogin(env, identifier, repository) {
  return (repository?.findUserByEmailOrUsername || findUserByEmailOrUsername)(env, identifier);
}

export function assertUserCanLogin(user) {
  if (!user || user.status !== 'active') {
    throw { statusCode: 401, headers: { 'content-type': 'application/json' }, body: '{"error":"invalid_credentials"}' };
  }
}

export async function getCurrentUserProfile(env, userId, repository) {
  const user = await (repository?.findPublicUserById || findPublicUserById)(env, userId);
  const access = await (repository?.getUserRolesAndPermissions || getUserRolesAndPermissions)(env, userId);
  return toPublicUser(user, access);
}

export async function createUserWithRole(env, user, role, repository) {
  const repo = repository || { createUser, ensureRole, assignRole };
  const existing = await (repository?.findUserByEmailOrUsername || findUserByEmailOrUsername)(env, user.email);
  if (existing) return { created: false, user: toPublicUser(existing) };

  const created = await repo.createUser(env, user);
  const adminRole = await repo.ensureRole(env, role.code, role.name);
  await repo.assignRole(env, created.id, adminRole.id);
  return { created: true, user: toPublicUser(created, { roles: [role.code], permissions: [] }) };
}
