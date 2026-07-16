import { findDevices } from './repository.js';

export async function listDevices() {
  return findDevices();
}
