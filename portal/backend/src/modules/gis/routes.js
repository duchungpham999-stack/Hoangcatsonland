import { overview } from './controller.js';

export const routes = [
  { method: 'GET', path: '/api/gis/overview', handler: overview }
];
