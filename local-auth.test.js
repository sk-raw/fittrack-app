import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, passwordRecord } from '../lib/local-auth.js';
test('Yerel şifre kaydı düz metin içermez; rastgele tuzla farklı özetler üretir', async () => {
  const first = await passwordRecord('test-password-only');
  const second = await passwordRecord('test-password-only');
  assert.equal(first.password, undefined);
  assert.notEqual(first.passwordHash, second.passwordHash);
  assert.equal(await hashPassword('test-password-only', first.passwordSalt), first.passwordHash);
  assert.notEqual(await hashPassword('wrong', first.passwordSalt), first.passwordHash);
});
