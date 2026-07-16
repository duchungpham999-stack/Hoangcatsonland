export async function requestAccountRecovery(username) {
  return { username, status: 'queued', delivery: 'out-of-band' };
}
