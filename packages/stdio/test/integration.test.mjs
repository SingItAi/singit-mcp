import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fixture, merchant, text, bin, encodings, assertNoSecrets } from './helpers.mjs';

test('real stdio lists exactly four tools; free needs no wallet; local reads never call merchant', async t => {
  const m = await merchant(t), f = await fixture(t, { SINGIT_BASE_URL: m.url }), s = await f.connect();
  const tools = (await s.client.listTools()).tools; f.outputs.push(JSON.stringify(tools));
  assert.deepEqual(tools.map(t => t.name).sort(), ['chat', 'chat_free', 'get_limits', 'get_receipts']);
  for (const tool of tools) { assert.equal(tool.inputSchema.type, 'object'); assert.equal(tool.annotations.readOnlyHint, tool.name !== 'chat'); }
  assert.equal(tools.find(t => t.name === 'chat').inputSchema.properties.max_tokens.maximum, 8192);
  assert.equal(tools.find(t => t.name === 'chat_free').inputSchema.properties.max_tokens.maximum, 400);
  assert.match(text(await s.call('chat_free', { prompt: 'hello' })), /Free answer.*\n.*remainingToday.*\n.*Drop free\//);
  assert.equal(m.requests[0].model, 'free/deepseek-v4.1-flash');
  const before = m.requests.length;
  assert.equal((await s.call('chat', { prompt: 'hello' })).isError, true);
  assert.match(text(await s.call('get_limits')), /no wallet configured/);
  assert.equal(text(await s.call('get_receipts')), '[]');
  assert.equal(m.requests.length, before); assert.equal(m.signatures.length, 0); await f.check();
});
for (const status of ['429', '402']) test(`free ${status} never signs`, async t => {
  const m = await merchant(t, { mode: status }), f = await fixture(t, { SINGIT_BASE_URL: m.url });
  const s = await f.connect({ SINGIT_EVM_PRIVATE_KEY: f.key });
  const r = await s.call('chat_free', { messages: [{ role: 'user', content: 'hello' }], model: 'model' });
  assert.equal(r.isError, true); assert.match(text(r), new RegExp(status));
  if (status === '429') assert.match(text(r), /Retry-After: 60.*next-window/);
  assert.equal(m.signatures.length, 0); assert.equal(await f.check(), '');
});
test('Base paid chat settles and local daily cap survives restart', async t => {
  const m = await merchant(t), f = await fixture(t, { SINGIT_BASE_URL: m.url, SINGIT_MAX_PER_DAY_USD: '0.01' });
  let s = await f.connect({ SINGIT_EVM_PRIVATE_KEY: f.key });
  const r = await s.call('chat', { prompt: 'hello', system: 'be brief' });
  assert.ok(!r.isError, text(r)); assert.match(text(r), /Paid answer.*\n.*4000.*0.004000.*0.006000/);
  assert.equal(m.requests.length, 2); assert.equal(m.signatures.length, 1);
  assert.equal(m.requests[0].max_tokens, 1024); assert.equal(m.requests[0].messages[0].role, 'system');
  let log = await f.check(); assert.match(log, /"event":"reserve"/); assert.match(log, /"event":"settle"/);
  const limits = JSON.parse(text(await s.call('get_limits'))); assert.equal(limits.spentTodayUsd, '0.004000'); assert.equal(limits.remainingTodayUsd, '0.006000');
  const receipts = JSON.parse(text(await s.call('get_receipts'))); assert.equal(receipts[0].status, 'settled'); assert.equal(receipts[0].tx, 'mock-transaction'); assert.equal(receipts[0].resource, '/v1/chat/completions'); assert.ok(!text(await s.call('get_receipts')).includes(m.signatures[0].payload.permit2Authorization.from));
  assert.equal((await s.call('chat', { prompt: 'again' })).isError, true);
  await s.client.close(); s = await f.connect({ SINGIT_EVM_PRIVATE_KEY: f.key });
  assert.equal((await s.call('chat', { prompt: 'after restart' })).isError, true);
  assert.equal(m.signatures.length, 1); assert.equal(m.requests.length, 4); assert.equal(await f.check(), log);
});
test('over per-call cap refuses before reserve or signature', async t => {
  const m = await merchant(t, { amount: '10001' }), f = await fixture(t, { SINGIT_BASE_URL: m.url }), s = await f.connect({ SINGIT_EVM_PRIVATE_KEY: f.key });
  const r = await s.call('chat', { prompt: 'hello' }); assert.equal(r.isError, true); assert.match(text(r), /per-call ceiling/);
  assert.equal(m.requests.length, 1); assert.equal(m.signatures.length, 0); assert.equal(await f.check(), '');
});
test('merchant refuses signed payment once; reservation released', async t => {
  const m = await merchant(t, { mode: 'refuse' }), f = await fixture(t, { SINGIT_BASE_URL: m.url }), s = await f.connect({ SINGIT_EVM_PRIVATE_KEY: f.key });
  const r = await s.call('chat', { prompt: 'hello' }); assert.equal(r.isError, true); assert.match(text(r), /not repeated/);
  assert.equal(m.requests.length, 2); assert.equal(m.signatures.length, 1); assert.match(await f.check(), /"event":"release"/);
  assert.equal(JSON.parse(text(await s.call('get_receipts')))[0].status, 'released');
});
test('merchant echoes every key encoding in errors and receipt: all output and persistence redacted', async t => {
  const m = await merchant(t, { mode: 'echo' }), f = await fixture(t, { SINGIT_BASE_URL: m.url }), s = await f.connect({ SINGIT_EVM_PRIVATE_KEY: f.key });
  m.echo = encodings(Buffer.from(f.key.slice(2), 'hex')).join(' ');
  for (const name of ['chat', 'chat_free']) { const r = await s.call(name, { prompt: 'hello' }); assert.equal(r.isError, true); assert.match(text(r), /REDACTED/); }
  m.mode = 'normal'; m.tx = f.key;
  assert.ok(!(await s.call('chat', { prompt: 'hello' })).isError);
  assert.match(await f.check(), /REDACTED/);
  await s.call('get_receipts'); await f.check();
});
for (const bad of ['-1', 'NaN', 'Infinity', '', 'nonsense', '1e99']) test(`invalid cap ${JSON.stringify(bad)} leaves free and local tools working`, async t => {
  const m = await merchant(t), f = await fixture(t, { SINGIT_BASE_URL: m.url, SINGIT_MAX_PER_CALL_USD: bad }), s = await f.connect({ SINGIT_EVM_PRIVATE_KEY: f.key });
  assert.equal((await s.call('chat', { prompt: 'hello' })).isError, true); assert.equal(m.requests.length, 0);
  assert.ok(!(await s.call('chat_free', { prompt: 'hello' })).isError);
  assert.match(text(await s.call('get_limits')), /configErrors/); await s.call('get_receipts'); await f.check();
});
test('CLI help/version/check and clean stdin shutdown', async t => {
  const f = await fixture(t);
  async function run(args, env = {}) {
    const child = spawn(process.execPath, [bin, ...args], { env: { ...f.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = ''; child.stdout.on('data', b => stdout += b); child.stderr.on('data', b => stderr += b);
    child.stdin.end(); const [code, signal] = await once(child, 'close');
    f.outputs.push(stdout, stderr); await f.check(); return { code, signal, stdout, stderr };
  }
  assert.match((await run(['--version'])).stdout, /^0\.1\.0\n$/);
  assert.match((await run(['--help'])).stdout, /Usage:/);
  assert.equal((await run(['--check'])).code, 2);
  const checked = await run(['--check'], { SINGIT_EVM_PRIVATE_KEY: f.key }); f.secrets.push(...encodings(Buffer.from(f.key.slice(2), 'hex')));
  assert.equal(checked.code, 0); assert.match(checked.stdout, /wallet.*…/);
  assert.equal((await run(['--check'], { SINGIT_MAX_PER_DAY_USD: '-1' })).code, 2);
  const closed = await run([]); assert.equal(closed.code, 0); assert.equal(closed.signal, null); assert.equal(closed.stdout, '');
  await f.check();
});

test('missing or invalid wallet returns tool error before any merchant request', async t => {
  const m = await merchant(t), f = await fixture(t, { SINGIT_BASE_URL: m.url });
  for (const env of [{}, { SINGIT_EVM_PRIVATE_KEY: 'invalid-key' }]) {
    const s = await f.connect(env), r = await s.call('chat', { prompt: 'hello' });
    assert.equal(r.isError, true); assert.match(text(r), /wallet|Configuration error/);
    assert.equal(m.requests.length, 0); assert.equal(m.signatures.length, 0);
  }
  await f.check();
});
