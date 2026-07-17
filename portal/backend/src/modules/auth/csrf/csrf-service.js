import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { json } from '../../../core/http/response.js';

const csrfCookieName = 'ids_csrf';

export function createCsrfResponse(env) {
  const nonce = randomBytes(32).toString('base64url');
  const token = signCsrfToken(env, nonce);

  return json(200, { csrfToken: token }, {
    'set-cookie': serializeCsrfCookie(token, env)
  });
}

export function validateCsrfToken(req) {
  if (req.method === 'GET' || req.url.startsWith('/api/auth/csrf')) return true;

  const headerToken = req.headers['x-csrf-token'];
  const cookieToken = getCookieValue(req, csrfCookieName);
  if (!headerToken || !cookieToken || headerToken !== cookieToken) return false;

  const [nonce, signature] = headerToken.split('.');
  if (!nonce || !signature) return false;

  const expected = signCsrfToken(req.app.env, nonce);
  return safeEqual(headerToken, expected);
}

function signCsrfToken(env, nonce) {
  const signature = createHmac('sha256', getCsrfSecret(env)).update(nonce).digest('base64url');
  return `${nonce}.${signature}`;
}

function getCsrfSecret(env) {
  return env.session?.sessionSecret || 'development-csrf-secret-only-for-local';
}

function serializeCsrfCookie(token, env) {
  const parts = [
    `${csrfCookieName}=${encodeURIComponent(token)}`,
    'Path=/',
    'SameSite=Strict',
    'Max-Age=3600'
  ];
  if (env.session?.cookieSecure) parts.push('Secure');
  return parts.join('; ');
}

function getCookieValue(req, name) {
  const cookie = req.headers.cookie || '';
  const item = cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  if (!item) return '';
  return decodeURIComponent(item.split('=').slice(1).join('='));
}

function safeEqual(first, second) {
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);
  return firstBuffer.length === secondBuffer.length && timingSafeEqual(firstBuffer, secondBuffer);
}
