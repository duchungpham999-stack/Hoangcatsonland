import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyPassword } from '../password/password-service.js';

test('password verifier rejects empty input', async () => {
  assert.equal(await verifyPassword('', 'configured-hash'), false);
});
