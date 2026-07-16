import { list } from './controller.js';

export const routes = [
  { method: 'GET', path: '/api/users', handler: list }
];
