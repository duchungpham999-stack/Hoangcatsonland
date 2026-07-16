import { overview } from './controller.js';

export const routes = [
  { method: 'GET', path: '/api/ids/overview', handler: overview }
];
