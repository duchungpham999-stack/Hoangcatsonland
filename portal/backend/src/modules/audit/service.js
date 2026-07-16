import { findAuditEvents } from './repository.js';

export async function listAuditEvents() {
  return findAuditEvents();
}
