import { list } from './controller.js';

export const routes = [
  { method: 'GET', path: '/api/sessions', handler: list }
];
