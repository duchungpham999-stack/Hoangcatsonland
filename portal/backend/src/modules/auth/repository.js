const users = new Map();

export async function findUserByUsername(username) {
  return users.get(username) || null;
}
