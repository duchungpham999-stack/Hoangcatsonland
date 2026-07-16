import { login, logout, me } from './controller.js';

export const routes = [
  { method: 'POST', path: '/api/auth/login', handler: login },
  { method: 'POST', path: '/api/auth/logout', handler: logout },
  { method: 'GET', path: '/api/auth/me', handler: me }
];
