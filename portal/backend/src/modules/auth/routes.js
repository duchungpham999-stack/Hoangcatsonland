import { changePassword, csrf, login, logout, me } from './controller.js';

export const routes = [
  { method: 'GET', path: '/api/auth/csrf', handler: csrf },
  { method: 'POST', path: '/api/auth/login', handler: login },
  { method: 'POST', path: '/api/auth/logout', handler: logout },
  { method: 'POST', path: '/api/auth/change-password', handler: changePassword },
  { method: 'GET', path: '/api/auth/me', handler: me }
];
