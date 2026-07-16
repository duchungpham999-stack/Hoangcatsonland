import { findRoles } from './repository.js';

export async function listRoles() {
  return findRoles();
}
