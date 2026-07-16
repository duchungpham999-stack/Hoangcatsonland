import { findPermissions } from './repository.js';

export async function listPermissions() {
  return findPermissions();
}
