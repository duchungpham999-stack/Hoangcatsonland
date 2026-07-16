import { list } from './controller.js';

export const routes = [
  { method: 'GET', path: '/api/audit/events', handler: list }
];
