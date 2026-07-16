import { findSessions } from './repository.js';

export async function listSessions() {
  return findSessions();
}
