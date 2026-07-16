import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

test('frontend feature folders exist', () => {
  for (const feature of ['auth', 'portal-dashboard', 'ids', 'hrm', 'gis', 'shared']) {
    assert.equal(existsSync(new URL(`../src/features/${feature}/`, import.meta.url)), true);
  }
});
