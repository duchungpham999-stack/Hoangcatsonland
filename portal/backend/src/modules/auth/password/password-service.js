export async function verifyPassword(password, passwordHash) {
  return Boolean(password && passwordHash && passwordHash === password);
}
