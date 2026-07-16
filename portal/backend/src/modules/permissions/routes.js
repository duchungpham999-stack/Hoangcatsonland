import { list } from './controller.js';

export const routes = [
  { method: 'GET', path: '/api/permissions', handler: list }
];
