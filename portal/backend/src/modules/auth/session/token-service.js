import { createHash, randomBytes } from 'node:crypto';

export function createSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('base64url');
}

export function getCookieValue(req, name) {
  const cookie = req.headers.cookie || '';
  const item = cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  if (!item) return '';
  return decodeURIComponent(item.split('=').slice(1).join('='));
}
