import test from 'node:test';
import assert from 'node:assert/strict';
import { getVisibleModuleKeys } from '../src/features/portal-dashboard/module-access.js';

test('dashboard module visibility follows permissions', () => {
  assert.deepEqual(getVisibleModuleKeys(['ids.access', 'gis.access']), ['ids', 'gis']);
  assert.deepEqual(getVisibleModuleKeys([]), []);
});

test('system admin permission set shows all portal modules', () => {
  assert.deepEqual(getVisibleModuleKeys(['ids.access', 'hrm.access', 'gis.access']), ['ids', 'hrm', 'gis']);
});
