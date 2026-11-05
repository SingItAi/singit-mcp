import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePrivateKey } from 'viem/accounts';
import { loadConfig, shorten } from '../src/config.mjs';
import { base58Encode, createRedactor } from '../src/redact.mjs';
import { throwawaySolana } from './keys.mjs';
import { encodings, assertNoSecrets } from './helpers.mjs';

test('central redactor covers every configured encoding and generic key patterns', () => {
  const evm = generatePrivateKey(), bytes = throwawaySolana();
  const secrets = [...encodings(Buffer.from(evm.slice(2), 'hex')), ...encodings(bytes), ...encodings(bytes.subarray(0, 32))]; // the full key and its signing seed
  const results = [];
  for (const sol of [base58Encode(bytes), JSON.stringify([...bytes]), JSON.stringify([...bytes], null, 2)]) {
    const redact = createRedactor({ SINGIT_EVM_PRIVATE_KEY: evm, SINGIT_SOLANA_PRIVATE_KEY: sol });
    for (const value of secrets) { const r = redact(`before ${value} after`); results.push(r); assert.ok(r === 'before [REDACTED] after', 'encoding was not redacted (value suppressed)'); }
    const r = redact(generatePrivateKey()); results.push(r); assert.ok(r === '[REDACTED]', 'generic hex key was not redacted (value suppressed)');
    assert.ok(redact(base58Encode(throwawaySolana())) === '[REDACTED]', 'generic base58 key was not redacted (value suppressed)');
  }
  assertNoSecrets(results, secrets);
});
test('config defaults, caps, wallet parsing, invalid inputs and shortened addresses', async () => {
  const evm = generatePrivateKey(), sol = throwawaySolana(), secrets = [...encodings(Buffer.from(evm.slice(2), 'hex')), ...encodings(sol)];
  const outputs = [];
  const c = await loadConfig({}); assert.equal(c.network, 'base'); assert.equal(c.maxPerCallUsd, 0.01); assert.equal(c.maxPerDayUsd, 0.1); assert.equal(c.payer, '');
  for (const value of ['-1', 'no', '', 'Infinity', 'NaN', '1e100']) for (const name of ['SINGIT_MAX_PER_DAY_USD', 'SINGIT_MAX_PER_CALL_USD']) {
    const c = await loadConfig({ [name]: value }); assert.equal(c.errors.length, 1); outputs.push(c.errors.join());
  }
  const base = await loadConfig({ SINGIT_EVM_PRIVATE_KEY: evm }); assert.equal(base.errors.length, 0); assert.match(shorten(base.payer), /^0x.{4}….{4}$/); outputs.push(shorten(base.payer));
  let address;
  for (const key of [base58Encode(sol), JSON.stringify([...sol]), JSON.stringify([...sol], null, 2)]) {
    const c = await loadConfig({ SINGIT_NETWORK: 'solana', SINGIT_SOLANA_PRIVATE_KEY: key }); assert.equal(c.errors.length, 0); assert.ok(c.payer); address ??= c.payer; assert.equal(c.payer, address); outputs.push(shorten(c.payer));
  }
  for (const env of [{ SINGIT_NETWORK: 'bad' }, { SINGIT_EVM_PRIVATE_KEY: '0x' + '00'.repeat(32) }, { SINGIT_NETWORK: 'solana', SINGIT_SOLANA_PRIVATE_KEY: '[1,2]' }, { SINGIT_NETWORK: 'solana', SINGIT_SOLANA_PRIVATE_KEY: JSON.stringify(Array(64).fill(256)) }, { SINGIT_BASE_URL: 'https://user:password@localhost' }]) {
    const c = await loadConfig(env); assert.ok(c.errors.length); outputs.push(c.errors.join());
  }
  assertNoSecrets(outputs, secrets);
});
