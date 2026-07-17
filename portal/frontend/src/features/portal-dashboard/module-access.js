export const portalModules = [
  { key: 'ids', permission: 'ids.access' },
  { key: 'hrm', permission: 'hrm.access' },
  { key: 'gis', permission: 'gis.access' }
];

export function getVisibleModuleKeys(permissions = []) {
  return portalModules
    .filter(module => permissions.includes(module.permission))
    .map(module => module.key);
}
