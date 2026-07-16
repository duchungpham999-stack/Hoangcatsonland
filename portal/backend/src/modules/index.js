import { routes as authRoutes } from './auth/routes.js';
import { routes as userRoutes } from './users/routes.js';
import { routes as roleRoutes } from './roles/routes.js';
import { routes as permissionRoutes } from './permissions/routes.js';
import { routes as deviceRoutes } from './devices/routes.js';
import { routes as sessionRoutes } from './sessions/routes.js';
import { routes as auditRoutes } from './audit/routes.js';
import { routes as idsRoutes } from './ids/routes.js';
import { routes as hrmRoutes } from './hrm/routes.js';
import { routes as gisRoutes } from './gis/routes.js';

const moduleRoutes = [
  ...authRoutes,
  ...userRoutes,
  ...roleRoutes,
  ...permissionRoutes,
  ...deviceRoutes,
  ...sessionRoutes,
  ...auditRoutes,
  ...idsRoutes,
  ...hrmRoutes,
  ...gisRoutes
];

export function registerModuleRoutes(router) {
  router.addRoutes(moduleRoutes);
}

export function isModuleRegistryReady() {
  return moduleRoutes.length > 0 && moduleRoutes.every(route => route.method && route.path && route.handler);
}
