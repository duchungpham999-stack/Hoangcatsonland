import { findUsers } from './repository.js';

export async function listUsers() {
  return findUsers();
}
