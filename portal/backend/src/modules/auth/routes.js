import { login, profile } from './controller.js';

export const routes = [
  { method: 'POST', path: '/api/auth/login', handler: login },
  { method: 'GET', path: '/api/auth/profile', handler: profile }
];
