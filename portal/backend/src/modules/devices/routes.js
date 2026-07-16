import { list } from './controller.js';

export const routes = [
  { method: 'GET', path: '/api/devices', handler: list }
];
